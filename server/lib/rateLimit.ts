import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { TtlCache } from "./cache.js";

type Bucket = { tokens: number; updatedAt: number };

export type RateLimitOptions = {
  /** Bucket namespace — route groups must not share one. */
  name: string;
  /** Window over which `max` requests are allowed. */
  windowMs: number;
  /** Requests allowed per window (also the bucket size). */
  max: number;
  /** Override the caller identity (defaults to IP, or the signed-in chef). */
  keyGenerator?: (req: Request) => string;
  /** Requests that should never be counted (health checks, preflights…). */
  skip?: (req: Request) => boolean;
  /** How many distinct callers to remember before evicting the least recent. */
  maxEntries?: number;
  message?: string;
  /** Send `RateLimit-*` headers on every response (default true). */
  headers?: boolean;
};

/**
 * Token-bucket rate limiter.
 *
 * Why not the old fixed window? A fixed window lets a caller fire `max`
 * requests at 09:59:59 and another `max` at 10:00:00 — double the intended
 * load exactly when the server is already busy. A token bucket refills
 * smoothly, so bursts are still allowed (kids tapping "search" a few times)
 * but sustained hammering is capped.
 *
 * State lives in a bounded LRU+TTL map, so a flood of unique IPs cannot grow
 * memory without limit and buckets that go quiet disappear on their own —
 * there is no interval timer (important on serverless).
 */
export function rateLimit(options: RateLimitOptions) {
  const buckets = new TtlCache<Bucket>({
    name: `rate-limit:${options.name}`,
    max: options.maxEntries ?? 10_000,
    // A bucket that has been idle for two windows is full again anyway.
    ttlMs: options.windowMs * 2,
  });
  const refillPerMs = options.max / options.windowMs;
  const includeHeaders = options.headers !== false;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.rateLimit.enabled || options.skip?.(req)) {
      next();
      return;
    }

    const identity =
      options.keyGenerator?.(req) ?? req.chef?.id ?? req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const key = `${options.name}:${identity}`;
    const now = Date.now();
    const stored = buckets.get(key);
    const elapsed = stored ? Math.max(0, now - stored.updatedAt) : options.windowMs;
    const tokens = Math.min(options.max, (stored?.tokens ?? 0) + elapsed * refillPerMs);

    if (tokens < 1) {
      const retryAfterSeconds = Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000));
      buckets.set(key, { tokens, updatedAt: now });
      res.setHeader("retry-after", String(retryAfterSeconds));
      if (includeHeaders) {
        res.setHeader("ratelimit-limit", String(options.max));
        res.setHeader("ratelimit-remaining", "0");
        res.setHeader("ratelimit-reset", String(retryAfterSeconds));
      }
      res.status(429).json({
        error: "rate_limited",
        retryAfter: retryAfterSeconds,
        message:
          options.message ??
          `Too many requests. Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} and try again.`,
      });
      return;
    }

    buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    if (includeHeaders) {
      res.setHeader("ratelimit-limit", String(options.max));
      res.setHeader("ratelimit-remaining", String(Math.floor(tokens - 1)));
      res.setHeader("ratelimit-reset", String(Math.ceil((options.max - (tokens - 1)) / refillPerMs / 1000)));
    }
    next();
  };
}

/** App-wide limiter applied to every `/api` call before routing. */
export function globalRateLimit() {
  return rateLimit({
    name: "global",
    windowMs: 60_000,
    max: config.rateLimit.globalMax,
    maxEntries: 20_000,
    skip: (req) => req.path === "/health" || req.method === "OPTIONS",
  });
}
