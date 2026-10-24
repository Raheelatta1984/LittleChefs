/**
 * Small in-process caching primitives used to take load off Postgres:
 *
 *  • `TtlCache`  — LRU + per-entry TTL map (bounded memory, no timers).
 *  • `singleFlight` — collapses concurrent identical loads into one query.
 *  • `cachedLoad` — TTL + single-flight + negative caching in one helper.
 *
 * Everything is intentionally dependency-free and process-local. Multiple API
 * instances (or Vercel cold starts) each keep their own copy, so cached values
 * always have a short TTL and every write path invalidates what it touched.
 */

type Entry<V> = { value: V; expiresAt: number };

export type CacheStats = {
  name: string;
  size: number;
  max: number;
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  hitRate: number;
};

export type TtlCacheOptions = {
  name: string;
  max?: number;
  ttlMs?: number;
};

/** Bounded LRU cache with per-entry expiry. `undefined` means "not cached". */
export class TtlCache<V> {
  readonly name: string;
  readonly max: number;
  readonly ttlMs: number;
  private readonly entries = new Map<string, Entry<V>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(options: TtlCacheOptions) {
    this.name = options.name;
    this.max = Math.max(1, options.max ?? 1_000);
    this.ttlMs = Math.max(1, options.ttlMs ?? 30_000);
    registerCache(this);
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.expirations += 1;
      this.misses += 1;
      return undefined;
    }
    // Re-insert to keep Map iteration order == recency order (LRU).
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  /** Reads without touching LRU order or hit/miss counters. */
  peek(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.expirations += 1;
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.peek(key) !== undefined;
  }

  set(key: string, value: V, ttlMs?: number): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlMs ?? this.ttlMs) });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
      this.evictions += 1;
    }
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /** Drops every key starting with `prefix` — used to invalidate one chef's entries. */
  deleteByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      name: this.name,
      size: this.entries.size,
      max: this.max,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(3)),
    };
  }
}

/** Every cache registers itself once so `/api/health` can report hit rates. */
const registry = new Set<{ stats(): CacheStats }>();

function registerCache(cache: { stats(): CacheStats }): void {
  registry.add(cache);
}

/** Aggregate stats for `/api/health` — no database or per-key detail leak. */
export function cacheStats(): { caches: CacheStats[]; entries: number; hitRate: number } {
  const caches = [...registry].map((cache) => cache.stats());
  const entries = caches.reduce((total, cache) => total + cache.size, 0);
  const hits = caches.reduce((total, cache) => total + cache.hits, 0);
  const misses = caches.reduce((total, cache) => total + cache.misses, 0);
  return {
    caches,
    entries,
    hitRate: hits + misses === 0 ? 0 : Number((hits / (hits + misses)).toFixed(3)),
  };
}

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Collapses concurrent identical work (e.g. ten requests for the same dish in
 * the same second) into a single database query. Errors are never cached — the
 * next caller retries.
 */
export function singleFlight<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = loader().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise as Promise<unknown>);
  return promise;
}

/**
 * Read-through cache with negative caching and request coalescing.
 *
 * `loader` may resolve `null` for "genuinely not there"; that miss is cached
 * too (for `negativeTtlMs` when provided) so repeat lookups of a missing id or
 * dish name never touch the database again.
 */
export async function cachedLoad<T>(
  cache: TtlCache<T>,
  key: string,
  loader: () => Promise<T>,
  options: { ttlMs?: number; negativeTtlMs?: number; cacheNegative?: (value: T) => boolean } = {},
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  return singleFlight(`${cache.name}:${key}`, async () => {
    const filled = cache.get(key);
    if (filled !== undefined) return filled;

    const value = await loader();
    const isNegative = options.cacheNegative ? options.cacheNegative(value) : value === null;
    const ttl =
      isNegative && options.negativeTtlMs !== undefined ? options.negativeTtlMs : options.ttlMs;
    cache.set(key, value, ttl);
    return value;
  });
}
