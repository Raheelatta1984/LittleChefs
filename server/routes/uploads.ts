import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Router } from "express";
import type { Database } from "../db/index.js";
import { config } from "../config.js";
import { requireChef } from "../lib/auth.js";
import { ApiError } from "../lib/errors.js";
import { rateLimit } from "../lib/rateLimit.js";

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Stores dish/step photos the chef takes while cooking. */
export function uploadRoutes(_db: Database): Router {
  const router = Router();
  const limit = rateLimit({ windowMs: 10 * 60_000, max: 40, name: "uploads" });

  router.post("/uploads", limit, async (req, res, next) => {
    try {
      requireChef(req);
      const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
      const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/i);
      if (!match) throw ApiError.badRequest("Send an image as a data URL (png, jpg or webp).");

      const [, mime, base64] = match;
      const extension = ALLOWED[mime.toLowerCase()];
      if (!extension) throw ApiError.badRequest("Only png, jpg and webp images can be uploaded.");

      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > config.uploads.maxBytes) {
        throw ApiError.tooLarge("That photo is too big — please keep it under 4 MB.");
      }
      if (buffer.byteLength < 64) throw ApiError.badRequest("That image looks empty.");

      await mkdir(config.uploads.dir, { recursive: true });
      const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
      await writeFile(join(config.uploads.dir, filename), buffer);

      res.status(201).json({ url: `${config.uploads.publicPath}/${filename}`, bytes: buffer.byteLength });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
