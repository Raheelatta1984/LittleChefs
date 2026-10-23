import type { IncomingMessage, ServerResponse } from "node:http";
import type express from "express";
import { createApp } from "./app.js";
import { createDatabase, migrate } from "./db/index.js";
import { seedBuiltinCatalogue } from "./db/seed.js";

/**
 * Vercel (serverless) entry point — see api/[...path].js + vercel.json.
 *
 * The database, migrations and built-in seed run once per cold start and the
 * Express app is then reused for every invocation on that instance. Without
 * this file the Vercel deployment is static-only and every /api/* call 404s
 * (the "Something went wrong (404)" bug). Failures return JSON — never a
 * bare platform 404.
 */

let appPromise: Promise<express.Express> | null = null;

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
