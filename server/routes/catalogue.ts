import { Router } from "express";
import type { Database } from "../db/index.js";
import { requireChef } from "../lib/auth.js";
import { ApiError } from "../lib/errors.js";
import type { CatalogueListRow } from "../services/catalogue.js";
import { catalogueIdsInChefBook, listCatalogueRecipes } from "../services/catalogue.js";
import { loadCatalogueRecipe } from "../services/recipes.js";

/**
 * Shared canonical catalogue. Contains ONLY public/first-party recipe content —
 * never the chef who imported it, never personal notes or photos.
 *
 * Both endpoints are cached and read-through:
 *   • the catalogue rows themselves are chef-independent, so they are shared by
 *     every chef (and keyed only by the search term + limit);
 *   • "do I own this?" is a small per-chef id set rather than a correlated
 *     subquery inside the list query;
 *   • a recipe that does not exist is remembered briefly (negative cache), so a
 *     stale link costs zero queries on the next open.
 */
export function catalogueRoutes(db: Database): Router {
  const router = Router();

  router.get("/catalogue", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const query = String(req.query.q ?? "").trim().slice(0, 120);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 24) || 24));

      const [rows, ownedIds] = await Promise.all([
        listCatalogueRecipes(db, query, limit),
        catalogueIdsInChefBook(db, chef.id),
      ]);
      const owned = new Set(ownedIds);

      res.setHeader("cache-control", "private, max-age=15, stale-while-revalidate=45");
      res.json({
        recipes: rows.map((row: CatalogueListRow) => ({
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
          inMyBook: owned.has(row.id),
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
      res.setHeader("cache-control", "private, max-age=60, stale-while-revalidate=120");
      res.json({ recipe });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
