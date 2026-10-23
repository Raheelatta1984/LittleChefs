// Build-time guard for the Vercel deployment.
//
// Two different production 404s have shipped from this repo:
//  1. the static app was deployed WITHOUT the API function at all, and
//  2. the API function existed but every /api/* path still missed it, because
//     `api/[...path].js` is only a SINGLE-segment route on Vercel — nested
//     paths such as /api/chefs/sign-in or /api/recipes/:id answered with the
//     platform's bare 404 ("The recipe kitchen isn't responding (404)").
//
// `npm run build` compiles the app and the API, and this script runs last. It
// checks the built artefacts, the vercel.json wiring that makes the function
// reachable, and finally imports the COMPILED function to prove it rebuilds the
// real /api/... path from the rewrite's __path parameter. If any check fails
// the build fails loudly and Vercel keeps the previous working deployment live
// instead of shipping another broken static-only (or unreachable-API) site.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function requireFile(rel, why) {
  if (!existsSync(resolve(root, rel))) problems.push(`missing ${rel} — ${why}`);
}

// ── 1. The static app ────────────────────────────────────────────────────────
requireFile("dist/index.html", "the Vite single-file app was not built (vite build).");

// ── 2. Exactly one serverless function ──────────────────────────────────────
requireFile(
  "api/index.js",
  "the Vercel function is gone, so /api/* would 404 in production.",
);
const apiDir = resolve(root, "api");
const apiFunctions = existsSync(apiDir)
  ? readdirSync(apiDir).filter((file) => /\.(?:js|mjs|cjs|ts)$/.test(file))
  : [];
if (apiFunctions.join(",") !== "index.js") {
  problems.push(
    `api/ must contain only index.js (found: ${apiFunctions.join(", ") || "nothing"}) — ` +
      "a bracketed catch-all only matches one segment, and a second function would run its own " +
      "cold start and database.",
  );
}

// ── 3. The compiled API the function imports ────────────────────────────────
requireFile(
  "dist-server/server/vercel.js",
  "the compiled API entry the function imports is missing (npm run build:api).",
);
requireFile(
  "dist-server/server/app.js",
  "the compiled Express app is missing (npm run build:api).",
);

const migrationsDir = resolve(root, "dist-server/server/db/migrations");
const migrations = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))
  : [];
if (migrations.length === 0) {
  problems.push(
    "missing dist-server/server/db/migrations/*.sql — the API could not create its database on cold start.",
  );
}

// ── 4. vercel.json must route every /api/* path to that function ────────────
let vercelConfig = null;
try {
  vercelConfig = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
} catch (error) {
  problems.push(`vercel.json is missing or invalid JSON — ${error.message}`);
}
if (vercelConfig) {
  if (vercelConfig.framework !== null) {
    problems.push("vercel.json must keep \"framework\": null so a dashboard preset cannot replace the build.");
  }
  if (vercelConfig.outputDirectory !== "dist") {
    problems.push("vercel.json must keep \"outputDirectory\": \"dist\".");
  }
  if (!String(vercelConfig.buildCommand ?? "").includes("npm run build")) {
    problems.push("vercel.json must run \"npm run build\" so the API is always compiled.");
  }
  const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];
  const apiRewrite = rewrites.find(
    (rule) => rule?.source === "/api/(.*)" && rule?.destination === "/api?__path=/$1",
  );
  if (!apiRewrite) {
    problems.push(
      'vercel.json must rewrite "/api/(.*)" to "/api?__path=/$1" — without it only the bare ' +
        "/api path reaches the function and every other endpoint 404s.",
    );
  } else if (rewrites[0] !== apiRewrite) {
    problems.push("the /api/(.*) rewrite must be the first rewrite, before any SPA fallback.");
  }
  if (!vercelConfig.functions?.["api/index.js"]) {
    problems.push('vercel.json must configure the function as "api/index.js".');
  }
}

// ── 5. Prove the compiled function rebuilds the real path ───────────────────
// This is the shape Vercel actually invokes after the rewrite above, so a
// passing check means production routing works for every API endpoint.
if (existsSync(resolve(root, "dist-server/server/vercel.js"))) {
  try {
    const compiled = await import(pathToFileURL(resolve(root, "dist-server/server/vercel.js")).href);
    const normalize = compiled.normalizeApiRequestUrl;
    if (typeof normalize !== "function") {
      problems.push("the compiled API entry does not export normalizeApiRequestUrl.");
    } else {
      const cases = [
        ["/api?__path=/health", "/api/health"],
        ["/api?__path=/search&q=biryani", "/api/search?q=biryani"],
        ["/api?__path=/chefs/sign-in", "/api/chefs/sign-in"],
        ["/api?__path=/catalogue/abc/claim", "/api/catalogue/abc/claim"],
        ["/health", "/api/health"],
        ["/api/health", "/api/health"],
      ];
      for (const [input, expected] of cases) {
        const actual = normalize(input);
        if (actual !== expected) {
          problems.push(`compiled API routing mangled "${input}" into "${actual}" (expected "${expected}").`);
        }
      }
    }
  } catch (error) {
    problems.push(`the compiled API entry could not be imported — ${error instanceof Error ? error.message : error}`);
  }
}

if (problems.length > 0) {
  console.error("\n[verify-api-build] Refusing to ship a broken deployment:");
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(
    "\nFix: run `npm run build` (it builds the app AND the API). On Vercel, make sure no " +
      "dashboard Build Command override replaces it with a static-only build.\n",
  );
  process.exit(1);
}

console.log(
  `[verify-api-build] OK — app + api/index.js function + ${migrations.length} migration(s) ` +
    "+ /api/(.*) rewrite all verified, and the compiled function rebuilds /api/... paths correctly.",
);
