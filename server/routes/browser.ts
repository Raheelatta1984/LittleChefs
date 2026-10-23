import { Router } from "express";
import { ApiError } from "../lib/errors.js";
import { rateLimit } from "../lib/rateLimit.js";
import { browseWebsite, browseYouTube } from "../services/browser.js";

export function browserRoutes(): Router {
  const router = Router();
  const limit = rateLimit({ windowMs: 5 * 60_000, max: 60, name: "browser" });

  router.get("/browser/navigate", limit, async (req, res, next) => {
    try {
      const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!url) throw ApiError.badRequest("Provide a website link or search query.");
      if (url.length > 2048) throw ApiError.badRequest("That link is too long.");
      const page = await browseWebsite(url);
      res.json({ page });
    } catch (error) {
      next(error);
    }
  });

  router.get("/browser/youtube", limit, async (req, res, next) => {
    try {
      const query =
        (typeof req.query.q === "string" && req.query.q.trim()) ||
        (typeof req.query.url === "string" && req.query.url.trim()) ||
        "";
      if (!query) throw ApiError.badRequest("Provide a YouTube search query, channel or video link.");
      if (query.length > 2048) throw ApiError.badRequest("That query is too long.");
      const page = await browseYouTube(query);
      res.json({ page });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
