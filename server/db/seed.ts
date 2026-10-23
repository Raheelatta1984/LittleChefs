import type { Database } from "./index.js";
import type { RecipeDraft } from "../../shared/types.js";
import { recipeBook } from "../../src/data/recipes.js";
import { parseIngredientLine, parseServings } from "../services/importer/parse.js";
import { insertCatalogueRecipe } from "../services/recipes.js";
import { normaliseDishName } from "../services/normalise.js";

const DIFFICULTIES = new Set(["Super Easy", "Easy", "A Little Tricky"]);

function draftFromBuiltin(recipe: {
  name: string;
  time: string;
  difficulty: string;
  servings: string;
  ingredients: string[];
  steps: string[];
  tip: string;
  image?: string;
  youtubeVideo?: string;
  source?: string;
  sourceUrl?: string;
}): RecipeDraft {
  const hours = Number(/(\d+)\s*(?:hours?|hrs?)/i.exec(recipe.time)?.[1] ?? 0);
  const mins = Number(/(\d+)\s*(?:minutes?|mins?)/i.exec(recipe.time)?.[1] ?? 0);
  const fallback = Number(/(\d+)/.exec(recipe.time)?.[1] ?? 0);
  const minutes = hours * 60 + mins || fallback || null;
  const videoId = recipe.youtubeVideo ?? null;

  return {
    title: recipe.name,
    cuisine: null,
    description: recipe.tip ?? null,
    difficulty: DIFFICULTIES.has(recipe.difficulty) ? recipe.difficulty : "Easy",
    baseServings: parseServings(recipe.servings) ?? 4,
    totalMinutes: minutes,
    heroImageUrl: recipe.image ?? null,
    sourceType: "builtin",
    sourceUrl: recipe.sourceUrl ?? recipe.source ?? null,
    sourceVideoId: videoId,
    sourceChannel: null,
    sourceAuthor: "Chef Universe",
    ingredients: recipe.ingredients
      .map((line, index) => parseIngredientLine(line, index))
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    steps: recipe.steps.map((instruction, position) => ({
      position,
      instruction,
      durationSeconds: null,
      temperatureC: null,
      imageUrl: null,
      tip: null,
    })),
  };
}

/**
 * Loads the app's built-in recipes into the shared catalogue so the very first
 * search already resolves internally, before any AI import is needed.
 * Idempotent: re-running only adds what is missing.
 */
export async function seedBuiltinCatalogue(db: Database): Promise<{ inserted: number; total: number }> {
  const recipes = Object.values(recipeBook);
  let inserted = 0;

  for (const recipe of recipes) {
    const draft = draftFromBuiltin(recipe);
    if (draft.ingredients.length === 0 || draft.steps.length === 0) continue;

    const existing = await db.query<{ id: string }>(
      `select id from catalogue_recipes where normalised_title = $1`,
      [normaliseDishName(draft.title)],
    );
    if (existing.rows[0]) continue;

    const created = await insertCatalogueRecipe(db, draft, null);
    if (created.created) inserted += 1;

    await db.query(
      `insert into catalogue_aliases (catalogue_id, alias, normalised)
       select $1, $2, $3 where not exists (
         select 1 from catalogue_aliases where catalogue_id = $1 and normalised = $3
       )`,
      [created.id, draft.title, normaliseDishName(draft.title)],
    );
  }

  const total = await db.query<{ count: string }>(`select count(*) as count from catalogue_recipes`);
  return { inserted, total: Number(total.rows[0]?.count ?? 0) };
}
