import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Database } from "./db/index.js";
import { config } from "./config.js";
import { optionalChef } from "./lib/auth.js";
import { ApiError } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { recipeRoutes } from "./routes/recipes.js";
import { importRoutes } from "./routes/import.js";
import { catalogueRoutes } from "./routes/catalogue.js";
import { uploadRoutes } from "./routes/uploads.js";

export function createApp(db: Database): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "8mb" }));

  // The built app is a single static file; allow any origin for the API so the
  // Vite dev/preview host, Vercel preview and local file all work. Tighten with
  // CORS_ORIGINS in production if you want a strict allow-list.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    const allowed =
      config.cors.origins.length === 0 || (origin && config.cors.origins.includes(origin));
    if (allowed && origin) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
      res.setHeader("access-control-allow-credentials", "true");
    }
    res.setHeader("access-control-allow-headers", "content-type, authorization");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      driver: config.db.driver,
      llm: Boolean(config.llm.apiKey),
      time: new Date().toISOString(),
    });
  });

  const chef = optionalChef(db);
  app.use("/api", chef);
  app.use("/api", authRoutes(db));
  app.use("/api", catalogueRoutes(db));
  app.use("/api", recipeRoutes(db));
  app.use("/api", importRoutes(db));
  app.use("/api", uploadRoutes(db));

  // Locally uploaded photos.
  app.use(config.uploads.publicPath, express.static(config.uploads.dir, { maxAge: "7d" }));

  // Serve the built single-file app when it exists (npm run build && npm start).
  const dist = resolve(process.cwd(), "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
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
