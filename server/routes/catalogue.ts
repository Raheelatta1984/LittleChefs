import { Router } from "express";
import type { Database } from "../db/index.js";
import { requireChef } from "../lib/auth.js";
import { ApiError } from "../lib/errors.js";
import { loadCatalogueRecipe } from "../services/recipes.js";

/**
 * Shared canonical catalogue. Contains ONLY public/first-party recipe content —
 * never the chef who imported it, never personal notes or photos.
 */
export function catalogueRoutes(db: Database): Router {
  const router = Router();

  router.get("/catalogue", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const query = String(req.query.q ?? "").trim().slice(0, 120);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 24) || 24));
      const pattern = `%${query.toLowerCase()}%`;

      const rows = await db.query<{
        id: string; title: string; cuisine: string | null; hero_image_url: string | null;
        base_servings: number; total_minutes: number | null; source_type: string;
        ingredient_count: string; step_count: string;
        in_my_book: string;
      }>(
        `select c.id, c.title, c.cuisine, c.hero_image_url, c.base_servings, c.total_minutes, c.source_type,
                (select count(*) from catalogue_ingredients i where i.catalogue_id = c.id) as ingredient_count,
                (select count(*) from catalogue_steps s where s.catalogue_id = c.id) as step_count,
                (select count(*) from chef_recipes r where r.chef_id = $2 and r.catalogue_id = c.id) as in_my_book
           from catalogue_recipes c
          where ($1 = '%%' or lower(c.title) like $1)
          order by c.created_at desc
          limit $3`,
        [pattern, chef.id, limit],
      );

      res.json({
        recipes: rows.rows.map((row) => ({
          id: row.id,
          catalogueId: row.id,
          title: row.title,
          cuisine: row.cuisine,
          heroImageUrl: row.hero_image_url,
          baseServings: Number(row.base_servings),
          totalMinutes: row.total_minutes === null ? null : Number(row.total_minutes),
          sourceType: row.source_type,
          ingredientCount: Number(row.ingredient_count),
          stepCount: Number(row.step_count),
          inMyBook: Number(row.in_my_book) > 0,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/catalogue/:id", async (req, res, next) => {
    try {
      requireChef(req);
      const recipe = await loadCatalogueRecipe(db, req.params.id);
      if (!recipe) throw ApiError.notFound("That shared recipe does not exist.");
      res.json({ recipe });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
