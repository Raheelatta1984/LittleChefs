import type { IncomingMessage, ServerResponse } from "node:http";
import type express from "express";
import { createApp } from "./app.js";
import { createDatabase, migrate } from "./db/index.js";
import { seedBuiltinCatalogue } from "./db/seed.js";

/**
 * Vercel (serverless) entry point — see api/index.js + vercel.json.
 *
 * Routing contract on Vercel:
 *
 *   browser  GET /api/search?q=biryani
 *   Vercel   rewrite "/api/(.*)" -> "/api?__path=/$1"
 *   function GET /api?__path=/search&q=biryani
 *
 * A rewrite delivers the function its **destination** URL, so the requested
 * path only survives in the `__path` parameter (the client's own query string,
 * here `q=biryani`, is merged in alongside). `normalizeApiRequestUrl` turns
 * that back into `/api/search?q=biryani` before Express routes it.
 *
 * It also copes with the other two shapes the platform has been observed to
 * hand a function — the untouched original URL (`/api/search?q=…`) and the
 * bare function path (`/api/index/search?q=…`) — so routing is correct
 * whichever way Vercel behaves, and identical when called directly (tests,
 * `npm run dev`).
 *
 * The database, migrations and built-in seed run once per cold start and the
 * Express app is then reused for every invocation on that instance. Failures
 * return JSON — never a bare platform 404.
 */

let appPromise: Promise<express.Express> | null = null;

/** Query parameter vercel.json uses to carry the original path through a rewrite. */
export const REWRITE_PATH_PARAM = "__path";

/** The `/api` mount every Express route in server/app.ts is registered under. */
const API_MOUNT = "/api";

function withQuery(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function normalizeApiRequestUrl(url: string | undefined): string {
  const requestUrl = url && url.length > 0 ? url : "/";
  const queryIndex = requestUrl.indexOf("?");
  const rawPath = queryIndex < 0 ? requestUrl : requestUrl.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex < 0 ? "" : requestUrl.slice(queryIndex + 1));

  // Case 1: vercel.json rewrote /api/<path> to /api?__path=/<path>.
  const rewrittenPath = params.get(REWRITE_PATH_PARAM);
  if (rewrittenPath !== null) {
    params.delete(REWRITE_PATH_PARAM);
    const captured = rewrittenPath === "" ? "/" : rewrittenPath;
    const pathname = captured.startsWith("/") ? captured : `/${captured}`;
    return withQuery(`${API_MOUNT}${pathname}`, params);
  }

  // Case 2: the platform kept the original URL. Only the function's own
  // `/api/index` path needs trimming back to its `/api` mount.
  let pathname = rawPath || "/";
  if (pathname === `${API_MOUNT}/index`) {
    pathname = API_MOUNT;
  } else if (pathname.startsWith(`${API_MOUNT}/index/`)) {
    pathname = `${API_MOUNT}${pathname.slice(`${API_MOUNT}/index`.length)}`;
  }

  // Case 3: the platform stripped the `/api` prefix entirely.
  if (pathname !== API_MOUNT && !pathname.startsWith(`${API_MOUNT}/`)) {
    pathname = `${API_MOUNT}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  }

  return withQuery(pathname, params);
}

function getApp(): Promise<express.Express> {
  if (!appPromise) {
    appPromise = (async () => {
      const db = await createDatabase();
      await migrate(db);
      if (process.env.SEED_BUILTINS !== "false") {
        await seedBuiltinCatalogue(db);
      }
      return createApp(db);
    })();
    // A failed cold start should be retried on the next request, not cached forever.
    appPromise.catch(() => {
      appPromise = null;
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    req.url = normalizeApiRequestUrl(req.url);
    app(req, res);
  } catch (error) {
    console.error("[api] failed to start", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: "server_error",
          message: "The recipe kitchen failed to start. Please try again in a few seconds.",
        }),
      );
    }
  }
}
