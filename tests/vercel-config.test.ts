import "./setup.js";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Guards the Vercel wiring that makes the API reachable in production.
 *
 * Both halves are required and both have been wrong before:
 *  - a single flat function (api/index.js) that Vercel definitely routes, and
 *  - an explicit /api/(.*) rewrite that sends every depth of path to it,
 *    carrying the real path in __path because a rewrite hands the function its
 *    destination URL rather than the requested one.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vercelConfig = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
  framework?: unknown;
  buildCommand?: string;
  outputDirectory?: string;
  rewrites?: { source?: string; destination?: string }[];
  functions?: Record<string, unknown>;
};

describe("vercel.json routes every /api/* path to the serverless function", () => {
  it("has exactly one function file, so the app and its database live in one instance", () => {
    const functionFiles = readdirSync(resolve(root, "api")).filter((file) => /\.(?:js|mjs|cjs|ts)$/.test(file));
    assert.deepEqual(functionFiles, ["index.js"], "api/ must contain only the single index.js function");
  });

  it("rewrites /api/(.*) to the function with the path preserved in __path", () => {
    const rewrites = vercelConfig.rewrites ?? [];
    const apiRewrite = rewrites.find(
      (rule) => rule.source === "/api/(.*)" && rule.destination === "/api?__path=/$1",
    );
    assert.ok(apiRewrite, "vercel.json needs the /api/(.*) -> /api?__path=/$1 rewrite");
  });

  it("applies the API rewrite before the single-page-app fallback", () => {
    const rewrites = vercelConfig.rewrites ?? [];
    assert.equal(rewrites[0]?.source, "/api/(.*)", "the API rewrite must be first");
    const spaFallback = rewrites.find((rule) => rule.destination === "/index.html");
    assert.ok(spaFallback, "deep links should fall back to the built single-page app");
    assert.match(String(spaFallback?.source), /\(\?!api/, "the SPA fallback must not swallow /api requests");
  });

  it("attaches the function settings to api/index.js", () => {
    assert.ok(vercelConfig.functions?.["api/index.js"], "functions should configure api/index.js");
    assert.equal(vercelConfig.framework, null, "framework must stay null so the dashboard preset cannot change the build");
    assert.equal(vercelConfig.outputDirectory, "dist");
    assert.match(String(vercelConfig.buildCommand), /npm run build/);
  });
});
