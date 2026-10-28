import { resolve } from "node:path";

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const databaseUrl = process.env.DATABASE_URL?.trim() || "";
const driver = (process.env.DB_DRIVER?.trim() || (databaseUrl ? "postgres" : "pglite")).toLowerCase();

/**
 * Serverless hosts (Vercel) have a read-only filesystem except /tmp, which is
 * also wiped between instances. PGlite + uploads therefore live in /tmp there
 * (great for demos; set DATABASE_URL for durable production data).
 */
const onServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: num(process.env.PORT, 8787),
  /**
   * `pglite` runs the real Postgres engine in-process (WASM) — ideal for local dev,
   * tests and demos with zero infrastructure. `postgres` points at any hosted
   * Postgres (Neon / Supabase / RDS / docker-compose) via DATABASE_URL.
   */
  db: {
    driver: driver === "postgres" ? ("postgres" as const) : ("pglite" as const),
    url: databaseUrl,
    pgliteDir:
      process.env.PGLITE_DIR?.trim() ||
      (onServerless ? "/tmp/chef-universe-pglite" : resolve(process.cwd(), "server/.data/pglite")),
    ssl: bool(process.env.DATABASE_SSL, false),
  },
  auth: {
    sessionDays: num(process.env.SESSION_TTL_DAYS, 30),
    /** Canonical browser origin used for cookie-authenticated CSRF checks. */
    appOrigin: process.env.APP_ORIGIN?.trim().replace(/\/$/, "") || "",
  },
  /**
   * In-process caches that keep hot reads (sessions, internal lookups, the
   * shared catalogue) away from Postgres. Every value is short-lived and every
   * write path invalidates what it touched, so a second API instance can never
   * serve a stale recipe for long. Set CACHE_ENABLED=false to disable them all
   * (tests, debugging).
   */
  cache: {
    enabled: bool(process.env.CACHE_ENABLED, true),
    /** Every cache is an LRU bounded to this many entries. */
    maxEntries: num(process.env.CACHE_MAX_ENTRIES, 5_000),
    /** A signed-in chef's profile/session is reused for this long. */
    sessionTtlMs: num(process.env.CACHE_SESSION_TTL_MS, 30_000),
    /** Unknown/expired bearer tokens: never re-hashed against the DB this often. */
    sessionNegativeTtlMs: num(process.env.CACHE_SESSION_NEGATIVE_TTL_MS, 10_000),
    /** Repeat searches for the same dish within this window skip the database. */
    lookupTtlMs: num(process.env.CACHE_LOOKUP_TTL_MS, 20_000),
    /** Dish names that matched nothing are remembered for this long. */
    negativeTtlMs: num(process.env.CACHE_NEGATIVE_TTL_MS, 15_000),
    /** Shared catalogue list rows (title/counts) — no chef-specific data. */
    catalogueListTtlMs: num(process.env.CACHE_CATALOGUE_LIST_TTL_MS, 30_000),
    /** A chef's "which catalogue recipes do I already own" set. */
    chefCatalogueTtlMs: num(process.env.CACHE_CHEF_CATALOGUE_TTL_MS, 20_000),
    /** Full canonical recipe payload (ingredients + steps). */
    catalogueRecipeTtlMs: num(process.env.CACHE_CATALOGUE_RECIPE_TTL_MS, 120_000),
    /** Missing recipe ids are remembered this long (404 without a query). */
    catalogueRecipeNegativeTtlMs: num(process.env.CACHE_CATALOGUE_RECIPE_NEGATIVE_TTL_MS, 15_000),
    /** Roles catalogue — static reference data. */
    rolesTtlMs: num(process.env.CACHE_ROLES_TTL_MS, 300_000),
    /** How often the in-memory Bloom filter is rebuilt from the database. */
    catalogueIndexTtlMs: num(process.env.CACHE_CATALOGUE_INDEX_TTL_MS, 60_000),
  },
  rateLimit: {
    enabled: bool(process.env.RATE_LIMIT_ENABLED, true),
    /** App-wide ceiling per caller per minute (route-specific limits are lower). */
    globalMax: num(process.env.RATE_LIMIT_GLOBAL_MAX, 600),
  },
  imports: {
    timeoutMs: num(process.env.IMPORT_TIMEOUT_MS, 12_000),
    maxBytes: num(process.env.IMPORT_MAX_BYTES, 2_500_000),
    maxRedirects: num(process.env.IMPORT_MAX_REDIRECTS, 4),
    /** Only for local fixtures/tests — never enable in production. */
    allowPrivateHosts: bool(process.env.IMPORT_ALLOW_PRIVATE_HOSTS, false),
    /**
     * Recipe sites (Woolworths, Coles, Allrecipes…) routinely answer a
     * non-browser agent with a stripped "enable JavaScript" shell that has no
     * schema.org recipe, so the import falls back to reading page text and
     * picks up clutter. A browser-style agent gets the same server-rendered
     * page a chef would see. Set IMPORT_USER_AGENT to override (empty string
     * = the old ChefUniverseBot identifier).
     */
    userAgent:
      process.env.IMPORT_USER_AGENT !== undefined
        ? process.env.IMPORT_USER_AGENT.trim()
        : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  llm: {
    /** Any OpenAI-compatible endpoint: OpenAI, OpenRouter, Groq, Gemini compat, Ollama… */
    baseUrl: process.env.LLM_BASE_URL?.trim() || "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY?.trim() || "",
    model: process.env.LLM_MODEL?.trim() || "gpt-4o-mini",
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 25_000),
  },
  uploads: {
    dir:
      process.env.UPLOADS_DIR?.trim() ||
      (onServerless ? "/tmp/chef-universe-uploads" : resolve(process.cwd(), "server/.data/uploads")),
    maxBytes: num(process.env.UPLOAD_MAX_BYTES, 4_000_000),
    // Under /api so single-function deployments (Vercel) can serve photos.
    // The app also mounts the legacy /uploads path for older saved links.
    publicPath: "/api/uploads",
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },
} as const;

export type AppConfig = typeof config;
