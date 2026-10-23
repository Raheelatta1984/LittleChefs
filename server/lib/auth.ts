import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import type { Database, Queryable } from "../db/index.js";
import type { ChefProfile, RoleId, Role } from "../../shared/types.js";
import { ApiError } from "./errors.js";
import { config } from "../config.js";

const scrypt = promisify(scryptCb);

const PIN_PATTERN = /^\d{4}$/;

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

export async function createSession(db: Database, chefId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.auth.sessionDays * 86_400_000).toISOString();
  await db.query(
    `insert into chef_sessions (token_hash, chef_id, expires_at) values ($1, $2, $3)`,
    [hashToken(token), chefId, expiresAt],
  );
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
  const result = await db.query<ChefRow>(
    `${CHEF_SELECT} join chef_sessions s on s.chef_id = c.id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hash],
  );
  return result.rows[0] ?? null;
}

export async function listRoles(db: Database): Promise<Role[]> {
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
    }
  }
}

export function attachDb(db: Database) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.db = db;
    next();
  };
}

/** Populates req.chef when a valid bearer token is present. */
export function optionalChef(db: Database) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.header("authorization") ?? "";
      const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
      if (token) {
        const row = await findChefByToken(db, token);
        if (row) {
          req.chef = toProfile(row);
          req.token = token;
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
