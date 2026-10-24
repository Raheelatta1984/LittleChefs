import type { Database } from "../db/index.js";
import { config } from "../config.js";
import { TtlCache, cachedLoad } from "../lib/cache.js";

/**
 * Read-through caches for the *shared* catalogue.
 *
 * The list endpoint is the most frequently hit data route in the app (opened
 * on every search, claim and catalogue browse), and its SQL is not free: it
 * counts ingredients/steps per row and previously also answered "do I own
 * this?" with a correlated subquery per row.
 *
 * So the expensive, chef-independent rows are cached once per query shape, and
 * each chef's owned-catalogue-id set is cached separately. Every write path
 * (claim, import confirm, delete) calls the invalidation helpers below, so the
 * UI never shows a stale "not in my book".
 */

export type CatalogueListRow = {
  id: string;
  title: string;
  cuisine: string | null;
  hero_image_url: string | null;
  base_servings: number | string;
  total_minutes: number | string | null;
  source_type: string;
  ingredient_count: number | string;
  step_count: number | string;
};

const listCache = new TtlCache<CatalogueListRow[]>({
  name: "catalogue-list",
  max: 500,
  ttlMs: config.cache.catalogueListTtlMs,
});

const chefCatalogueIdsCache = new TtlCache<string[]>({
  name: "chef-catalogue-ids",
  max: Math.max(100, Math.floor(config.cache.maxEntries / 2)),
  ttlMs: config.cache.chefCatalogueTtlMs,
});

/** Canonical catalogue rows for a search term, cached per (query, limit). */
export async function listCatalogueRecipes(
  db: Database,
  query: string,
  limit: number,
): Promise<CatalogueListRow[]> {
  const pattern = `%${query.toLowerCase()}%`;
  const load = () =>
    db
      .query<CatalogueListRow>(
        `select c.id, c.title, c.cuisine, c.hero_image_url, c.base_servings, c.total_minutes, c.source_type,
                (select count(*) from catalogue_ingredients i where i.catalogue_id = c.id) as ingredient_count,
                (select count(*) from catalogue_steps s where s.catalogue_id = c.id) as step_count
           from catalogue_recipes c
          where ($1 = '%%' or lower(c.title) like $1)
          order by c.created_at desc
          limit $2`,
        [pattern, limit],
      )
      .then((result) => result.rows);

  if (!config.cache.enabled) return load();
  return cachedLoad(listCache, `${query.toLowerCase()}|${limit}`, load);
}

/** Ids of catalogue recipes this chef already has in their private book. */
export async function catalogueIdsInChefBook(db: Database, chefId: string): Promise<string[]> {
  const load = () =>
    db
      .withChef(chefId, (tx) =>
        tx.query<{ catalogue_id: string | null }>(
          `select distinct catalogue_id from chef_recipes where catalogue_id is not null`,
        ),
      )
      .then((result) =>
        result.rows
          .map((row) => row.catalogue_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      );

  if (!config.cache.enabled) return load();
  return cachedLoad(chefCatalogueIdsCache, chefId, load);
}

/** A recipe was added to / removed from a chef's book. */
export function invalidateChefCatalogue(chefId: string): void {
  chefCatalogueIdsCache.delete(chefId);
}

/** The shared catalogue changed — drop everything derived from it. */
export function invalidateCatalogueCaches(): void {
  listCache.clear();
  chefCatalogueIdsCache.clear();
}

/** Test/debug helper. */
export function resetCatalogueCaches(): void {
  listCache.clear();
  chefCatalogueIdsCache.clear();
}
