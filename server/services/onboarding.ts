import type { Database, Queryable } from "../db/index.js";
import type {
  ChefProfile, MealOccasion, OnboardingAnswers, OnboardingResult, ShoppingListView, Step,
} from "../../shared/types.js";
import { MEAL_OCCASIONS } from "../../shared/types.js";
import { ApiError } from "../lib/errors.js";
import { loadChefRecipe } from "./recipes.js";
import { scaleIngredients, scaleFactorLabel } from "./scaling.js";
import { buildShoppingList, AISLE_META, type Aisle } from "./shopping.js";
import { normaliseIngredient } from "./normalise.js";

const MEAL_PORTION_FACTOR: Record<MealOccasion, number> = {
  breakfast: 0.8,
  lunch: 1,
  dinner: 1,
  "late-night-snack": 0.6,
};

const MEAL_NOTES: Record<MealOccasion, string> = {
  breakfast: "Breakfast is a lighter meal — each plate is about ¾ of a full dinner portion.",
  lunch: "Lunch is a full portion to keep everyone going all afternoon.",
  dinner: "Dinner is the main meal — serve a full portion per person.",
  "late-night-snack": "Late-night snacks should be small and light — about 60% of a dinner portion per person.",
};

const MEAT_WORDS = ["chicken", "beef", "lamb", "mutton", "pork", "bacon", "sausage", "fish", "prawn", "shrimp", "keema", "mince"];
const DAIRY_WORDS = ["milk", "butter", "cheese", "cream", "yogurt", "yoghurt", "ghee", "paneer"];
const NUT_WORDS = ["almond", "cashew", "walnut", "pistachio", "peanut", "hazelnut", "nut"];

function dietWarnings(dietary: string[], ingredientNames: string[]): string[] {
  const haystack = ingredientNames.map((n) => normaliseIngredient(n)).join(" ");
  const warnings: string[] = [];
  const has = (words: string[]) => words.some((word) => haystack.includes(word));

  for (const diet of dietary.map((d) => d.toLowerCase())) {
    if ((diet === "vegetarian" || diet === "vegan") && has(MEAT_WORDS)) {
      warnings.push(`Heads up: this recipe contains meat but you chose ${diet}. Swap it or change your answer.`);
    }
    if ((diet === "vegetarian" || diet === "vegan") && diet === "vegan" && has(DAIRY_WORDS)) {
      warnings.push("Heads up: this recipe uses dairy but you chose vegan.");
    }
    if (diet.includes("nut") && has(NUT_WORDS)) {
      warnings.push("Allergy alert: this recipe contains nuts. Ask a grown-up before cooking.");
    }
    if (diet.includes("gluten") && /\bflour|bread|pasta|noodle|semolina|barley\b/.test(haystack)) {
      warnings.push("Heads up: this recipe contains gluten (flour/bread/pasta).");
    }
  }
  return warnings;
}

function mealHint(meal: MealOccasion, servings: number): string {
  const label = MEAL_OCCASIONS.find((m) => m.id === meal)?.label ?? "Meal";
  return `${label} for ${servings} ${servings === 1 ? "person" : "people"} — ${MEAL_NOTES[meal]}`;
}

function scaleSteps(steps: Step[]): Step[] {
  return steps.map((step) => ({ ...step }));
}

function toShoppingView(row: {
  id: string; chef_recipe_id: string; servings: number; meal_occasion: string;
  status: string; created_at: string;
}, items: Array<{
  id: string; aisle: string; item: string; quantity_text: string; checked: boolean;
  already_at_home: boolean; note: string | null; position: number;
}>): ShoppingListView {
  const mapped = items
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((item) => ({
      id: item.id,
      aisle: item.aisle,
      aisleLabel: AISLE_META[item.aisle as Aisle]?.label ?? "Other",
      item: item.item,
      quantityText: item.quantity_text,
      checked: item.checked,
      alreadyAtHome: item.already_at_home,
      note: item.note,
    }));

  const byAisle = new Map<string, typeof mapped>();
  for (const item of mapped) {
    const list = byAisle.get(item.aisle) ?? [];
    list.push(item);
    byAisle.set(item.aisle, list);
  }

  return {
    id: row.id,
    chefRecipeId: row.chef_recipe_id,
    servings: Number(row.servings),
    mealOccasion: row.meal_occasion as MealOccasion,
    status: row.status as ShoppingListView["status"],
    groups: [...byAisle.entries()].map(([aisle, groupItems]) => ({
      aisle,
      label: AISLE_META[aisle as Aisle]?.label ?? "Other",
      emoji: AISLE_META[aisle as Aisle]?.emoji ?? "🧺",
      items: groupItems,
    })),
    items: mapped,
    totals: {
      toBuy: mapped.filter((i) => !i.alreadyAtHome).length,
      alreadyAtHome: mapped.filter((i) => i.alreadyAtHome).length,
    },
    createdAt: row.created_at,
  };
}

export { toShoppingView };

/**
 * Runs the onboarding interview result: scales every ingredient for the number
 * of eaters, adjusts portion guidance for the meal, and persists a shopping
 * list the chef can tick off in the shop before cooking starts.
 */
export async function runOnboarding(
  db: Database,
  chef: ChefProfile,
  recipeId: string,
  answers: OnboardingAnswers,
): Promise<OnboardingResult> {
  const meal = MEAL_OCCASIONS.some((m) => m.id === answers.mealOccasion)
    ? answers.mealOccasion
    : "dinner";

  if (!Number.isFinite(answers.servings) || answers.servings < 1) {
    throw ApiError.badRequest("How many people are eating? Please pick at least 1.");
  }

  const reminders: string[] = [];
  let servings = Math.round(answers.servings);
  if (servings > chef.maxBatchServings) {
    reminders.push(
      `Your ${chef.roleLabel} kitchen is set up for up to ${chef.maxBatchServings} eaters — we scaled this batch to ${chef.maxBatchServings}. Cook it twice for a bigger crowd.`,
    );
    servings = chef.maxBatchServings;
  }

  const recipe = await db.withChef(chef.id, (tx) => loadChefRecipe(tx as Queryable, recipeId));
  if (!recipe) throw ApiError.notFound("That recipe is not in your recipe book.");

  const baseServings = Math.max(1, recipe.baseServings);
  const factor = servings / baseServings;
  const scaledIngredients = scaleIngredients(recipe.ingredients, factor, baseServings);
  const steps = scaleSteps(recipe.steps);

  const pantry = answers.pantry ?? [];
  const list = buildShoppingList(
    scaledIngredients.map((ing) => ({
      item: ing.item,
      quantityText: ing.quantityText,
      quantity: ing.scaled ?? null,
      unit: ing.unit,
      group: ing.groupName,
      scalable: ing.scalable,
    })),
    { pantry },
  );

  const ingredientNames = recipe.ingredients.map((i) => i.item);
  reminders.push(...dietWarnings(answers.dietary ?? [], ingredientNames));
  if (chef.requiresGrownup) {
    reminders.push("Ask a grown-up to help with the stove, oven and sharp knives.");
  }
  if (steps.some((step) => (step.temperatureC ?? 0) >= 180)) {
    reminders.push("This recipe uses a hot oven — a grown-up should do the oven part.");
  }
  if (list.totals.alreadyAtHome > 0) {
    reminders.push(`${list.totals.alreadyAtHome} ingredient(s) are already in your kitchen and were left off the shopping list.`);
  }

  const portionFactor = MEAL_PORTION_FACTOR[meal];
  const portionNote =
    portionFactor === 1
      ? `Serve one full portion per person (${servings} ${servings === 1 ? "plate" : "plates"}).`
      : `Each person gets about ${Math.round(portionFactor * 100)}% of a full portion (${servings} ${servings === 1 ? "serving" : "servings"} total).`;

  const persisted = await db.withChef(chef.id, async (tx) => {
    const session = await tx.query<{ id: string }>(
      `insert into onboarding_sessions (chef_id, chef_recipe_id, servings, meal_occasion, dietary, pantry, status, scale_factor)
       values ($1,$2,$3,$4,$5,$6,'ready',$7) returning id`,
      [chef.id, recipeId, servings, meal, answers.dietary ?? [], pantry, factor],
    );
    const sessionId = session.rows[0].id;

    const shopping = await tx.query<{ id: string; created_at: string }>(
      `insert into shopping_lists (chef_id, chef_recipe_id, onboarding_session_id, servings, meal_occasion, status)
       values ($1,$2,$3,$4,$5,'draft') returning id, created_at`,
      [chef.id, recipeId, sessionId, servings, meal],
    );
    const listId = shopping.rows[0].id;

    for (const [position, item] of list.items.entries()) {
      await tx.query(
        `insert into shopping_list_items
           (shopping_list_id, position, aisle, item, quantity_text, already_at_home, note)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [listId, position, item.aisle, item.item, item.quantityText, item.alreadyAtHome, item.note],
      );
    }

    const storedItems = await tx.query<{
      id: string; aisle: string; item: string; quantity_text: string; checked: boolean;
      already_at_home: boolean; note: string | null; position: number;
    }>(`select * from shopping_list_items where shopping_list_id = $1 order by position`, [listId]);

    return {
      sessionId,
      list: toShoppingView(
        {
          id: listId,
          chef_recipe_id: recipeId,
          servings,
          meal_occasion: meal,
          status: "draft",
          created_at: new Date().toISOString(),
        },
        storedItems.rows,
      ),
    };
  });

  return {
    sessionId: persisted.sessionId,
    recipeId,
    recipeTitle: recipe.title,
    servings,
    baseServings,
    scaleFactor: factor,
    mealOccasion: meal,
    mealHint: mealHint(meal, servings),
    portionNote: `${portionNote} Batch is ${scaleFactorLabel(factor)} the original ${baseServings}-serving recipe.`,
    ingredients: scaledIngredients.map((ing, position) => ({
      id: ing.id,
      position,
      quantity: ing.quantity,
      unit: ing.unit,
      item: ing.item,
      prepNote: ing.prepNote ?? null,
      groupName: ing.groupName ?? null,
      scalable: ing.scalable,
      rawText: ing.rawText ?? null,
      quantityText: ing.quantityText,
      scaled: ing.scaled,
      note: ing.note,
    })),
    steps,
    shoppingList: persisted.list,
    reminders,
  };
}

export async function getShoppingList(
  db: Database,
  chefId: string,
  listId: string,
): Promise<ShoppingListView> {
  return db.withChef(chefId, async (tx) => {
    const list = await tx.query<{
      id: string; chef_recipe_id: string; servings: number; meal_occasion: string;
      status: string; created_at: string;
    }>(`select * from shopping_lists where id = $1`, [listId]);
    const row = list.rows[0];
    if (!row) throw ApiError.notFound("That shopping list does not exist.");
    const items = await tx.query<{
      id: string; aisle: string; item: string; quantity_text: string; checked: boolean;
      already_at_home: boolean; note: string | null; position: number;
    }>(`select * from shopping_list_items where shopping_list_id = $1 order by position`, [listId]);
    return toShoppingView(row, items.rows);
  });
}

export async function toggleShoppingItem(
  db: Database,
  chefId: string,
  listId: string,
  itemId: string,
  checked: boolean,
): Promise<ShoppingListView> {
  await db.withChef(chefId, async (tx) => {
    const updated = await tx.query(
      `update shopping_list_items set checked = $1
        where id = $2 and shopping_list_id = $3 returning id`,
      [checked, itemId, listId],
    );
    if (!updated.rows[0]) throw ApiError.notFound("That shopping item does not exist.");
    await tx.query(
      `update shopping_lists set status = case when $1 then 'shopping' else status end where id = $2`,
      [checked, listId],
    );
  });
  return getShoppingList(db, chefId, listId);
}

export async function completeShoppingList(
  db: Database,
  chefId: string,
  listId: string,
): Promise<ShoppingListView> {
  await db.withChef(chefId, async (tx) => {
    const updated = await tx.query(
      `update shopping_lists set status = 'complete' where id = $1 returning id`,
      [listId],
    );
    if (!updated.rows[0]) throw ApiError.notFound("That shopping list does not exist.");
    await tx.query(
      `update onboarding_sessions set status = 'completed', completed_at = now()
        where id = (select onboarding_session_id from shopping_lists where id = $1)`,
      [listId],
    );
  });
  return getShoppingList(db, chefId, listId);
}

