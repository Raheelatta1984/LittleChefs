import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import type { Database, Queryable } from "../db/index.js";
import type { ChefProfile, RoleId, Role } from "../../shared/types.js";
import { ApiError } from "./errors.js";
import { config } from "../config.js";
import { TtlCache, cachedLoad } from "./cache.js";

const scrypt = promisify(scryptCb);

const PIN_PATTERN = /^\d{4}$/;

export const SESSION_COOKIE_NAME = config.env === "production" ? "__Host-session" : "session";

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.auth.sessionDays * 86_400_000,
  };
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

function cookieValue(req: Request, name: string): string {
  const header = req.header("cookie") ?? "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

export async function hashPin(pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) {
    throw ApiError.badRequest("A PIN must be exactly 4 digits.");
  }
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(pin, salt, 32)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return true; // no PIN set = open profile
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scrypt(pin, salt, 32)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Session lookups run on *every* authenticated request, so a chef who taps
 * through the app used to cost one database query per tap. The profile is
 * cached per token hash (30 s by default) and unknown/expired tokens are
 * cached negatively for a shorter time, so a flood of made-up bearer tokens
 * never reaches Postgres at all.
 */
const sessionCache = new TtlCache<ChefRow | null>({
  name: "sessions",
  max: config.cache.maxEntries,
  ttlMs: config.cache.sessionTtlMs,
});

/** Drops a cached session (sign-out, profile edit, revoked token). */
export function forgetSession(token: string | undefined): void {
  if (!token) return;
  sessionCache.delete(`token:${hashToken(token)}`);
}

export async function createSession(db: Database, chefId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.auth.sessionDays * 86_400_000).toISOString();
  const tokenHash = hashToken(token);
  await db.query(
    `insert into chef_sessions (token_hash, chef_id, expires_at) values ($1, $2, $3)`,
    [tokenHash, chefId, expiresAt],
  );
  sessionCache.delete(`token:${tokenHash}`);
  return { token, expiresAt };
}

export type ChefRow = {
  id: string;
  display_name: string;
  role_id: RoleId;
  avatar: string | null;
  points: number;
  can_publish: boolean;
  requires_grownup: boolean;
  max_batch_servings: number;
  label: string;
  emoji: string;
};

export const CHEF_SELECT = `
  select c.id, c.display_name, c.role_id, c.avatar, c.points,
         r.label, r.emoji, r.can_publish, r.requires_grownup, r.max_batch_servings
  from chefs c join roles r on r.id = c.role_id
`;

export function toProfile(row: ChefRow): ChefProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role_id,
    roleLabel: row.label,
    roleEmoji: row.emoji,
    avatar: row.avatar,
    points: Number(row.points),
    canPublish: Boolean(row.can_publish),
    requiresGrownup: Boolean(row.requires_grownup),
    maxBatchServings: Number(row.max_batch_servings),
  };
}

export async function findChefByToken(db: Database, token: string): Promise<ChefRow | null> {
  const hash = hashToken(token);
  const key = `token:${hash}`;

  const load = async (): Promise<ChefRow | null> => {
    const result = await db.query<ChefRow>(
      `${CHEF_SELECT} join chef_sessions s on s.chef_id = c.id
       where s.token_hash = $1 and s.expires_at > now()`,
      [hash],
    );
    return result.rows[0] ?? null;
  };

  if (!config.cache.enabled) return load();

  const cached = sessionCache.get(key);
  if (cached !== undefined) return cached;

  return cachedLoad(sessionCache, key, load, {
    ttlMs: config.cache.sessionTtlMs,
    negativeTtlMs: config.cache.sessionNegativeTtlMs,
    cacheNegative: (row) => row === null,
  });
}

/** Roles are static reference data — cached because every client fetches them on boot. */
const rolesCache = new TtlCache<Role[]>({
  name: "roles",
  max: 4,
  ttlMs: config.cache.rolesTtlMs,
});

export async function listRoles(db: Database): Promise<Role[]> {
  if (!config.cache.enabled) return queryRoles(db);
  return cachedLoad(rolesCache, "all", () => queryRoles(db));
}

async function queryRoles(db: Database): Promise<Role[]> {
  const result = await db.query<{
    id: RoleId; label: string; ages: string; emoji: string; rank: number; description: string;
    can_publish: boolean; requires_grownup: boolean; max_batch_servings: number;
  }>("select * from roles order by rank");
  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    ages: row.ages,
    emoji: row.emoji,
    rank: row.rank,
    description: row.description,
    canPublish: row.can_publish,
    requiresGrownup: row.requires_grownup,
    maxBatchServings: row.max_batch_servings,
  }));
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      chef?: ChefProfile;
      db?: Database;
      token?: string;
      authTransport?: "bearer" | "cookie";
    }
  }
}

export function attachDb(db: Database) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.db = db;
    next();
  };
}

/** Populates req.chef from an explicit bearer token or the browser's HttpOnly cookie. */
export function optionalChef(db: Database) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.header("authorization") ?? "";
      const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
      const cookie = cookieValue(req, SESSION_COOKIE_NAME);
      const token = bearer || cookie;
      if (token) {
        const row = await findChefByToken(db, token);
        if (row) {
          req.chef = toProfile(row);
          req.token = token;
          req.authTransport = bearer ? "bearer" : "cookie";
          req.db = db;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireChef(req: Request): ChefProfile {
  if (!req.chef) throw ApiError.unauthorized();
  return req.chef;
}

/** Helper type guard for query results scoped to a chef. */
export type ChefTx = (chefId: string, fn: (tx: Queryable) => Promise<unknown>) => Promise<unknown>;
