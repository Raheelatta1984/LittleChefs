import { Router } from "express";
import type { Database } from "../db/index.js";
import { ApiError } from "../lib/errors.js";
import { createChefSchema, parseBody, signInSchema } from "../lib/schemas.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  CHEF_SELECT, createSession, hashPin, hashToken, listRoles, toProfile, verifyPin,
  type ChefRow,
} from "../lib/auth.js";
import { requireChef } from "../lib/auth.js";

const POINTS_PER_RECIPE = 50;

export function authRoutes(db: Database): Router {
  const router = Router();
  const limit = rateLimit({ windowMs: 10 * 60_000, max: 40, name: "auth" });

  router.get("/roles", async (_req, res, next) => {
    try {
      res.json({ roles: await listRoles(db) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/chefs", limit, async (req, res, next) => {
    try {
      const body = parseBody(createChefSchema, req.body);
      const existing = await db.query<{ id: string }>(
        `select id from chefs where lower(display_name) = lower($1) and role_id = $2`,
        [body.displayName, body.role],
      );
      if (existing.rows[0]) {
        throw ApiError.conflict(
          "That chef name is already taken for this role. Pick another name, or sign in instead.",
        );
      }

      const pinHash = body.pin ? await hashPin(body.pin) : null;
      const created = await db.query<{ id: string }>(
        `insert into chefs (display_name, role_id, avatar, pin_hash) values ($1,$2,$3,$4) returning id`,
        [body.displayName, body.role, body.avatar ?? null, pinHash],
      );
      const chefId = created.rows[0].id;
      const session = await createSession(db, chefId);
      const row = await db.query<ChefRow>(`${CHEF_SELECT} where c.id = $1`, [chefId]);

      res.status(201).json({ chef: toProfile(row.rows[0]), token: session.token, expiresAt: session.expiresAt });
    } catch (error) {
      next(error);
    }
  });

  router.post("/chefs/sign-in", limit, async (req, res, next) => {
    try {
      const body = parseBody(signInSchema, req.body);
      const rows = await db.query<ChefRow & { pin_hash: string | null }>(
        `${CHEF_SELECT.replace("select c.id", "select c.id, c.pin_hash")}
          where lower(c.display_name) = lower($1) and c.role_id = $2
          order by c.created_at`,
        [body.displayName, body.role],
      );

      if (rows.rows.length === 0) {
        throw ApiError.unauthorized("No chef with that name and role yet. Create a chef profile first.");
      }

      let match: (typeof rows.rows)[number] | undefined;
      if (rows.rows.length === 1) {
        const candidate = rows.rows[0];
        const ok = await verifyPin(body.pin ?? "", candidate.pin_hash);
        if (!ok) throw ApiError.unauthorized("That PIN does not match. Try again.");
        match = candidate;
      } else {
        for (const candidate of rows.rows) {
          if (await verifyPin(body.pin ?? "", candidate.pin_hash)) {
            match = candidate;
            break;
          }
        }
        if (!match) {
          throw ApiError.unauthorized("That name matches more than one chef — check your PIN.");
        }
      }

      const session = await createSession(db, match.id);
      res.json({ chef: toProfile(match), token: session.token, expiresAt: session.expiresAt });
    } catch (error) {
      next(error);
    }
  });

  router.post("/chefs/sign-out", async (req, res, next) => {
    try {
      const header = req.header("authorization") ?? "";
      const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
      if (token) {
        await db.query(`delete from chef_sessions where token_hash = $1`, [hashToken(token)]);
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const row = await db.query<ChefRow>(`${CHEF_SELECT} where c.id = $1`, [chef.id]);
      if (!row.rows[0]) throw ApiError.unauthorized();
      res.json({ chef: toProfile(row.rows[0]) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/me", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const avatar = typeof req.body?.avatar === "string" ? req.body.avatar.slice(0, 120) : null;
      const name = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 40) : null;
      const pin = typeof req.body?.pin === "string" ? req.body.pin : null;

      if (name !== null && name.length < 2) throw ApiError.badRequest("Chef names need at least 2 letters.");
      if (pin !== null && !/^\d{4}$/.test(pin)) throw ApiError.badRequest("A PIN must be exactly 4 digits.");

      await db.withChef(chef.id, async (tx) => {
        await tx.query(
          `update chefs set
             display_name = coalesce($2, display_name),
             avatar = coalesce($3, avatar)
           where id = $1`,
          [chef.id, name, avatar],
        );
        if (pin !== null) {
          await tx.query(`update chefs set pin_hash = $2 where id = $1`, [chef.id, await hashPin(pin)]);
        }
      });

      const row = await db.query<ChefRow>(`${CHEF_SELECT} where c.id = $1`, [chef.id]);
      res.json({ chef: toProfile(row.rows[0]) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Fair-play points: the server decides whether a recipe is new for this chef,
   * so points cannot be farmed by replaying the same dish.
   */
  router.post("/me/cook-completion", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const recipeTitle = typeof req.body?.recipeTitle === "string" ? req.body.recipeTitle.trim().slice(0, 140) : "";
      if (!recipeTitle) throw ApiError.badRequest("Which recipe did you cook?");

      const outcome = await db.withChef(chef.id, async (tx) => {
        const current = await tx.query<{ awarded_recipes: string[]; points: number }>(
          `select awarded_recipes, points from chefs where id = $1`,
          [chef.id],
        );
        const row = current.rows[0];
        if (!row) throw ApiError.unauthorized();
        if (row.awarded_recipes.includes(recipeTitle)) {
          return { awarded: false, points: Number(row.points) };
        }
        const updated = await tx.query<{ points: number }>(
          `update chefs set points = points + $2, awarded_recipes = array_append(awarded_recipes, $3)
            where id = $1 returning points`,
          [chef.id, POINTS_PER_RECIPE, recipeTitle],
        );
        return { awarded: true, points: Number(updated.rows[0].points) };
      });

      res.json({ ...outcome, pointsPerRecipe: POINTS_PER_RECIPE });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
