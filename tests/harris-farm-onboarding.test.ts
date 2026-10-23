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
import { parseIngredientLine } from "../server/services/importer/parse.js";
import { parseRecipeFromText } from "../server/services/importer/text.ts";
import { tidyPageTitle } from "../server/services/importer/jsonld.js";
import { detectPageRecipe } from "../server/services/browser.js";

const HARRIS_FARM_HTML = readFileSync(
  new URL("./fixtures/harris-farm-roast-chicken.html", import.meta.url),
  "utf8",
);

const JUNK = [
  "albury",
  "bondi",
  "minimum order",
  "add to cart",
  "new recipes",
  "abn",
  "privacy policy",
  "all rights reserved",
  "terms and conditions",
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
let db: Database;
let server: { base: string; close: () => Promise<void> };
let chef: { token: string; chef: ChefProfile };

before(async () => {
  fixtures = createServer((req, res) => {
    if (req.url === "/roast-chicken") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(HARRIS_FARM_HTML);
      return;
    }
    res.writeHead(404).end("not found");
  });
  await new Promise<void>((resolve) => fixtures.listen(0, "127.0.0.1", () => resolve()));
  const origin = `http://127.0.0.1:${(fixtures.address() as AddressInfo).port}`;
  pageUrl = `${origin}/roast-chicken`;

  db = await freshDatabase();
  server = await startTestServer(db);

  const chefRes = await api<{ token: string; chef: ChefProfile }>(server.base, "/chefs", {
    method: "POST",
    body: { displayName: "Pip", role: "master", avatar: "char1" },
  });
  assert.equal(chefRes.status, 201);
  chef = chefRes.body;
});

after(async () => {
  await server?.close();
  await db?.close();
  await new Promise<void>((resolve) => fixtures.close(() => resolve()));
});

describe("Harris Farm Roast Chicken import — 100% onboarding validation", () => {
  it("trims the site suffix from Harris Farm titles", () => {
    assert.equal(
      tidyPageTitle(
        "Roast Chicken with Fennel, Orange and Hazelnuts – Harris Farm Markets",
        "https://www.harrisfarm.com.au/collections/roast-chicken-with-fennel-orange-and-hazelnuts",
      ),
      "Roast Chicken with Fennel, Orange and Hazelnuts",
    );
  });

  it("imports the Harris Farm Roast Chicken page into a complete draft with 100% confidence", async () => {
    const outcome = await importRecipe(
      { inputType: "url", inputValue: pageUrl },
      { useLlm: false },
    );

    assert.equal(outcome.draft.title, "Roast Chicken with Fennel, Orange and Hazelnuts");
    assert.equal(outcome.draft.baseServings, 4);
    assert.equal(outcome.draft.totalMinutes, 80);
    assert.equal(
      outcome.draft.heroImageUrl,
      "https://cdn.shopify.com/s/files/1/0206/9470/files/chicken_landscape.jpg?v=1792628773",
    );
    assert.equal(outcome.confidence, 1, `expected 1.0 confidence, got ${outcome.confidence}`);
    assert.equal(outcome.draft.ingredients.length, 17, "exactly 17 recipe ingredients");
    assert.equal(outcome.draft.steps.length, 10, "exactly 10 cooking steps");

    // Group captions must be attached to ingredients, not leaked as fake items
    assert.equal(
      outcome.draft.ingredients.some((i) => /^(?:marinade|roasting|dressing|to serve)$/i.test(i.item)),
      false,
      "group headings must not be imported as ingredient items",
    );

    const wine = outcome.draft.ingredients.find((i) => i.item === "white wine");
    assert.equal(wine?.groupName, "Marinade");
    assert.equal(wine?.quantity, 0.5);
    assert.equal(wine?.unit, "cups");

    const dijon = outcome.draft.ingredients.find((i) => i.item === "Dijon mustard");
    assert.equal(dijon?.quantity, 1.5, "1½ parsed as 1.5");
    assert.equal(dijon?.unit, "tbsp");

    const garlic = outcome.draft.ingredients.find((i) => i.item === "garlic");
    assert.equal(garlic?.quantity, 3);
    assert.equal(garlic?.unit, "cloves");
    assert.equal(garlic?.prepNote, "finely grated");

    const chicken = outcome.draft.ingredients.find((i) => /chicken/i.test(i.item));
    assert.equal(chicken?.groupName, "Roasting");
    assert.equal(chicken?.quantity, 1);

    const hazelnuts = outcome.draft.ingredients.find((i) => /hazelnuts/i.test(i.item));
    assert.equal(hazelnuts?.groupName, "To Serve");

    assertNoPageClutter(outcome.draft, "Harris Farm Roast Chicken");
  });

  it("detects the recipe inside the In-App Browser preview", () => {
    const detected = detectPageRecipe(HARRIS_FARM_HTML, pageUrl);
    assert.ok(detected, "browser must detect recipe on Harris Farm page");
    assert.equal(detected.draft.title, "Roast Chicken with Fennel, Orange and Hazelnuts");
    assert.equal(detected.draft.ingredients.length, 17);
    assert.equal(detected.draft.steps.length, 10);
    assert.equal(detected.confidence, 1);
  });
});

describe("AI onboarding flow with Harris Farm Roast Chicken", () => {
  let job: ImportJobView;
  let recipeId = "";

  it("imports the page into an editable review draft via API", async () => {
    const response = await api<{ job: ImportJobView }>(server.base, "/imports", {
      method: "POST",
      token: chef.token,
      body: { inputValue: pageUrl },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    job = response.body.job;

    assert.equal(job.status, "review");
    assert.equal(job.confidence, 1);
    assert.equal(job.draft?.title, "Roast Chicken with Fennel, Orange and Hazelnuts");
    assert.equal(job.draft?.ingredients.length, 17);
    assert.equal(job.draft?.steps.length, 10);
    assert.equal(job.draft?.baseServings, 4);
    assert.equal(job.draft?.totalMinutes, 80);
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
    assert.equal(saved.body.recipe.ingredients.length, 17);
    assert.equal(saved.body.recipe.steps.length, 10);
    assertNoPageClutter(saved.body.recipe as unknown as RecipeDraft, "saved Harris Farm recipe");
  });

  it("scales portions for 6 people and builds an aisle-grouped shopping list with 100% success", async () => {
    const response = await api<OnboardingResult>(server.base, `/recipes/${recipeId}/onboarding`, {
      method: "POST",
      token: chef.token,
      body: { servings: 6, mealOccasion: "dinner", dietary: [], pantry: ["salt", "pepper"] },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const result = response.body;

    assert.equal(result.baseServings, 4);
    assert.equal(result.servings, 6);
    assert.equal(result.scaleFactor, 1.5);
    assert.equal(result.ingredients.length, 17);

    // 1 chicken × 1.5 = 1.5 whole chicken
    const chicken = result.ingredients.find((i) => /chicken/i.test(i.item));
    assert.equal(chicken?.scaled, 1.5);

    // 2 tbsp olive oil (marinade) × 1.5 = 3 tbsp
    const oil = result.ingredients.find((i) => i.item === "extra virgin olive oil" && i.groupName === "Marinade");
    assert.equal(oil?.scaled, 3);
    assert.equal(oil?.quantityText, "3 tbsp");

    // ½ cup white wine × 1.5 = ¾ cup
    const wine = result.ingredients.find((i) => i.item === "white wine");
    assert.equal(wine?.scaled, 0.75);
    assert.equal(wine?.quantityText, "¾ cup");

    const list = result.shoppingList;
    // 17 recipe ingredients merge repeated items (olive oil across marinade & dressing) into 15 items
    assert.equal(list.items.length, 15);
    assert.equal(
      list.items.some((item) => /albury|bondi|delivery|cart|recipes/i.test(item.item)),
      false,
      "shopping list contains no page clutter",
    );

    const aisles = list.groups.map((group) => group.aisle);
    assert.ok(aisles.includes("meat"), `expected meat aisle, got ${aisles.join(",")}`);
    assert.ok(aisles.includes("produce"), `expected produce aisle, got ${aisles.join(",")}`);
    assert.ok(aisles.includes("pantry"), `expected pantry aisle, got ${aisles.join(",")}`);

    const meat = list.groups.find((group) => group.aisle === "meat");
    assert.ok(meat?.items.some((i) => /chicken/i.test(i.item)));

    const produce = list.groups.find((group) => group.aisle === "produce");
    assert.ok(produce?.items.some((i) => /onion|orange/i.test(i.item)));
    assert.ok(produce?.items.some((i) => i.item === "orange"));
    assert.ok(produce?.items.some((i) => i.item === "garlic"));
  });
});

describe("Validation of all available Harris Farm recipes online", () => {
  it("onboards Crispy Roasted Potatoes with Fennel Salt (100% success)", () => {
    const text = `
Crispy Roasted Potatoes with Fennel Salt
**Prep time:** 10-15 minutes
**Cook time:** 1 hour 40 minutes
**Serves:** 4-6

These crispy roasted potatoes are seasoned with a rustic fennel salt.

**Ingredients:**
- 2 kg washed potatoes, cut into 4 cm pieces
- 4 sprigs fresh rosemary
- 8 sprigs fresh thyme
- 8 garlic cloves, peeled
- ½ cup extra virgin olive oil
- 2 tsp fennel seeds
- 2 tsp salt
- ½ cup finely grated parmesan

**Method:**
1. Preheat the oven to 220°C (200°C fan-forced).
2. Place the potatoes in a large saucepan of salted cold water and bring to the boil.
3. Place the rosemary, thyme and garlic in a small ovenproof dish and roast for 15 minutes.
4. Toast the fennel seeds in a dry frying pan.
5. Add the salt to the fennel seeds and crush.
6. Drain the potatoes well and steam dry for 5 minutes.
7. Transfer to a large baking tray and toss with fennel salt and infused oil.
8. Increase oven to 260°C and roast for 60 minutes until deep golden and crisp.
9. Sprinkle over half the parmesan and grill for 5-10 minutes.
10. Remove from oven and serve topped with remaining parmesan.

**Notes:**
Potatoes are at their crispiest straight from the oven.

New Recipes
Roast Chicken with Fennel, Orange and Hazelnuts
Ingredients for Crispy Roasted Potatoes with Fennel Salt
Washed Potatoes 2kg $6.99ea
    `;

    const draft = parseRecipeFromText(text, { title: "Crispy Roasted Potatoes with Fennel Salt" });
    assert.equal(draft.title, "Crispy Roasted Potatoes with Fennel Salt");
    assert.equal(draft.baseServings, 4);
    assert.equal(draft.totalMinutes, 115);
    assert.equal(draft.ingredients.length, 8);
    assert.equal(draft.steps.length, 10);
    assertNoPageClutter(draft, "Crispy Roasted Potatoes");
  });

  it("onboards No Fold Dumplings (100% success)", () => {
    const text = `
No Fold Dumplings
Recipe by Dan Dumbrell
**Makes about 20 large dumplings**

**Ingredients:**
- 300g pork mince
- 2 spring onions (sliced)
- 1 Tbsp minced garlic
- 1 Tbsp minced ginger
- 1/2 tsp salt
- 1/2 tsp ground pepper
- 1 Tbsp light soy sauce
- 1 Tbsp Chinese cooking wine
- 1 tsp sesame oil
- 1 tsp sugar
- 20 egg wonton dumpling wrappers

**Method:**
1) In a bowl, mix pork mince, spring onions, garlic, ginger, salt, pepper, soy sauce, cooking wine, sesame oil and sugar until well combined.
2) Scoop about 1 tablespoon of filling onto baking paper. Brush one side of a wonton wrapper with water then place the wrapper wet side down over the filling and gently press while turning to seal into a siumai shape.
3) Place folded siumai in a steamer and steam over gently boiling water for 10–12 minutes or until cooked through. Serve hot with chilli oil or soy sauce.

### New Recipes
Roast Chicken with Fennel, Orange and Hazelnuts
Ingredients for No Fold Dumplings
Valenca Free Range Pork Mince 500g $8.99ea
    `;

    const draft = parseRecipeFromText(text, { title: "No Fold Dumplings" });
    assert.equal(draft.title, "No Fold Dumplings");
    assert.equal(draft.baseServings, 20);
    assert.equal(draft.ingredients.length, 11);
    assert.equal(draft.steps.length, 3);
    assertNoPageClutter(draft, "No Fold Dumplings");
  });

  it("onboards Mango Eton Mess (100% success)", () => {
    const text = `
Mango Eton Mess
**Prep time:** 15-20 minutes
**Serves:** 4

Mango, Pistachio and Lime Eton Mess is a rustic, layered dessert.

**Ingredients:**
- 1 pavlova base, broken up
- 600 ml thickened cream
- 2 tbsp icing sugar
- 1 tsp vanilla essence
- 500 g coconut and passion fruit yoghurt
- two ripe Kensington Pride mangoes, cheeks sliced
- ¼ cup pistachios, roughly crushed
- ½ lime, finely grated zest

**Method:**
1. Break any larger pieces of the pavlova base into medium-sized chunks.
2. Place the thickened cream, icing sugar and vanilla essence into a bowl and whisk to firm peaks.
3. Spread yoghurt over a serving platter and scatter with pavlova, cream and mango.
4. Repeat layers with remaining pavlova, whipped cream, yoghurt and mango.
5. Finish with crushed pistachios and lime zest. Serve immediately.

### New Recipes
Roast Chicken with Fennel, Orange and Hazelnuts
    `;

    const draft = parseRecipeFromText(text, { title: "Mango Eton Mess" });
    assert.equal(draft.title, "Mango Eton Mess");
    assert.equal(draft.baseServings, 4);
    assert.equal(draft.totalMinutes, 20);
    assert.equal(draft.ingredients.length, 8);
    const mango = draft.ingredients.find((i) => /mango/i.test(i.item));
    assert.equal(mango?.quantity, 2, "word 'two' recognised as quantity 2");
    assert.equal(draft.steps.length, 5);
    assertNoPageClutter(draft, "Mango Eton Mess");
  });

  it("onboards Tomato Salad with Tomato Dressing (100% success)", () => {
    const text = `
Tomato Salad with Tomato Dressing
**Prep time:** 20minutes
**Cook time:** 10 minutes, plus 10 minutes resting
**Serves:** 4–6

A festive tomato salad with creamy burrata.

**Ingredients:**

**Crispy Baguette**
- ¼ baguette, thinly sliced
- 1 tbsp extra virgin olive oil
- salt, to taste

**Pickled Onion**
- ½ Spanish onion, thinly sliced
- ¼ cup red wine vinegar or sherry vinegar
- 2 tbsp caster sugar

**Tomatoes**
- 250 g Kumato tomatoes
- 500 g heirloom tomatoes
- 200 g yellow grape tomatoes
- 250 g Medley Mix tomatoes
- 2 tbsp red wine vinegar or sherry vinegar
- salt, to taste

**Dressing**
- ¼ cup extra virgin olive oil
- freshly cracked black pepper, to taste

**To Serve:**
- 2–3 burrata balls
- ½ cup fresh basil leaves
- freshly cracked black pepper, to taste

**Method:**
1. Preheat oven to 220°C and bake baguette slices for 7-10 minutes until golden and crisp.
2. Combine vinegar and sugar in a small saucepan and warm until sugar dissolves.
3. Add sliced onion and set aside for 15 minutes to pickle.
4. Cut tomatoes into bite-sized pieces and season with salt and 2 tbsp vinegar.
5. Set tomatoes aside for 10 minutes to release juices.
6. Strain tomato juices into a bowl and whisk with olive oil and pepper to make dressing.
7. Arrange tomatoes and crispy baguette pieces on a platter and tear burrata over top.
8. Spoon dressing over salad, scatter with pickled onion and basil leaves. Serve.

**Notes**
Assemble salad just before serving.

New Recipes
Mango Eton Mess
    `;

    const draft = parseRecipeFromText(text, { title: "Tomato Salad with Tomato Dressing" });
    assert.equal(draft.title, "Tomato Salad with Tomato Dressing");
    assert.equal(draft.baseServings, 4);
    assert.equal(draft.totalMinutes, 30);
    assert.equal(draft.ingredients.length, 17);
    assert.equal(draft.steps.length, 8);
    // Group names should be attached
    const burrata = draft.ingredients.find((i) => /burrata/i.test(i.item));
    assert.equal(burrata?.groupName, "To Serve");
    assert.equal(burrata?.quantity, 2);
    assertNoPageClutter(draft, "Tomato Salad");
  });

  it("onboards Sweet Potato, Carrot and Lime Soup with Crispy Pita Bread Dippers (100% success)", () => {
    const text = `
Sweet Potato, Carrot and Lime Soup with Crispy Pita Bread Dippers
Serves 2-4 | Prep 15 mins | Cook 40 mins

A vibrant, earthy-sweet soup made with sweet potato, carrot and makrut lime.

**Ingredients**
- 4 tablespoons olive oil
- 1 red onion, chopped
- 2 carrots, thinly sliced
- 700 g sweet potato (1-2), peeled and chopped
- 2 garlic cloves, smashed
- 2 cups chicken or vegetable stock
- 2 makrut lime leaves
- 1 tablespoon fish sauce
- 2 pita bread pockets
- 1 lime
- Greek or coconut yoghurt, to serve

**Method**
1. Heat 2 tablespoons olive oil in a deep saucepan. Add onion and carrot and cook for 10 minutes.
2. Add sweet potato and garlic, pour in stock, add lime leaves and fish sauce and simmer for 30 minutes.
3. Preheat oven to 180°C. Cut pita into strips, brush with olive oil and bake for 6-8 minutes until golden.
4. Remove lime leaves and blitz soup until smooth.
5. Ladle into bowls, zest lime over top, dollop with yoghurt and serve with crispy pita dippers.

New Recipes
Roast Chicken with Fennel, Orange and Hazelnuts
    `;

    const draft = parseRecipeFromText(text, { title: "Sweet Potato, Carrot and Lime Soup with Crispy Pita Bread Dippers" });
    assert.equal(draft.baseServings, 2);
    assert.equal(draft.totalMinutes, 55);
    assert.equal(draft.ingredients.length, 11);
    assert.equal(draft.steps.length, 5);
    assertNoPageClutter(draft, "Sweet Potato Soup");
  });

  it("onboards Pork And Fennel Sausage Pasta Bake (100% success)", () => {
    const text = `
Pork And Fennel Sausage Pasta Bake
**Prep time:**15 minutes
**Cook time:**40 minutes
**Serves:**4

A rustic one-dish pasta bake loaded with pork and fennel sausages.

**Ingredients:**
- 1 tbsp extra virgin olive oil
- 500g pork and fennel sausages
- 1 brown onion, diced
- 3 garlic cloves, minced
- 2 tbsp tomato paste
- 690g tomato basil passata
- 2 tsp salt
- ¼ tsp pepper
- 1 tsp sugar
- 500g Gnocchi Sardi pasta
- 1 cup fresh basil leaves
- ¾ cup pasta water
- 220g pizza blend cheese

**Method:**
1. Preheat oven to 230°C and bring a large pot of salted water to the boil.
2. Remove sausage meat from casings and crumble into small pieces.
3. Sear sausage meat in a deep pan for 5-6 minutes until golden.
4. Add onion and sauté for 3 minutes, then add garlic for 2 minutes.
5. Add tomato paste and cook for 2 minutes, then add passata.
6. Season with salt, pepper and sugar and simmer for 10 minutes.
7. Cook pasta for 4 minutes less than packet instructions, reserving ¾ cup water.
8. Add basil, pasta and pasta water to the sauce and toss until coated.
9. Top with cheese and bake for 15-20 minutes until golden and bubbling.
10. Finish under the grill for 2 minutes for colour.
11. Rest for 5-10 minutes before serving.

New Recipes
Roast Chicken with Fennel, Orange and Hazelnuts
    `;

    const draft = parseRecipeFromText(text, { title: "Pork And Fennel Sausage Pasta Bake" });
    assert.equal(draft.title, "Pork And Fennel Sausage Pasta Bake");
    assert.equal(draft.baseServings, 4);
    assert.equal(draft.totalMinutes, 55);
    assert.equal(draft.ingredients.length, 13);
    assert.equal(draft.steps.length, 11);
    assertNoPageClutter(draft, "Pork and Fennel Pasta Bake");
  });
});
