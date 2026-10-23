import { Router } from "express";
import type { Database } from "../db/index.js";
import { ApiError } from "../lib/errors.js";
import { requireChef } from "../lib/auth.js";
import { draftSchema, onboardingSchema, parseBody } from "../lib/schemas.js";
import {
  claimCatalogueRecipe, deleteChefRecipe, findInternalMatches, insertChefRecipe,
  listChefRecipes, loadChefRecipe, updateChefRecipe,
} from "../services/recipes.js";
import { normaliseDishName } from "../services/normalise.js";
import { runOnboarding, getShoppingList, toggleShoppingItem, completeShoppingList } from "../services/onboarding.js";
import type { RecipeDraft } from "../../shared/types.js";

export function recipeRoutes(db: Database): Router {
  const router = Router();

  router.get("/search", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const query = String(req.query.q ?? "").trim().slice(0, 200);
      if (!query) throw ApiError.badRequest("Type a dish name to search.");

      const { myRecipes, sharedMatches } = await findInternalMatches(db, chef.id, query);
      res.json({
        query,
        normalisedQuery: normaliseDishName(query),
        myRecipes,
        sharedMatches,
        needsOnboarding: myRecipes.length === 0 && sharedMatches.length === 0,
        message:
          myRecipes.length > 0
            ? "Found in your own recipe book."
            : sharedMatches.length > 0
              ? "Found in the shared recipe catalogue — we can copy it into your book instantly."
              : "Nothing internal yet. AI onboarding can import it from a website or YouTube.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/recipes", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const recipes = await db.withChef(chef.id, (tx) => listChefRecipes(tx));
      res.json({ recipes });
    } catch (error) {
      next(error);
    }
  });

  router.get("/recipes/:id", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const recipe = await db.withChef(chef.id, (tx) => loadChefRecipe(tx, req.params.id));
      if (!recipe) throw ApiError.notFound("That recipe is not in your book.");
      res.json({ recipe });
    } catch (error) {
      next(error);
    }
  });

  router.post("/recipes", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const draft = parseBody(draftSchema, req.body) as RecipeDraft;
      const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 2000) : null;
      if (draft.ingredients.length === 0 || draft.steps.length === 0) {
        throw ApiError.badRequest("A recipe needs at least one ingredient and one step.");
      }

      const recipeId = await db.withChef(chef.id, (tx) =>
        insertChefRecipe(tx, chef.id, { ...draft, sourceType: draft.sourceType ?? "manual" }, null, notes),
      );
      const recipe = await db.withChef(chef.id, (tx) => loadChefRecipe(tx, recipeId));
      res.status(201).json({ recipe });
    } catch (error) {
      next(error);
    }
  });

  router.put("/recipes/:id", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const draft = parseBody(draftSchema, req.body) as RecipeDraft;
      const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 2000) : null;

      const recipe = await db.withChef(chef.id, async (tx) => {
        const existing = await loadChefRecipe(tx, req.params.id);
        if (!existing) throw ApiError.notFound("That recipe is not in your book.");
        return updateChefRecipe(tx, req.params.id, draft, notes);
      });
      if (!recipe) throw ApiError.notFound("That recipe is not in your book.");
      res.json({ recipe });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/recipes/:id", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const removed = await db.withChef(chef.id, (tx) => deleteChefRecipe(tx, req.params.id));
      if (!removed) throw ApiError.notFound("That recipe is not in your book.");
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/recipes/:id/onboarding", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const answers = parseBody(onboardingSchema, req.body);
      const result = await runOnboarding(db, chef, req.params.id, {
        servings: answers.servings,
        mealOccasion: answers.mealOccasion as never,
        dietary: answers.dietary ?? [],
        pantry: answers.pantry ?? [],
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/catalogue/:id/claim", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const { recipeId, alreadyOwned } = await claimCatalogueRecipe(db, chef.id, req.params.id);
      const recipe = await db.withChef(chef.id, (tx) => loadChefRecipe(tx, recipeId));
      res.status(alreadyOwned ? 200 : 201).json({ recipe, alreadyOwned });
    } catch (error) {
      if (error instanceof Error && error.message === "catalogue recipe not found") {
        next(ApiError.notFound("That shared recipe is no longer available."));
        return;
      }
      next(error);
    }
  });

  router.get("/shopping-lists/:id", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      res.json({ list: await getShoppingList(db, chef.id, req.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/shopping-lists/:id/items/:itemId", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const checked = Boolean(req.body?.checked);
      const list = await toggleShoppingItem(db, chef.id, req.params.id, req.params.itemId, checked);
      res.json({ list });
    } catch (error) {
      next(error);
    }
  });

  router.post("/shopping-lists/:id/complete", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      res.json({ list: await completeShoppingList(db, chef.id, req.params.id) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
