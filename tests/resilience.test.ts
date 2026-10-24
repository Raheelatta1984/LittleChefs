import "./setup.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { BloomFilter, ScalableBloomFilter } from "../server/lib/bloom.js";
import { TtlCache, singleFlight } from "../server/lib/cache.js";
import { rateLimit } from "../server/lib/rateLimit.js";
import type { Database, Queryable, QueryResult, Row } from "../server/db/index.js";
import { api, createChef, freshDatabase, startTestServer } from "./helpers.js";

/* ------------------------------------------------------------------ units */

describe("bloom filter", () => {
  it("never reports a false negative", () => {
    const filter = new BloomFilter(2_000, 0.01);
    const keys = Array.from({ length: 1_500 }, (_, index) => `dish-${index}`);
    keys.forEach((key) => filter.add(key));
    keys.forEach((key) => assert.equal(filter.mightContain(key), true, `${key} must be present`));
  });

  it("keeps the false-positive rate near the requested bound", () => {
    const filter = new BloomFilter(1_000, 0.01);
    for (let index = 0; index < 1_000; index += 1) filter.add(`present-${index}`);
    let falsePositives = 0;
    const probes = 5_000;
    for (let index = 0; index < probes; index += 1) {
      if (filter.mightContain(`absent-${index}`)) falsePositives += 1;
    }
    const observed = falsePositives / probes;
    assert.ok(observed < 0.05, `expected < 5% false positives, saw ${(observed * 100).toFixed(2)}%`);
    const stats = filter.stats();
    assert.equal(stats.items, 1_000);
    assert.ok(stats.saturation > 0 && stats.saturation < 1);
  });

  it("grows without losing earlier keys", () => {
    const filter = new ScalableBloomFilter({ initialCapacity: 32, falsePositiveRate: 0.01 });
    const keys = Array.from({ length: 500 }, (_, index) => `key-${index}`);
    keys.forEach((key) => filter.add(key));
    keys.forEach((key) => assert.equal(filter.mightContain(key), true));
    assert.ok(filter.stats().slices.length > 1, "should have grown into several slices");
  });

  it("answers 'no' for a filter that never saw the key", () => {
    const filter = new BloomFilter(100, 0.01);
    filter.add("chicken biryani");
    assert.equal(filter.mightContain("zanzibari octopus stew"), false);
  });
});

describe("ttl cache", () => {
  it("stores, expires and evicts least-recently-used entries", async () => {
    const cache = new TtlCache<string>({ name: "unit-lru", max: 2, ttlMs: 1_000 });
    cache.set("a", "1");
    cache.set("b", "2");
    assert.equal(cache.get("a"), "1");
    cache.set("c", "3"); // "b" is least recently used -> evicted
    assert.equal(cache.get("b"), undefined);
    assert.equal(cache.get("a"), "1");
    assert.equal(cache.get("c"), "3");
    assert.equal(cache.size, 2);

    const short = new TtlCache<string>({ name: "unit-ttl", max: 4, ttlMs: 20 });
    short.set("gone", "soon");
    assert.equal(short.get("gone"), "soon");
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(short.get("gone"), undefined);
  });

  it("invalidates entries by prefix", () => {
    const cache = new TtlCache<string>({ name: "unit-prefix", max: 10 });
    cache.set("chef-1|a", "x");
    cache.set("chef-1|b", "y");
    cache.set("chef-2|a", "z");
    assert.equal(cache.deleteByPrefix("chef-1|"), 2);
    assert.equal(cache.get("chef-1|a"), undefined);
    assert.equal(cache.get("chef-2|a"), "z");
  });

  it("coalesces concurrent identical loads", async () => {
    let calls = 0;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        singleFlight("same-key", async () => {
          calls += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "value";
        }),
      ),
    );
    assert.equal(calls, 1);
    assert.deepEqual(results, new Array(8).fill("value"));
  });
});

/* ------------------------------------------------------------ rate limits */

async function listen(app: express.Express): Promise<{ url: string; close: () => void }> {
  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

describe("rate limiting", () => {
  it("limits bursts, explains the wait and refills over time", async () => {
    const app = express();
    app.get("/hit", rateLimit({ name: "unit-burst", windowMs: 400, max: 2 }), (_req, res) => {
      res.json({ ok: true });
    });
    const server = await listen(app);
    try {
      assert.equal((await fetch(`${server.url}/hit`)).status, 200);
      assert.equal((await fetch(`${server.url}/hit`)).status, 200);
      const limited = await fetch(`${server.url}/hit`);
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers.get("retry-after")) >= 1);
      assert.equal(limited.headers.get("ratelimit-remaining"), "0");
      const body = (await limited.json()) as { error: string; retryAfter: number };
      assert.equal(body.error, "rate_limited");
      assert.ok(body.retryAfter >= 1);

      await new Promise((resolve) => setTimeout(resolve, 450));
      assert.equal((await fetch(`${server.url}/hit`)).status, 200, "bucket refills");
    } finally {
      server.close();
    }
  });

  it("keeps buckets separate per limiter and supports skip", async () => {
    const app = express();
    app.get("/a", rateLimit({ name: "unit-a", windowMs: 60_000, max: 1 }), (_req, res) => {
      res.json({ ok: true });
    });
    app.get("/b", rateLimit({ name: "unit-b", windowMs: 60_000, max: 1 }), (_req, res) => {
      res.json({ ok: true });
    });
    app.get(
      "/free",
      rateLimit({ name: "unit-free", windowMs: 60_000, max: 1, skip: () => true }),
      (_req, res) => res.json({ ok: true }),
    );
    const server = await listen(app);
    try {
      assert.equal((await fetch(`${server.url}/a`)).status, 200);
      assert.equal((await fetch(`${server.url}/a`)).status, 429);
      assert.equal((await fetch(`${server.url}/b`)).status, 200, "separate bucket");
      assert.equal((await fetch(`${server.url}/free`)).status, 200);
      assert.equal((await fetch(`${server.url}/free`)).status, 200, "skipped limiter");
    } finally {
      server.close();
    }
  });
});

/* ----------------------------------------------------------- API effects */

type Counter = { queries: number; sql: string[]; reset: () => void };

/** Wraps a database so tests can prove a request never touched Postgres. */
function instrument(db: Database): { db: Database; counter: Counter } {
  const counter: Counter = {
    queries: 0,
    sql: [],
    reset() {
      counter.queries = 0;
      counter.sql = [];
    },
  };
  const count = (sql: string) => {
    counter.queries += 1;
    counter.sql.push(sql);
  };
  const wrap = (queryable: Queryable): Queryable => {
    const wrapped: Queryable = {
      query: <T extends Row = Row>(sql: string, params?: unknown[]): Promise<QueryResult<T>> => {
        count(sql);
        return queryable.query<T>(sql, params);
      },
    };
    const inner = queryable.exec;
    if (inner) {
      wrapped.exec = (sql: string) => {
        count(sql);
        return inner(sql);
      };
    }
    return wrapped;
  };

  return {
    counter,
    db: {
      query: async (sql, params) => {
        count(sql);
        return db.query(sql, params);
      },
      exec: async (sql) => {
        count(sql);
        await db.exec(sql);
      },
      transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
      withChef: (chefId, fn) => db.withChef(chefId, (tx) => fn(wrap(tx))),
      close: () => db.close(),
    },
  };
}

describe("database load shedding", () => {
  let raw: Database;
  let measured: Database;
  let counter: Counter;
  let server: { base: string; close: () => Promise<void> };
  let chef: { id: string; token: string };

  before(async () => {
    raw = await freshDatabase();
    const instrumented = instrument(raw);
    measured = instrumented.db;
    counter = instrumented.counter;
    server = await startTestServer(measured);
    chef = await createChef(measured, "Nadia", "adult");
  });

  after(async () => {
    await server.close();
    await raw.close();
  });

  it("reuses a validated session instead of querying the database on every call", async () => {
    counter.reset();
    const first = await api<{ chef: { id: string } }>(server.base, "/me", { token: chef.token });
    assert.equal(first.status, 200);
    const afterFirst = counter.queries;
    assert.ok(afterFirst > 0);

    counter.reset();
    const second = await api<{ chef: { id: string } }>(server.base, "/me", { token: chef.token });
    assert.equal(second.status, 200);
    assert.equal(second.body.chef.id, chef.id);
    // /me itself still reads the chef row; the *session* lookup is gone.
    const sessionQueries = counter.sql.filter((sql) => /chef_sessions/i.test(sql));
    assert.equal(sessionQueries.length, 0, "session lookup must come from cache");
  });

  it("negative-caches unknown bearer tokens so floods never reach the database", async () => {
    const token = `made-up-${Math.random().toString(36).slice(2)}`;
    counter.reset();
    const first = await api(server.base, "/recipes", { token });
    assert.equal(first.status, 401);
    assert.ok(counter.queries > 0, "first look verifies against the database");

    counter.reset();
    const second = await api(server.base, "/recipes", { token });
    assert.equal(second.status, 401);
    assert.equal(counter.queries, 0, "cached rejection costs no queries");
  });

  it("negative-caches missing catalogue recipes", async () => {
    const missingId = "00000000-0000-4000-8000-000000009999";
    counter.reset();
    const first = await api(server.base, `/catalogue/${missingId}`, { token: chef.token });
    assert.equal(first.status, 404);
    assert.ok(counter.queries > 0);

    counter.reset();
    const second = await api(server.base, `/catalogue/${missingId}`, { token: chef.token });
    assert.equal(second.status, 404);
    assert.equal(
      counter.sql.filter((sql) => /catalogue_recipes/i.test(sql)).length,
      0,
      "the 404 is remembered",
    );
  });

  it("answers repeat searches from the negative cache", async () => {
    counter.reset();
    const first = await api<{ needsOnboarding: boolean }>(server.base, "/search?q=zanzibari%20octopus%20stew", {
      token: chef.token,
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.needsOnboarding, true);
    assert.ok(counter.queries > 0);

    counter.reset();
    const second = await api<{ needsOnboarding: boolean }>(server.base, "/search?q=zanzibari%20octopus%20stew", {
      token: chef.token,
    });
    assert.equal(second.body.needsOnboarding, true);
    assert.equal(
      counter.sql.filter((sql) => /from chef_recipes|from catalogue_recipes/i.test(sql)).length,
      0,
      "the miss is cached",
    );
  });

  it("uses the bloom index to skip catalogue queries for impossible dishes", async () => {
    const { ensureCatalogueRecipe } = await import("../server/services/recipes.js");
    await ensureCatalogueRecipe(
      measured,
      {
        title: "Saffron Quokka Tart",
        cuisine: null,
        description: null,
        difficulty: "Easy",
        baseServings: 4,
        totalMinutes: 30,
        heroImageUrl: null,
        sourceType: "web",
        sourceUrl: null,
        sourceVideoId: null,
        sourceChannel: null,
        sourceAuthor: null,
        ingredients: [
          { position: 0, quantity: 1, unit: "tsp", item: "saffron", prepNote: null, groupName: null, scalable: true, rawText: null },
        ],
        steps: [
          { position: 0, instruction: "Bake it.", durationSeconds: null, temperatureC: null, imageUrl: null, tip: null },
        ],
      },
      chef.id,
    );

    const token2 = (await createChef(measured, "Omar", "teen")).token;

    // 1. A dish the catalogue cannot contain: the filter answers "no" and the
    //    catalogue queries (plus the 500-row fuzzy scan) never run.
    counter.reset();
    const miss = await api<{ sharedMatches: unknown[] }>(
      server.base,
      "/search?q=moonbeam%20galaxy%20comet%20pie",
      { token: token2 },
    );
    assert.equal(miss.status, 200);
    assert.equal(miss.body.sharedMatches.length, 0);
    assert.equal(
      counter.sql.filter((sql) => /catalogue_recipes/i.test(sql)).length,
      0,
      "Bloom filter proved nothing could match",
    );

    // 2. A dish that IS in the catalogue: "maybe" falls through to the database
    //    and the real match is returned.
    const hit = await api<{ sharedMatches: Array<{ title: string }> }>(
      server.base,
      "/search?q=saffron%20quokka%20tart",
      { token: token2 },
    );
    assert.equal(hit.body.sharedMatches.length, 1);
    assert.equal(hit.body.sharedMatches[0].title, "Saffron Quokka Tart");
  });

  it("sees a newly saved recipe immediately (cache invalidation)", async () => {
    const fresh = await createChef(measured, "Priya", "teen");
    const draft = {
      title: "Priya Cardamom Kheer",
      baseServings: 4,
      ingredients: [
        { position: 0, quantity: 1, unit: "litre", item: "milk", prepNote: null, groupName: null, scalable: true, rawText: null },
        { position: 1, quantity: 100, unit: "g", item: "rice", prepNote: null, groupName: null, scalable: true, rawText: null },
      ],
      steps: [
        { position: 0, instruction: "Simmer everything until creamy.", durationSeconds: null, temperatureC: null, imageUrl: null, tip: null },
      ],
    };
    const missing = await api<{ needsOnboarding: boolean }>(
      server.base,
      "/search?q=priya%20cardamom%20kheer",
      { token: fresh.token },
    );
    assert.equal(missing.body.needsOnboarding, true);

    const created = await api<{ recipe: { id: string } }>(server.base, "/recipes", {
      method: "POST",
      token: fresh.token,
      body: draft,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const found = await api<{ myRecipes: unknown[]; needsOnboarding: boolean }>(
      server.base,
      "/search?q=priya%20cardamom%20kheer",
      { token: fresh.token },
    );
    assert.equal(found.body.needsOnboarding, false);
    assert.equal(found.body.myRecipes.length, 1);
  });

  it("reports cache and index health without leaking data", async () => {
    const health = await api<{
      ok: boolean;
      cache: { caches: Array<{ name: string }>; hitRate: number };
      catalogueIndex: { ready: boolean; items: number };
      rateLimit: { enabled: boolean };
    }>(server.base, "/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.ok(health.body.cache.caches.some((cache) => cache.name === "sessions"));
    assert.equal(health.body.catalogueIndex.ready, true);
    assert.ok(health.body.catalogueIndex.items > 0, "catalogue recipes are indexed");
    assert.equal(health.body.rateLimit.enabled, true);
    assert.equal(JSON.stringify(health.body).includes(chef.token), false);
  });
});
