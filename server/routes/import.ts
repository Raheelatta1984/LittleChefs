import { Router } from "express";
import type { Database } from "../db/index.js";
import type { ImportJobView, RecipeDraft } from "../../shared/types.js";
import { requireChef } from "../lib/auth.js";
import { ApiError } from "../lib/errors.js";
import { rateLimit } from "../lib/rateLimit.js";
import { confirmImportSchema, importSchema, parseBody } from "../lib/schemas.js";
import { classifyInput, importRecipe } from "../services/importer/index.js";
import { ensureCatalogueRecipe, insertChefRecipe } from "../services/recipes.js";
import { normaliseDishName } from "../services/normalise.js";
import { config } from "../config.js";

type ImportRow = {
  id: string; status: string; input_type: string; input_value: string; method: string | null;
  confidence: string | number | null; error_message: string | null; warnings: string[] | null;
  draft: RecipeDraft | null; chef_recipe_id: string | null; created_at: string;
};

function toJobView(row: ImportRow): ImportJobView {
  return {
    id: row.id,
    status: row.status as ImportJobView["status"],
    inputType: row.input_type as ImportJobView["inputType"],
    inputValue: row.input_value,
    method: row.method,
    confidence: row.confidence === null ? null : Number(row.confidence),
    errorMessage: row.error_message,
    warnings: row.warnings ?? [],
    draft: row.draft,
    chefRecipeId: row.chef_recipe_id,
    createdAt: row.created_at,
  };
}

export function importRoutes(db: Database): Router {
  const router = Router();
  const limit = rateLimit({ windowMs: 5 * 60_000, max: 20, name: "import" });

  router.post("/imports", limit, async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const body = parseBody(importSchema, req.body);
      const inputType = body.inputType ?? classifyInput(body.inputValue);

      const job = await db.withChef(chef.id, async (tx) => {
        const created = await tx.query<{ id: string }>(
          `insert into import_jobs (chef_id, input_type, input_value, status)
           values ($1,$2,$3,'running') returning id`,
          [chef.id, inputType, body.inputValue.slice(0, 20_000)],
        );
        return created.rows[0].id;
      });

      try {
        const outcome = await importRecipe(
          { inputType, inputValue: body.inputValue },
          { useLlm: Boolean(config.llm.apiKey) },
        );

        const updated = await db.withChef(chef.id, async (tx) => {
          const result = await tx.query<ImportRow>(
            `update import_jobs
                set status = 'review', method = $2, confidence = $3, draft = $4, warnings = $5
              where id = $1 returning *`,
            [job, outcome.method, outcome.confidence, JSON.stringify(outcome.draft), outcome.warnings],
          );
          return result.rows[0];
        });

        res.status(201).json({ job: toJobView(updated) });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "We could not read that recipe.";
        await db.withChef(chef.id, async (tx) => {
          await tx.query(
            `update import_jobs set status = 'failed', error_message = $2 where id = $1`,
            [job, message],
          );
        });
        if (error instanceof ApiError) throw error;
        throw ApiError.upstream(message);
      }
    } catch (error) {
      next(error);
    }
  });

  router.get("/imports/:id", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const result = await db.withChef(chef.id, (tx) =>
        tx.query<ImportRow>(`select * from import_jobs where id = $1`, [req.params.id]),
      );
      if (!result.rows[0]) throw ApiError.notFound("That import is not yours.");
      res.json({ job: toJobView(result.rows[0]) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/imports/:id/confirm", async (req, res, next) => {
    try {
      const chef = requireChef(req);
      const body = parseBody(confirmImportSchema, req.body);

      const job = await db.withChef(chef.id, (tx) =>
        tx.query<ImportRow>(`select * from import_jobs where id = $1`, [req.params.id]),
      );
      const row = job.rows[0];
      if (!row) throw ApiError.notFound("That import is not yours.");
      if (row.status === "saved") throw ApiError.conflict("That import was already saved to your book.");

      const draft = (body.draft ?? row.draft) as RecipeDraft | null;
      if (!draft) throw ApiError.badRequest("There is nothing to save yet.");
      if (draft.ingredients.length === 0 || draft.steps.length === 0) {
        throw ApiError.badRequest("Add at least one ingredient and one step before saving.");
      }

      // Shareable canonical copy (used by the internal-first lookup for every chef).
      // The importing chef's identity is stored only for provenance and never returned.
      let catalogueId: string | null = null;
      const shareable = body.share !== false && chef.canPublish;
      if (shareable) {
        const ensured = await ensureCatalogueRecipe(db, draft, chef.id);
        catalogueId = ensured.id;
        await db.query(
          `insert into catalogue_aliases (catalogue_id, alias, normalised)
           select $1, $2, $3 where not exists (
             select 1 from catalogue_aliases where catalogue_id = $1 and normalised = $3
           )`,
          [catalogueId, draft.title, normaliseDishName(draft.title)],
        );
      }

      const recipeId = await db.withChef(chef.id, (tx) =>
        insertChefRecipe(tx, chef.id, draft, catalogueId, body.notes ?? null),
      );

      await db.withChef(chef.id, async (tx) => {
        await tx.query(
          `update import_jobs
              set status = 'saved', chef_recipe_id = $2, catalogue_id = $3, completed_at = now()
            where id = $1`,
          [row.id, recipeId, catalogueId],
        );
      });

      res.status(201).json({ recipeId, catalogueId, sharedWithCatalogue: Boolean(catalogueId) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
