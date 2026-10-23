import "./setup.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import type {
  ChefProfile, ImportJobView, OnboardingResult, RecipeDraft, RecipeView,
} from "../shared/types.js";
import { api, freshDatabase, startTestServer } from "./helpers.js";
import type { Database } from "../server/db/index.js";
import { importRecipe } from "../server/services/importer/index.js";
import { parseIngredientLine, stripHtml } from "../server/services/importer/parse.js";
import { parseRecipeFromText } from "../server/services/importer/text.js";
import { collapseRepeatedText, isPageNoiseLine } from "../server/services/importer/clean.js";
import { tidyPageTitle } from "../server/services/importer/jsonld.js";

/**
 * A recording of https://www.woolworths.com.au/shop/recipes/healthier-spaghetti-bolognese
 * (fetched 2026-10-23). Woolworths renders the recipe twice — a visible copy
 * and a screen-reader copy — and surrounds it with nutrition tiles, review
 * widgets and "Copy text / Add to list" buttons. Before the cleaner, all of
 * that was imported as ingredients and steps, including review dates like
 * "March 2021" (which became the ingredient "March" with quantity 2021).
 */
const WOOLWORTHS_HTML = readFileSync(
  new URL("./fixtures/woolworths-bolognese.html", import.meta.url),
  "utf8",
);
/** The page as non-browser agents often get it: no schema.org block at all. */
const WOOLWORTHS_NO_JSONLD = WOOLWORTHS_HTML.replace(
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  "",
);

const WOOLWORTHS_TITLE = "Healthier Spaghetti Bolognese";
/** What the page <title>/og:title gives once the "| Woolworths" suffix is trimmed. */
const WOOLWORTHS_PAGE_TITLE = "Healthier Spaghetti Bolognese Recipe";

const JUNK = [
  "number of servings",
  "copy text",
  "add to list",
  "shop recipe",
  "nutrition",
  "protein",
  "carbs",
  "sugars",
  "kilojoule",
  "daily energy intake",
  "march",
  "june",
  "2024",
  "2021",
  "bvseo",
  "reviews",
  "you might also like",
  "abn",
  "woolworths group",
];

function assertNoPageClutter(draft: RecipeDraft, label: string): void {
  for (const ingredient of draft.ingredients) {
    const haystack = `${ingredient.item} ${ingredient.rawText ?? ""}`.toLowerCase();
    for (const word of JUNK) {
      assert.equal(haystack.includes(word), false, `${label}: ingredient leaked "${word}": ${haystack}`);
    }
  }
  for (const step of draft.steps) {
    const haystack = step.instruction.toLowerCase();
    for (const word of JUNK) {
      assert.equal(haystack.includes(word), false, `${label}: step leaked "${word}": ${haystack}`);
    }
  }
}

let fixtures: Server;
let pageUrl = "";
let blockedUrl = "";
let db: Database;
let server: { base: string; close: () => Promise<void> };
let chef: { token: string; chef: ChefProfile };

before(async () => {
  fixtures = createServer((req, res) => {
    if (req.url === "/woolworths") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(WOOLWORTHS_HTML);
      return;
    }
    if (req.url === "/woolworths-no-jsonld") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(WOOLWORTHS_NO_JSONLD);
      return;
    }
    res.writeHead(404).end("not found");
  });
  await new Promise<void>((resolve) => fixtures.listen(0, "127.0.0.1", () => resolve()));
  const origin = `http://127.0.0.1:${(fixtures.address() as AddressInfo).port}`;
  pageUrl = `${origin}/woolworths`;
  blockedUrl = `${origin}/woolworths-no-jsonld`;

  db = await freshDatabase();
  server = await startTestServer(db);
  const created = await api<{ token: string; chef: ChefProfile }>(server.base, "/chefs", {
    method: "POST",
    body: { displayName: "Sofia", role: "teen", avatar: "girl2" },
  });
  assert.equal(created.status, 201);
  chef = created.body;
});

after(async () => {
  await server.close();
  fixtures.close();
  await db.close();
});

describe("Woolworths recipe import — page clutter is filtered out", () => {
  it("reads the schema.org recipe exactly (13 ingredients, 3 steps, 6 servings)", async () => {
    const outcome = await importRecipe({ inputType: "url", inputValue: pageUrl });
    const draft = outcome.draft;

    assert.equal(outcome.method, "jsonld");
    assert.equal(draft.title, WOOLWORTHS_TITLE);
    assert.equal(draft.baseServings, 6);
    assert.equal(draft.totalMinutes, 40);
    assert.equal(draft.ingredients.length, 13);
    assert.equal(draft.steps.length, 3);
    assert.equal(draft.ingredients[0].quantity, 2);
    assert.equal(draft.ingredients[0].unit, "tsp");
    assert.equal(draft.ingredients[0].item, "extra virgin olive oil");
    assert.equal(draft.ingredients[4].item, "lean beef mince");
    assert.equal(draft.ingredients[4].quantity, 500);
    assertNoPageClutter(draft, "jsonld");
  });

  it("reads the same recipe when the site serves a page with no schema.org block", async () => {
    const outcome = await importRecipe({ inputType: "url", inputValue: blockedUrl });
    const draft = outcome.draft;

    assert.equal(outcome.method, "heuristic");
    assert.equal(draft.title, WOOLWORTHS_PAGE_TITLE, "the site-name suffix is trimmed from the page title");
    assert.equal(draft.ingredients.length, 13, "screen-reader duplicates collapsed");
    assert.equal(draft.steps.length, 3);
    assert.equal(draft.baseServings, 6, "servings come from 'Serve is for 6 people', not from the first ingredient");
    assert.equal(draft.totalMinutes, 40, "prep + cook are added up");
    assert.equal(draft.ingredients[1].item, "brown onion");
    assert.equal(draft.ingredients[1].prepNote, "finely chopped");
    assert.equal(draft.steps[0].instruction.startsWith("Heat oil in a large"), true, "no 'of 3' prefix");
    assertNoPageClutter(draft, "heuristic");

    const noiseNote = outcome.warnings.find((warning) => /left out/i.test(warning));
    assert.ok(noiseNote, `expected a clutter warning, got ${JSON.stringify(outcome.warnings)}`);
  });

  it("filters the stripped page text the same way (OCR / paste path)", () => {
    const text = stripHtml(WOOLWORTHS_NO_JSONLD);
    const report = { skippedNoiseLines: 0, collapsedDuplicates: 0 };
    const draft = parseRecipeFromText(text, { title: WOOLWORTHS_TITLE, report });

    assert.equal(draft.ingredients.length, 13);
    assert.equal(draft.steps.length, 3);
    assert.equal(draft.baseServings, 6);
    assert.equal(draft.totalMinutes, 40);
    assertNoPageClutter(draft, "text");
    assert.ok(report.skippedNoiseLines > 0, "the parser counts what it skipped");
  });
});

describe("dates, months and years never become ingredients or steps", () => {
  it("drops review dates from an ingredient-style line", () => {
    for (const line of [
      "Published March 2021",
      "Updated: June 2024",
      "Reviewed by Sarah on 12 March 2024",
      "2021",
      "2026-10-23T11:03-04:00",
      "12/03/2024",
    ]) {
      assert.equal(parseIngredientLine(line, 0), null, `"${line}" must not be an ingredient`);
      assert.equal(isPageNoiseLine(line), true, `"${line}" must be flagged as page noise`);
    }
  });

  it("still reads real ingredients that contain numbers", () => {
    const parsed = parseIngredientLine("500g lean beef mince", 0);
    assert.equal(parsed?.quantity, 500);
    assert.equal(parsed?.unit, "g");
    assert.equal(parsed?.item, "lean beef mince");

    const updated = parseIngredientLine("2 tbs tomato paste", 1);
    assert.equal(updated?.unit, "tbsp");
    assert.equal(updated?.item, "tomato paste");

    const garlic = parseIngredientLine("2 cloves garlic, crushed", 2);
    assert.equal(garlic?.unit, "cloves", "plural units are understood");
    assert.equal(garlic?.item, "garlic");

    const flour = parseIngredientLine("2 cups (250g) plain flour", 3);
    assert.equal(flour?.unit, "cups");
    assert.equal(flour?.item, "plain flour", "the bracketed equivalent is not part of the item");
  });

  it("keeps 'March' out of a pasted recipe but keeps the method whole", () => {
    const draft = parseRecipeFromText(
      `Grandma's Apple Cake
Serves 8

Ingredients:
- 2 cups flour
- 3 apples, peeled
- 1 cup sugar
- 1 tsp cinnamon

Method:
1. Heat the oven to 180C.
2. Mix the flour, sugar and cinnamon, then fold in the apples.
3. Bake for 45 minutes.

Published March 2021 | Updated June 2024
© Example Kitchen Pty Ltd 2024`,
      { title: "Grandma's Apple Cake" },
    );

    assert.equal(draft.ingredients.length, 4);
    assert.equal(draft.steps.length, 3);
    assert.equal(draft.baseServings, 8);
    assert.equal(draft.ingredients.some((ingredient) => /march|june|2024|2021/i.test(ingredient.item)), false);
    assert.equal(draft.steps.some((step) => /march|june|©/i.test(step.instruction)), false);
  });

  it("trims the shop name off a page title but keeps real subtitles", () => {
    assert.equal(
      tidyPageTitle("Healthier Spaghetti Bolognese Recipe | Woolworths", "https://www.woolworths.com.au/x"),
      "Healthier Spaghetti Bolognese Recipe",
    );
    assert.equal(tidyPageTitle("Biryani", "https://example.com/biryani"), "Biryani");
  });

  it("collapses a screen-reader duplicate into one ingredient", () => {
    assert.equal(
      collapseRepeatedText("2 tsp extra virgin olive oil 2teaspoons extra virgin olive oil"),
      "2 tsp extra virgin olive oil",
    );
    assert.equal(
      collapseRepeatedText("500g lean beef mince 500grams lean beef mince"),
      "500g lean beef mince",
    );
    // Genuine compound lines are left alone.
    assert.equal(collapseRepeatedText("2 x 400g tins chopped tomatoes"), "2 x 400g tins chopped tomatoes");
  });
});

describe("AI onboarding with the Woolworths recipe", () => {
  let job: ImportJobView;
  let recipeId = "";

  it("imports the page into an editable review draft", async () => {
    const response = await api<{ job: ImportJobView }>(server.base, "/imports", {
      method: "POST",
      token: chef.token,
      body: { inputValue: blockedUrl },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    job = response.body.job;

    assert.equal(job.status, "review");
    assert.equal(job.draft?.ingredients.length, 13);
    assert.equal(job.draft?.steps.length, 3);
    assert.equal(job.draft?.baseServings, 6);
    assert.equal(job.warnings.some((warning) => /left out/i.test(warning)), true);
  });

  it("saves the reviewed draft to the chef's private book", async () => {
    const response = await api<{ recipeId: string; sharedWithCatalogue: boolean }>(
      server.base,
      `/imports/${job.id}/confirm`,
      { method: "POST", token: chef.token, body: {} },
    );
    assert.equal(response.status, 201, JSON.stringify(response.body));
    recipeId = response.body.recipeId;
    assert.ok(recipeId);

    const saved = await api<{ recipe: RecipeView }>(server.base, `/recipes/${recipeId}`, { token: chef.token });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.recipe.ingredients.length, 13);
    assertNoPageClutter(saved.body.recipe as unknown as RecipeDraft, "saved");
  });

  it("scales portions for 4 people and builds an aisle-grouped shopping list", async () => {
    const response = await api<OnboardingResult>(server.base, `/recipes/${recipeId}/onboarding`, {
      method: "POST",
      token: chef.token,
      body: { servings: 4, mealOccasion: "dinner", dietary: [], pantry: ["salt", "pepper"] },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const result = response.body;

    assert.equal(result.baseServings, 6);
    assert.equal(result.servings, 4);
    assert.equal(result.ingredients.length, 13);

    const mince = result.ingredients.find((ingredient) => ingredient.item === "lean beef mince");
    assert.equal(mince?.quantityText, "330g", "500g × 4/6 rounded to a kitchen-friendly 330g");

    const oil = result.ingredients.find((ingredient) => ingredient.item === "extra virgin olive oil");
    assert.equal(oil?.quantityText, "1¼ tsp", "2 tsp × 4/6 = 1.33 → rounded to 1¼ tsp");

    const list = result.shoppingList;
    assert.equal(list.items.length, 13, "one row per real ingredient");
    assert.equal(
      list.items.some((item) => /servings|nutrition|protein|march|june|bvseo|copy text/i.test(item.item)),
      false,
      "shopping list contains no page clutter",
    );
    const aisles = list.groups.map((group) => group.aisle);
    assert.ok(aisles.includes("meat"), `expected a meat aisle, got ${aisles.join(",")}`);
    assert.ok(aisles.includes("produce"), `expected a produce aisle, got ${aisles.join(",")}`);
    assert.ok(aisles.includes("pantry"), `expected a pantry aisle, got ${aisles.join(",")}`);

    const meat = list.groups.find((group) => group.aisle === "meat");
    assert.equal(meat?.items[0].item, "lean beef mince");
    assert.equal(meat?.items[0].quantityText, "330g");
  });
});
