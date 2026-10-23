// Build-time guard for the Vercel deployment.
//
// The production 404 bug ("The recipe kitchen isn't responding (404)") happens
// when the static app ships WITHOUT the /api serverless function: every
// /api/* call then hits Vercel's platform 404 instead of the Express API.
// That can happen silently when the Vercel project's Build Command in the
// dashboard overrides vercel.json and only runs the Vite build.
//
// `npm run build` now always compiles the API as well, and this script runs
// at the end of the build: if any piece of the API function is missing, the
// build FAILS LOUDLY (Vercel keeps the previous working deployment live)
// instead of shipping a broken static-only site.
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function requireFile(rel, why) {
  if (!existsSync(resolve(root, rel))) problems.push(`missing ${rel} — ${why}`);
}

requireFile("dist/index.html", "the Vite single-file app was not built (vite build).");
requireFile(
  "api/[...path].js",
  "the Vercel catch-all function is gone, so /api/* would 404 in production.",
);
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

if (problems.length > 0) {
  console.error("\n[verify-api-build] Refusing to ship a broken deployment:");
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(
    "\nFix: run `npm run build` (it builds the app AND the API). " +
      "On Vercel, make sure no dashboard Build Command override replaces it with a static-only build.\n",
  );
  process.exit(1);
}

console.log(
  `[verify-api-build] OK — static app + /api function + ${migrations.length} migration(s) are all in the build.`,
);
