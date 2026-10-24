import type { Database } from "../db/index.js";
import { config } from "../config.js";
import { ScalableBloomFilter } from "../lib/bloom.js";
import { singleFlight } from "../lib/cache.js";
import { dedupeKey, normaliseDishName, tokens } from "./normalise.js";

/**
 * In-memory Bloom index of the shared catalogue.
 *
 * The internal-first lookup runs on every search / import, and its "nothing
 * matched" path is the expensive one: a catalogue query plus (when that misses)
 * a 500-row fuzzy scan. The Bloom filter lets us answer "this dish cannot be in
 * the catalogue" without a single query:
 *
 *   • every catalogue title contributes its dedupe key, its normalised title and
 *     each of its normalised title tokens;
 *   • a query is only short-circuited when *none* of its tokens are present —
 *     that guarantees neither exact-key, containment nor Jaccard matching can
 *     succeed, so skipping the query can never hide a real recipe;
 *   • anything else ("maybe") falls through to the database as before.
 *
 * Writes call `noteCatalogueRecipe()` immediately. Because another instance (or
 * a cold start) may have added rows we never saw, the filter is also rebuilt
 * from the database at most once every `cache.catalogueIndexTtlMs`, so the worst
 * case is a bounded, documented staleness window — never a permanent blind spot.
 */

const KEY_PREFIX = "key:";
const TITLE_PREFIX = "title:";
const TOKEN_PREFIX = "token:";

export type CatalogueIndexSnapshot = {
  ready: boolean;
  builtAt: number;
  ageMs: number;
  items: number;
  slices: number;
};

class CatalogueIndex {
  private filter = newBloom();
  private builtAt = 0;
  private refreshing: Promise<void> | null = null;

  note(title: string): void {
    const normalised = normaliseDishName(title) || title.trim().toLowerCase();
    if (!normalised) return;
    this.filter.add(`${KEY_PREFIX}${dedupeKey(title)}`);
    this.filter.add(`${TITLE_PREFIX}${normalised}`);
    for (const token of new Set(tokens(normalised))) {
      this.filter.add(`${TOKEN_PREFIX}${token}`);
    }
  }

  /** True when the filter has been built and is still inside its TTL. */
  private get usable(): boolean {
    if (!config.cache.enabled || this.builtAt === 0) return false;
    return Date.now() - this.builtAt < config.cache.catalogueIndexTtlMs;
  }

  get builtAtMs(): number {
    return this.builtAt;
  }

  /** "Maybe" — true unless every query token is provably absent. */
  mightMatch(dedupe: string, normalisedTitle: string): boolean {
    if (!this.usable) return true;
    if (this.filter.mightContain(`${KEY_PREFIX}${dedupe}`)) return true;
    if (this.filter.mightContain(`${TITLE_PREFIX}${normalisedTitle}`)) return true;
    const queryTokens = [...new Set(tokens(normalisedTitle))];
    if (queryTokens.length === 0) return true;
    return queryTokens.some((token) => this.filter.mightContain(`${TOKEN_PREFIX}${token}`));
  }

  async refresh(db: Database): Promise<void> {
    if (!config.cache.enabled) return;
    if (this.refreshing) return this.refreshing;
    if (this.usable) return;

    this.refreshing = (async () => {
      const rows = await db.query<{ title: string }>(
        `select title from catalogue_recipes order by created_at`,
      );
      const fresh = newBloom();
      for (const row of rows.rows) {
        const normalised = normaliseDishName(row.title) || row.title.trim().toLowerCase();
        if (!normalised) continue;
        fresh.add(`${KEY_PREFIX}${dedupeKey(row.title)}`);
        fresh.add(`${TITLE_PREFIX}${normalised}`);
        for (const token of new Set(tokens(normalised))) fresh.add(`${TOKEN_PREFIX}${token}`);
      }
      this.filter = fresh;
      this.builtAt = Date.now();
    })()
      .catch((error) => {
        // Keep serving: a filter that could not be built must never answer "no".
        console.warn("[catalogue-index] rebuild failed, falling back to queries", error);
        this.builtAt = 0;
      })
      .finally(() => {
        this.refreshing = null;
      });

    return this.refreshing;
  }

  reset(): void {
    this.filter = newBloom();
    this.builtAt = 0;
  }

  snapshot(): CatalogueIndexSnapshot {
    const stats = this.filter.stats();
    return {
      ready: this.builtAt > 0,
      builtAt: this.builtAt,
      ageMs: this.builtAt === 0 ? 0 : Date.now() - this.builtAt,
      items: stats.items,
      slices: stats.slices.length,
    };
  }
}

/** The index module owns the sizing policy for every filter it builds. */
function newBloom(): ScalableBloomFilter {
  return new ScalableBloomFilter({ initialCapacity: 1_024, falsePositiveRate: 0.005 });
}

export const catalogueIndex = new CatalogueIndex();

/**
 * Skips the catalogue queries when the Bloom filter proves nothing can match.
 * The first call after a cold start (or after the TTL) rebuilds the index from
 * Postgres once, coalesced across concurrent requests.
 */
export async function catalogueMightContainDish(
  db: Database,
  dedupe: string,
  normalisedTitle: string,
): Promise<boolean> {
  if (!config.cache.enabled) return true;
  await singleFlight("catalogue-index:refresh", () => catalogueIndex.refresh(db));
  return catalogueIndex.mightMatch(dedupe, normalisedTitle);
}

/** Called by every catalogue write so the current process never serves a stale "no". */
export function noteCatalogueRecipe(title: string): void {
  catalogueIndex.note(title);
}

/** Test/debug helper — forces the next lookup to rebuild from the database. */
export function resetCatalogueIndex(): void {
  catalogueIndex.reset();
}

/** Detail-free diagnostics for `/api/health`. */
export function catalogueIndexSnapshot(): CatalogueIndexSnapshot {
  return catalogueIndex.snapshot();
}
