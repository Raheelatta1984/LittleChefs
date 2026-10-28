import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Database } from "./db/index.js";
import { config } from "./config.js";
import { optionalChef } from "./lib/auth.js";
import { cacheStats } from "./lib/cache.js";
import { ApiError } from "./lib/errors.js";
import { globalRateLimit } from "./lib/rateLimit.js";
import { catalogueIndexSnapshot } from "./services/catalogueIndex.js";
import { authRoutes } from "./routes/auth.js";
import { recipeRoutes } from "./routes/recipes.js";
import { importRoutes } from "./routes/import.js";
import { catalogueRoutes } from "./routes/catalogue.js";
import { uploadRoutes } from "./routes/uploads.js";
import { browserRoutes } from "./routes/browser.js";
import type { ImportRouteDeps } from "./routes/import.js";

/** Injectable externals (network + OCR) — production uses the real ones. */
export type AppDeps = ImportRouteDeps;

const CSP_ENFORCED = "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://images.pexels.com https://i.ytimg.com",
  "font-src 'self'",
  "connect-src 'self' https://www.themealdb.com",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestOrigin(req: Request): string {
  return config.auth.appOrigin || `${req.protocol}://${req.get("host") ?? ""}`;
}

function sourceOrigin(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export function createApp(db: Database, deps: AppDeps = {}): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("content-security-policy", CSP_ENFORCED);
    res.setHeader("content-security-policy-report-only", CSP_REPORT_ONLY);
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (config.env === "production" && req.secure) {
      res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(express.json({ limit: "8mb" }));

  // Same-origin browser calls need no CORS. Cross-origin access is opt-in and
  // exact-match only; an empty allowlist deliberately emits no CORS headers.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    if (origin && config.cors.origins.includes(origin)) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
      res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("access-control-allow-headers", "content-type, authorization");
      res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("access-control-expose-headers", "retry-after, ratelimit-limit, ratelimit-remaining, ratelimit-reset");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(origin && config.cors.origins.includes(origin) ? 204 : 403);
      return;
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.setHeader("cache-control", "no-store");
    res.json({
      ok: true,
      driver: config.db.driver,
      llm: Boolean(config.llm.apiKey),
      time: new Date().toISOString(),
      // Cheap, detail-free insight into the load-shedding layer.
      cache: config.cache.enabled ? cacheStats() : { caches: [], entries: 0, hitRate: 0 },
      catalogueIndex: catalogueIndexSnapshot(),
      rateLimit: { enabled: config.rateLimit.enabled, globalMaxPerMinute: config.rateLimit.globalMax },
    });
  });

  const chef = optionalChef(db);
  // Authenticate first so the limiter can key signed-in chefs by identity
  // (several kids behind one home router should not share a single bucket).
  app.use("/api", chef);
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.chef) res.setHeader("cache-control", "no-store");
    if (req.authTransport !== "cookie" || !UNSAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const supplied = sourceOrigin(req.header("origin") ?? req.header("referer"));
    const allowed = new Set([requestOrigin(req), ...config.cors.origins]);
    if (!supplied || !allowed.has(supplied)) {
      res.status(403).json({ error: "csrf_rejected", message: "Request origin is not allowed." });
      return;
    }
    next();
  });
  app.use("/api", globalRateLimit());
  app.use("/api", authRoutes(db));
  app.use("/api", catalogueRoutes(db));
  app.use("/api", recipeRoutes(db));
  app.use("/api", importRoutes(db, deps));
  app.use("/api", browserRoutes(deps));
  app.use("/api", uploadRoutes(db));

  // Locally uploaded photos. Served under /api/uploads so single-function
  // deployments (Vercel api/index.js) can serve them too; the legacy
  // /uploads mount keeps previously saved photo links working locally.
  app.use(config.uploads.publicPath, express.static(config.uploads.dir, { maxAge: "7d" }));
  if ((config.uploads.publicPath as string) !== "/uploads") {
    app.use("/uploads", express.static(config.uploads.dir, { maxAge: "7d" }));
  }

  // Serve the built single-file app when it exists (npm run build && npm start).
  const dist = resolve(process.cwd(), "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(["/docs", "/swagger", "/swagger-ui", "/graphql", "/redoc", "/__debug__"], (_req, res) => {
      res.status(404).json({ error: "not_found", message: "Not found." });
    });
    app.get(/^\/(?!api|uploads).*/, (_req, res) => {
      res.sendFile(resolve(dist, "index.html"));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", message: `No route for ${req.method} ${req.path}` });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.code, message: error.message, details: error.details });
      return;
    }
    const typed = error as { status?: number; code?: string; message?: string };
    if (typed?.status === 400) {
      res.status(400).json({ error: typed.code ?? "bad_request", message: typed.message ?? "Invalid request." });
      return;
    }
    console.error("[api] unhandled error", error);
    res.status(500).json({
      error: "server_error",
      message: "Something went wrong in the kitchen. Please try again.",
    });
  });

  return app;
}
