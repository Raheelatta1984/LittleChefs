import type { Database, Queryable, Row } from "../db/index.js";
import type { Ingredient, InternalMatch, RecipeDraft, RecipeView, Step } from "../../shared/types.js";
import { dedupeKey, isSameDish, normaliseDishName } from "./normalise.js";

type IngredientRow = Row & {
  id: string; position: number; quantity: string | number | null; unit: string | null;
  item: string; prep_note: string | null; group_name: string | null;
  scalable: boolean; raw_text: string | null;
};

type StepRow = Row & {
  id: string; position: number; instruction: string; duration_seconds: number | null;
  temperature_c: number | null; image_url: string | null; tip: string | null;
};

type RecipeRow = Row & {
  id: string; catalogue_id: string | null; title: string; cuisine: string | null;
  description: string | null; difficulty: string | null; base_servings: number;
  total_minutes: number | null; hero_image_url: string | null; notes?: string | null;
  source_type: RecipeDraft["sourceType"]; source_url: string | null;
  source_video_id: string | null; source_channel: string | null; source_author: string | null;
  normalised_title?: string; created_at?: string; updated_at?: string;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapIngredient(row: IngredientRow, index: number): Ingredient {
  return {
    id: row.id,
    position: Number(row.position ?? index),
    quantity: toNumber(row.quantity),
    unit: row.unit,
    item: row.item,
    prepNote: row.prep_note,
    groupName: row.group_name,
    scalable: row.scalable !== false,
    rawText: row.raw_text,
  };
}

export function mapStep(row: StepRow): Step {
  return {
    id: row.id,
    position: Number(row.position),
    instruction: row.instruction,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    temperatureC: row.temperature_c === null ? null : Number(row.temperature_c),
    imageUrl: row.image_url,
    tip: row.tip,
  };
}

const INGREDIENT_COLUMNS = `id, position, quantity, unit, item, prep_note, group_name, scalable, raw_text`;
const STEP_COLUMNS = `id, position, instruction, duration_seconds, temperature_c, image_url, tip`;

export async function loadCatalogueRecipe(db: Queryable, id: string): Promise<RecipeDraft | null> {
  const recipe = await db.query<RecipeRow>(`select * from catalogue_recipes where id = $1`, [id]);
  const row = recipe.rows[0];
  if (!row) return null;
  const [ingredients, steps] = await Promise.all([
    db.query<IngredientRow>(
      `select ${INGREDIENT_COLUMNS} from catalogue_ingredients where catalogue_id = $1 order by position`,
      [id],
    ),
    db.query<StepRow>(
      `select ${STEP_COLUMNS} from catalogue_steps where catalogue_id = $1 order by position`,
      [id],
    ),
  ]);
  return {
    title: row.title,
    cuisine: row.cuisine,
    description: row.description,
    difficulty: row.difficulty,
    baseServings: Number(row.base_servings),
    totalMinutes: toNumber(row.total_minutes),
    heroImageUrl: row.hero_image_url,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    sourceVideoId: row.source_video_id,
    sourceChannel: row.source_channel,
    sourceAuthor: row.source_author,
    ingredients: ingredients.rows.map(mapIngredient),
    steps: steps.rows.map(mapStep),
  };
}

export async function loadChefRecipe(tx: Queryable, id: string): Promise<RecipeView | null> {
  const recipe = await tx.query<RecipeRow & { created_at: string; updated_at: string }>(
    `select * from chef_recipes where id = $1`,
    [id],
  );
  const row = recipe.rows[0];
  if (!row) return null;
  const [ingredients, steps] = await Promise.all([
    tx.query<IngredientRow>(
      `select ${INGREDIENT_COLUMNS} from chef_recipe_ingredients where chef_recipe_id = $1 order by position`,
      [id],
    ),
    tx.query<StepRow>(
      `select ${STEP_COLUMNS} from chef_recipe_steps where chef_recipe_id = $1 order by position`,
      [id],
    ),
  ]);
  return {
    id: row.id,
    catalogueId: row.catalogue_id,
    title: row.title,
    cuisine: row.cuisine,
    description: row.description,
    difficulty: row.difficulty,
    baseServings: Number(row.base_servings),
    totalMinutes: toNumber(row.total_minutes),
    heroImageUrl: row.hero_image_url,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    sourceVideoId: row.source_video_id,
    sourceChannel: row.source_channel,
    sourceAuthor: row.source_author,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownedByMe: true,
    claimedFromCatalogue: Boolean(row.catalogue_id),
    ingredients: ingredients.rows.map(mapIngredient),
    steps: steps.rows.map(mapStep),
  };
}

export async function listChefRecipes(tx: Queryable): Promise<RecipeView[]> {
  const result = await tx.query<RecipeRow & {
    created_at: string; updated_at: string; ingredient_count: string; step_count: string;
  }>(
    `select r.*,
            (select count(*) from chef_recipe_ingredients i where i.chef_recipe_id = r.id) as ingredient_count,
            (select count(*) from chef_recipe_steps s where s.chef_recipe_id = r.id) as step_count
       from chef_recipes r
      order by r.updated_at desc`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    catalogueId: row.catalogue_id,
    title: row.title,
    cuisine: row.cuisine,
    description: row.description,
    difficulty: row.difficulty,
    baseServings: Number(row.base_servings),
    totalMinutes: toNumber(row.total_minutes),
    heroImageUrl: row.hero_image_url,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    sourceVideoId: row.source_video_id,
    sourceChannel: row.source_channel,
    sourceAuthor: row.source_author,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownedByMe: true,
    claimedFromCatalogue: Boolean(row.catalogue_id),
    ingredients: new Array(Number(row.ingredient_count)).fill(null).map((_, position) => ({
      position,
      quantity: null,
      unit: null,
      item: "",
      prepNote: null,
      groupName: null,
      scalable: true,
      rawText: null,
    })),
    steps: new Array(Number(row.step_count)).fill(null).map((_, position) => ({
      position,
      instruction: "",
      durationSeconds: null,
      temperatureC: null,
      imageUrl: null,
      tip: null,
    })),
  }));
}

function normalizeDraft(draft: RecipeDraft): RecipeDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    baseServings: Math.max(1, Math.round(draft.baseServings || 1)),
    ingredients: draft.ingredients
      .filter((i) => i.item?.trim())
      .map((ingredient, index) => ({
        ...ingredient,
        position: index,
        item: ingredient.item.trim(),
        unit: ingredient.unit?.trim() || null,
        rawText: ingredient.rawText ?? null,
        prepNote: ingredient.prepNote ?? null,
        groupName: ingredient.groupName ?? null,
        scalable: ingredient.scalable !== false,
      })),
    steps: draft.steps
      .filter((step) => step.instruction?.trim())
      .map((step, index) => ({
        ...step,
        position: index,
        instruction: step.instruction.trim(),
        imageUrl: step.imageUrl ?? null,
        tip: step.tip ?? null,
      })),
  };
}

/** Writes a catalogue recipe (shared canonical copy) and returns its id. */
export async function insertCatalogueRecipe(
  db: Queryable,
  draftInput: RecipeDraft,
  createdByChef: string | null,
): Promise<{ id: string; created: boolean }> {
  const draft = normalizeDraft(draftInput);
  const key = dedupeKey(draft.title);
  const existing = await db.query<{ id: string }>(
    `select id from catalogue_recipes where dedupe_key = $1`,
    [key],
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };

  const inserted = await db.query<{ id: string }>(
    `insert into catalogue_recipes
       (dedupe_key, title, normalised_title, cuisine, description, difficulty, base_servings,
        total_minutes, hero_image_url, source_type, source_url, source_video_id, source_channel,
        source_author, created_by_chef)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     returning id`,
    [
      key, draft.title, normaliseDishName(draft.title), draft.cuisine, draft.description,
      draft.difficulty, draft.baseServings, draft.totalMinutes, draft.heroImageUrl,
      draft.sourceType, draft.sourceUrl, draft.sourceVideoId, draft.sourceChannel,
      draft.sourceAuthor, createdByChef,
    ],
  );
  const catalogueId = inserted.rows[0].id;
  await writeChildren(db, "catalogue_ingredients", "catalogue_id", catalogueId, draft.ingredients);
  await writeChildren(db, "catalogue_steps", "catalogue_id", catalogueId, draft.steps);
  return { id: catalogueId, created: true };
}

async function writeChildren(
  db: Queryable,
  table: "catalogue_ingredients" | "catalogue_steps" | "chef_recipe_ingredients" | "chef_recipe_steps",
  fk: "catalogue_id" | "chef_recipe_id",
  id: string,
  rows: Ingredient[] | Step[],
) {
  const isIngredient = rows.length === 0 || "item" in (rows[0] as object);
  for (const [index, row] of rows.entries()) {
    if (isIngredient) {
      const ing = row as Ingredient;
      await db.query(
        `insert into ${table} (${fk}, position, quantity, unit, item, prep_note, group_name, scalable, raw_text)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, index, ing.quantity, ing.unit, ing.item, ing.prepNote, ing.groupName, ing.scalable !== false, ing.rawText],
      );
    } else {
      const step = row as Step;
      await db.query(
        `insert into ${table} (${fk}, position, instruction, duration_seconds, temperature_c, image_url, tip)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [id, index, step.instruction, step.durationSeconds, step.temperatureC, step.imageUrl, step.tip],
      );
    }
  }
}

/** Saves a full recipe into a chef's private book. Runs inside withChef(). */
export async function insertChefRecipe(
  tx: Queryable,
  chefId: string,
  draftInput: RecipeDraft,
  catalogueId: string | null = null,
  notes: string | null = null,
): Promise<string> {
  const draft = normalizeDraft(draftInput);
  const key = dedupeKey(draft.title);

  const existing = await tx.query<{ id: string }>(
    `select id from chef_recipes where chef_id = $1 and dedupe_key = $2`,
    [chefId, key],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await tx.query<{ id: string }>(
    `insert into chef_recipes
       (chef_id, catalogue_id, dedupe_key, title, normalised_title, cuisine, description, difficulty,
        base_servings, total_minutes, hero_image_url, notes, source_type, source_url,
        source_video_id, source_channel, source_author)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     returning id`,
    [
      chefId, catalogueId, key, draft.title, normaliseDishName(draft.title), draft.cuisine,
      draft.description, draft.difficulty, draft.baseServings, draft.totalMinutes,
      draft.heroImageUrl, notes, draft.sourceType, draft.sourceUrl, draft.sourceVideoId,
      draft.sourceChannel, draft.sourceAuthor,
    ],
  );
  const recipeId = inserted.rows[0].id;
  await writeChildren(tx, "chef_recipe_ingredients", "chef_recipe_id", recipeId, draft.ingredients);
  await writeChildren(tx, "chef_recipe_steps", "chef_recipe_id", recipeId, draft.steps);
  return recipeId;
}

export async function deleteChefRecipe(tx: Queryable, id: string): Promise<boolean> {
  const result = await tx.query(`delete from chef_recipes where id = $1 returning id`, [id]);
  return result.rows.length > 0;
}

/** Updates a chef's own recipe (RLS guarantees ownership). */
export async function updateChefRecipe(
  tx: Queryable,
  id: string,
  draftInput: RecipeDraft,
  notes: string | null,
): Promise<RecipeView | null> {
  const draft = normalizeDraft(draftInput);
  const updated = await tx.query<{ id: string }>(
    `update chef_recipes set
        title = $2, normalised_title = $3, dedupe_key = $4, cuisine = $5, description = $6,
        difficulty = $7, base_servings = $8, total_minutes = $9, hero_image_url = $10,
        notes = $11, source_url = $12, updated_at = now()
      where id = $1 returning id`,
    [
      id, draft.title, normaliseDishName(draft.title), dedupeKey(draft.title), draft.cuisine,
      draft.description, draft.difficulty, draft.baseServings, draft.totalMinutes,
      draft.heroImageUrl, notes, draft.sourceUrl,
    ],
  );
  if (!updated.rows[0]) return null;
  await tx.query(`delete from chef_recipe_ingredients where chef_recipe_id = $1`, [id]);
  await tx.query(`delete from chef_recipe_steps where chef_recipe_id = $1`, [id]);
  await writeChildren(tx, "chef_recipe_ingredients", "chef_recipe_id", id, draft.ingredients);
  await writeChildren(tx, "chef_recipe_steps", "chef_recipe_id", id, draft.steps);
  return loadChefRecipe(tx, id);
}

/** Finds an existing canonical entry by exact key, normalised title or alias. */
export async function findCatalogueIdForTitle(db: Queryable, title: string): Promise<string | null> {
  const key = dedupeKey(title);
  const normalised = normaliseDishName(title);
  const found = await db.query<{ id: string }>(
    `select c.id
       from catalogue_recipes c
      where c.dedupe_key = $1
         or c.normalised_title = $2
         or exists (
              select 1 from catalogue_aliases a
               where a.catalogue_id = c.id and a.normalised = $2
            )
      order by (c.dedupe_key = $1) desc
      limit 1`,
    [key, normalised],
  );
  return found.rows[0]?.id ?? null;
}

/**
 * Guarantees a canonical, reusable catalogue entry for a recipe.
 * Returns null when the existing entry is title-only (no steps yet) and the
 * caller should replace it.
 */
export async function ensureCatalogueRecipe(
  db: Database,
  draft: RecipeDraft,
  chefId: string,
): Promise<{ id: string; created: boolean }> {
  const existingId = await findCatalogueIdForTitle(db, draft.title);
  if (existingId) {
    const existing = await loadCatalogueRecipe(db, existingId);
    if (existing && existing.steps.length > 0 && existing.ingredients.length > 0) {
      return { id: existingId, created: false };
    }
    await db.query(`delete from catalogue_recipes where id = $1`, [existingId]);
  }
  return insertCatalogueRecipe(db, draft, chefId);
}

/** Copies a shared catalogue recipe into the chef's private book ("claim"). */
export async function claimCatalogueRecipe(
  db: Database,
  chefId: string,
  catalogueId: string,
): Promise<{ recipeId: string; alreadyOwned: boolean }> {
  const draft = await loadCatalogueRecipe(db, catalogueId);
  if (!draft) throw new Error("catalogue recipe not found");

  const existing = await db.query<{ id: string }>(
    `select id from chef_recipes where chef_id = $1 and dedupe_key = $2`,
    [chefId, dedupeKey(draft.title)],
  );
  if (existing.rows[0]) return { recipeId: existing.rows[0].id, alreadyOwned: true };

  const recipeId = await db.withChef(chefId, (tx) =>
    insertChefRecipe(tx, chefId, { ...draft, sourceType: draft.sourceType ?? "web" }, catalogueId),
  );
  return { recipeId, alreadyOwned: false };
}

function toMatch(row: {
  id: string; catalogue_id?: string | null; title: string; cuisine: string | null;
  hero_image_url: string | null; base_servings: number | string;
  total_minutes: number | string | null; ingredient_count: number | string; step_count: number | string;
}, source: InternalMatch["source"]): InternalMatch {
  return {
    source,
    recipeId: source === "my-recipes" ? row.id : undefined,
    catalogueId: source === "shared-catalogue" ? row.id : row.catalogue_id ?? undefined,
    title: row.title,
    cuisine: row.cuisine,
    heroImageUrl: row.hero_image_url,
    baseServings: Number(row.base_servings),
    totalMinutes: toNumber(row.total_minutes),
    ingredientCount: Number(row.ingredient_count),
    stepCount: Number(row.step_count),
  };
}

/**
 * Internal-first lookup. Own recipes are read through RLS (so only yours),
 * the shared catalogue is read canonically and never exposes the chef who
 * imported it.
 */
export async function findInternalMatches(
  db: Database,
  chefId: string,
  query: string,
): Promise<{ myRecipes: InternalMatch[]; sharedMatches: InternalMatch[] }> {
  const normalised = normaliseDishName(query);
  if (!normalised) return { myRecipes: [], sharedMatches: [] };
  const key = dedupeKey(query);

  const myRecipes = await db.withChef(chefId, async (tx) => {
    const rows = await tx.query<{
      id: string; catalogue_id: string | null; title: string; normalised_title: string;
      cuisine: string | null; hero_image_url: string | null; base_servings: number;
      total_minutes: number | null; ingredient_count: string; step_count: string;
    }>(
      `select r.id, r.catalogue_id, r.title, r.normalised_title, r.cuisine, r.hero_image_url,
              r.base_servings, r.total_minutes,
              (select count(*) from chef_recipe_ingredients i where i.chef_recipe_id = r.id) as ingredient_count,
              (select count(*) from chef_recipe_steps s where s.chef_recipe_id = r.id) as step_count
         from chef_recipes r
        where r.dedupe_key = $1 or r.normalised_title = $2
        order by r.updated_at desc`,
      [key, normalised],
    );
    const exact = rows.rows.map((row) => toMatch(row, "my-recipes"));
    if (exact.length > 0) return exact;

    const all = await tx.query<{
      id: string; catalogue_id: string | null; title: string; normalised_title: string;
      cuisine: string | null; hero_image_url: string | null; base_servings: number;
      total_minutes: number | null; ingredient_count: string; step_count: string;
    }>(
      `select r.id, r.catalogue_id, r.title, r.normalised_title, r.cuisine, r.hero_image_url,
              r.base_servings, r.total_minutes,
              (select count(*) from chef_recipe_ingredients i where i.chef_recipe_id = r.id) as ingredient_count,
              (select count(*) from chef_recipe_steps s where s.chef_recipe_id = r.id) as step_count
         from chef_recipes r
        order by r.updated_at desc
        limit 300`,
    );
    return all.rows
      .filter((row) => isSameDish(row.normalised_title, normalised))
      .map((row) => toMatch(row, "my-recipes"));
  });

  const catalogueRows = await db.query<{
    id: string; title: string; normalised_title: string; cuisine: string | null;
    hero_image_url: string | null; base_servings: number; total_minutes: number | null;
    ingredient_count: string; step_count: string;
  }>(
    `select c.id, c.title, c.normalised_title, c.cuisine, c.hero_image_url, c.base_servings,
            c.total_minutes,
            (select count(*) from catalogue_ingredients i where i.catalogue_id = c.id) as ingredient_count,
            (select count(*) from catalogue_steps s where s.catalogue_id = c.id) as step_count
       from catalogue_recipes c
      where c.dedupe_key = $1
         or c.normalised_title = $2
         or exists (
              select 1 from catalogue_aliases a
               where a.catalogue_id = c.id and (a.normalised = $2 or a.normalised = $1)
            )
      limit 20`,
    [key, normalised],
  );

  let sharedRows = catalogueRows.rows;
  if (sharedRows.length === 0) {
    const recent = await db.query<{
      id: string; title: string; normalised_title: string; cuisine: string | null;
      hero_image_url: string | null; base_servings: number; total_minutes: number | null;
      ingredient_count: string; step_count: string;
    }>(
      `select c.id, c.title, c.normalised_title, c.cuisine, c.hero_image_url, c.base_servings,
              c.total_minutes,
              (select count(*) from catalogue_ingredients i where i.catalogue_id = c.id) as ingredient_count,
              (select count(*) from catalogue_steps s where s.catalogue_id = c.id) as step_count
         from catalogue_recipes c
        order by c.created_at desc
        limit 500`,
    );
    sharedRows = recent.rows.filter((row) => isSameDish(row.normalised_title, normalised));
  }

  return {
    myRecipes,
    sharedMatches: sharedRows.map((row) => toMatch(row, "shared-catalogue")),
  };
}
