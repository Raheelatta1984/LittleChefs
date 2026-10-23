import { Router } from "express";
import type { Database } from "../db/index.js";
import type { ImportJobView, RecipeDraft } from "../../shared/types.js";
import { requireChef } from "../lib/auth.js";
import { ApiError } from "../lib/errors.js";
import { rateLimit } from "../lib/rateLimit.js";
import { confirmImportSchema, importSchema, parseBody } from "../lib/schemas.js";
import {
  classifyInput, emptyDraft, importRecipe, tidyDraft, warningsFor, type ImportOutcome,
} from "../services/importer/index.js";
import { confidenceOf, titleFromUrl } from "../services/importer/parse.js";
import { youtubeVideoId } from "../services/importer/youtube.js";
import {
  ensureCatalogueRecipe, findInternalMatches, insertChefRecipe, loadCatalogueRecipe,
} from "../services/recipes.js";
import { normaliseDishName } from "../services/normalise.js";
import { config } from "../config.js";

function coerceDraftHint(hint: Record<string, unknown>, inputValue: string): RecipeDraft {
  const videoId =
    (typeof hint.sourceVideoId === "string" && hint.sourceVideoId) || youtubeVideoId(inputValue);
  return tidyDraft(
    emptyDraft({
      title: typeof hint.title === "string" ? hint.title : titleFromUrl(inputValue),
      cuisine: typeof hint.cuisine === "string" ? hint.cuisine : null,
      description: typeof hint.description === "string" ? hint.description : null,
      difficulty: typeof hint.difficulty === "string" ? hint.difficulty : null,
      baseServings: typeof hint.baseServings === "number" ? hint.baseServings : 4,
      totalMinutes: typeof hint.totalMinutes === "number" ? hint.totalMinutes : null,
      heroImageUrl:
        (typeof hint.heroImageUrl === "string" && hint.heroImageUrl) ||
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
      sourceType:
        hint.sourceType === "youtube" || hint.sourceType === "web" || hint.sourceType === "ai" ||
        hint.sourceType === "manual" || hint.sourceType === "builtin"
          ? hint.sourceType
          : videoId
            ? "youtube"
            : "web",
      sourceUrl:
        (typeof hint.sourceUrl === "string" && hint.sourceUrl) ||
        (inputValue.startsWith("http") ? inputValue : null),
      sourceVideoId: videoId ?? null,
      sourceChannel: typeof hint.sourceChannel === "string" ? hint.sourceChannel : null,
      sourceAuthor: typeof hint.sourceAuthor === "string" ? hint.sourceAuthor : null,
      ingredients: Array.isArray(hint.ingredients)
        ? (hint.ingredients as RecipeDraft["ingredients"]).map((ing, i) => ({
            position: i,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
            item: ing.item,
            prepNote: ing.prepNote ?? null,
            groupName: ing.groupName ?? null,
            scalable: ing.scalable !== false && ing.quantity !== null && ing.quantity !== undefined,
            rawText: ing.rawText ?? null,
          }))
        : [],
      steps: Array.isArray(hint.steps)
        ? (hint.steps as RecipeDraft["steps"]).map((step, i) => ({
            position: i,
            instruction: step.instruction,
            durationSeconds: step.durationSeconds ?? null,
            temperatureC: step.temperatureC ?? null,
            imageUrl: step.imageUrl ?? null,
            tip: step.tip ?? null,
          }))
        : [],
    }),
  );
}

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

      const hintDraft = body.draftHint ? coerceDraftHint(body.draftHint, body.inputValue) : null;

      try {
        let outcome: ImportOutcome;
        if (hintDraft && hintDraft.ingredients.length >= 2 && hintDraft.steps.length >= 1) {
          const method: ImportOutcome["method"] =
            hintDraft.sourceType === "youtube" ? "youtube" : "heuristic";
          outcome = {
            draft: hintDraft,
            method,
            confidence: confidenceOf(hintDraft),
            warnings: warningsFor(hintDraft, method),
          };
        } else {
          try {
            outcome = await importRecipe(
              { inputType, inputValue: body.inputValue },
              { useLlm: Boolean(config.llm.apiKey), allowAiFallback: body.allowAiFallback },
            );
          } catch (primaryError) {
            if (!body.allowAiFallback) throw primaryError;

            const dishCandidate =
              hintDraft?.title ||
              (body.inputValue.startsWith("http")
                ? titleFromUrl(body.inputValue)
                : body.inputValue);
            const matches = await findInternalMatches(db, chef.id, dishCandidate);
            const shared = matches.sharedMatches[0];
            const catalogueDraft = shared?.catalogueId
              ? await loadCatalogueRecipe(db, shared.catalogueId)
              : null;

            const videoId = hintDraft?.sourceVideoId ?? youtubeVideoId(body.inputValue);
            const fallbackDraft = tidyDraft(
              emptyDraft({
                title: hintDraft?.title || catalogueDraft?.title || dishCandidate || "Imported recipe",
                cuisine: hintDraft?.cuisine ?? catalogueDraft?.cuisine ?? null,
                description: hintDraft?.description ?? catalogueDraft?.description ?? null,
                difficulty: hintDraft?.difficulty ?? catalogueDraft?.difficulty ?? "Easy",
                baseServings: hintDraft?.baseServings || catalogueDraft?.baseServings || 4,
                totalMinutes: hintDraft?.totalMinutes ?? catalogueDraft?.totalMinutes ?? 30,
                heroImageUrl:
                  hintDraft?.heroImageUrl ??
                  (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null) ??
                  catalogueDraft?.heroImageUrl ??
                  null,
                sourceType: videoId ? "youtube" : "web",
                sourceUrl:
                  hintDraft?.sourceUrl ??
                  (body.inputValue.startsWith("http") ? body.inputValue : null),
                sourceVideoId: videoId ?? null,
                sourceChannel: hintDraft?.sourceChannel ?? null,
                sourceAuthor: hintDraft?.sourceAuthor ?? hintDraft?.sourceChannel ?? null,
                ingredients:
                  catalogueDraft && catalogueDraft.ingredients.length > 0
                    ? catalogueDraft.ingredients
                    : [
                        { position: 0, quantity: 2, unit: "cups", item: "main ingredient (review & edit)", prepNote: null, groupName: null, scalable: true, rawText: null },
                        { position: 1, quantity: 1, unit: "tbsp", item: "cooking oil or butter", prepNote: null, groupName: null, scalable: true, rawText: null },
                        { position: 2, quantity: null, unit: null, item: "salt & seasoning", prepNote: "to taste", groupName: null, scalable: false, rawText: "Salt to taste" },
                      ],
                steps:
                  catalogueDraft && catalogueDraft.steps.length > 0
                    ? catalogueDraft.steps
                    : [
                        { position: 0, instruction: "Prepare and measure all ingredients cleanly on your counter.", durationSeconds: 300, temperatureC: null, imageUrl: null, tip: null },
                        { position: 1, instruction: "Follow the cooking method from the selected source and adjust steps below before saving.", durationSeconds: 900, temperatureC: null, imageUrl: null, tip: "Review with a grown-up!" },
                      ],
              }),
            );

            outcome = {
              draft: fallbackDraft,
              method: catalogueDraft ? "heuristic" : "manual",
              confidence: catalogueDraft ? 0.72 : 0.45,
              warnings: [
                catalogueDraft
                  ? "The selected page or video description did not list full written quantities, so AI Onboarding matched verified ingredients & steps for this dish — please review & adjust before saving!"
                  : "The selected source could not be parsed automatically (no written recipe block found). We opened an editable starter draft so you can tweak ingredients & steps and continue AI Onboarding.",
                ...warningsFor(fallbackDraft, "manual"),
              ],
            };
          }
        }

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
