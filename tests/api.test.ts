import "./setup.js";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { api, freshDatabase, startTestServer } from "./helpers.js";
import type { Database } from "../server/db/index.js";
import type {
  ChefProfile, ImportJobView, OnboardingResult, RecipeView, SearchResponse, ShoppingListView,
} from "../shared/types.js";

const FIXTURE = `<!doctype html><html><head><title>Chicken Biryani</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe","name":"Chicken Biryani",
 "recipeYield":"6 servings","totalTime":"PT1H15M",
 "image":"https://cdn.example.com/biryani.jpg",
 "recipeIngredient":["750 g chicken thighs","3 cups basmati rice","1 1/2 cups yogurt","2 onions","Salt to taste"],
 "recipeInstructions":[
  {"@type":"HowToStep","text":"Marinate the chicken in yogurt for 30 minutes."},
  {"@type":"HowToStep","text":"Par-boil the rice with whole spices."},
  {"@type":"HowToStep","text":"Layer rice over chicken and cook on low heat for 25 minutes."}]}
</script></head><body></body></html>`;

let db: Database;
let server: { base: string; close: () => Promise<void> };
let fixtures: Server;
let fixtureUrl = "";

let junior: { token: string; chef: ChefProfile };
let teen: { token: string; chef: ChefProfile };

before(async () => {
  fixtures = createServer((req, res) => {
    if (req.url === "/biryani") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(FIXTURE);
      return;
    }
    res.writeHead(404).end("no");
  });
  await new Promise<void>((resolve) => fixtures.listen(0, "127.0.0.1", () => resolve()));
  fixtureUrl = `http://127.0.0.1:${(fixtures.address() as AddressInfo).port}/biryani`;

  db = await freshDatabase();
  server = await startTestServer(db);

  const juniorRes = await api<{ token: string; chef: ChefProfile }>(server.base, "/chefs", {
    method: "POST",
    body: { displayName: "Amina", role: "junior", avatar: "girl1" },
  });
  assert.equal(juniorRes.status, 201);
  junior = juniorRes.body;

  const teenRes = await api<{ token: string; chef: ChefProfile }>(server.base, "/chefs", {
    method: "POST",
    body: { displayName: "Bilal", role: "teen", avatar: "boy1" },
  });
  assert.equal(teenRes.status, 201);
  teen = teenRes.body;
});

after(async () => {
  await server.close();
  fixtures.close();
  await db.close();
});

describe("auth and roles", () => {
  it("lists the four cooking roles", async () => {
    const response = await api<{ roles: Array<{ id: string }> }>(server.base, "/roles");
    assert.deepEqual(
      response.body.roles.map((role) => role.id),
      ["junior", "teen", "adult", "master"],
    );
  });

  it("requires a token for recipe data", async () => {
    const response = await api(server.base, "/recipes");
    assert.equal(response.status, 401);
  });

  it("signs an existing chef back in", async () => {
    const response = await api<{ token: string; chef: ChefProfile }>(server.base, "/chefs/sign-in", {
      method: "POST",
      body: { displayName: "Bilal", role: "teen" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.chef.id, teen.chef.id);
    assert.ok(response.body.token.length > 10);
  });

  it("enforces a PIN when one is set", async () => {
    const created = await api<{ token: string }>(server.base, "/chefs", {
      method: "POST",
      body: { displayName: "Coco", role: "master", pin: "4321" },
    });
    assert.equal(created.status, 201);

    const wrong = await api(server.base, "/chefs/sign-in", {
      method: "POST",
      body: { displayName: "Coco", role: "master", pin: "0000" },
    });
    assert.equal(wrong.status, 401);

    const right = await api(server.base, "/chefs/sign-in", {
      method: "POST",
      body: { displayName: "Coco", role: "master", pin: "4321" },
    });
    assert.equal(right.status, 200);
  });
});

describe("AI onboarding import → private book", () => {
  let job: ImportJobView;
  let recipeId = "";

  it("imports a website recipe into a review draft", async () => {
    const response = await api<{ job: ImportJobView }>(server.base, "/imports", {
      method: "POST",
      token: teen.token,
      body: { inputValue: fixtureUrl },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    job = response.body.job;
    assert.equal(job.status, "review");
    assert.equal(job.method, "jsonld");
    assert.equal(job.draft?.title, "Chicken Biryani");
    assert.equal(job.draft?.ingredients.length, 5);
    assert.equal(job.draft?.steps.length, 3);
    assert.ok((job.confidence ?? 0) >= 0.8);
  });

  it("saves the confirmed draft to the chef's private book and the shared catalogue", async () => {
    const response = await api<{ recipeId: string; catalogueId: string | null; sharedWithCatalogue: boolean }>(
      server.base,
      `/imports/${job.id}/confirm`,
      { method: "POST", token: teen.token, body: {} },
    );
    assert.equal(response.status, 201);
    recipeId = response.body.recipeId;
    assert.ok(response.body.catalogueId);
    assert.equal(response.body.sharedWithCatalogue, true, "teen chefs can publish");
  });

  it("keeps the recipe owned by the importing chef only", async () => {
    const mine = await api<{ recipe: RecipeView }>(server.base, `/recipes/${recipeId}`, { token: teen.token });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.recipe.ownedByMe, true);

    const theirs = await api(server.base, `/recipes/${recipeId}`, { token: junior.token });
    assert.equal(theirs.status, 404, "another chef must never read this recipe");

    const theirBook = await api<{ recipes: RecipeView[] }>(server.base, "/recipes", { token: junior.token });
    assert.equal(theirBook.body.recipes.length, 0);
  });

  it("lets a second chef find the same dish internally instead of importing again", async () => {
    const search = await api<SearchResponse>(server.base, "/search?q=chicken%20biryani", {
      token: junior.token,
    });
    assert.equal(search.status, 200);
    assert.equal(search.body.myRecipes.length, 0);
    assert.equal(search.body.sharedMatches.length, 1);
    assert.equal(search.body.needsOnboarding, false);
    assert.equal(JSON.stringify(search.body).includes(teen.chef.id), false);

    const claimed = await api<{ recipe: RecipeView; alreadyOwned: boolean }>(
      server.base,
      `/catalogue/${search.body.sharedMatches[0].catalogueId}/claim`,
      { method: "POST", token: junior.token },
    );
    assert.equal(claimed.status, 201);
    assert.equal(claimed.body.alreadyOwned, false);
    assert.equal(claimed.body.recipe.title, "Chicken Biryani");
    assert.equal(claimed.body.recipe.ingredients.length, 5);
    assert.equal(claimed.body.recipe.steps.length, 3);
  });

  it("shows the dish in the chef's own book after claiming", async () => {
    const search = await api<SearchResponse>(server.base, "/search?q=chicken%20biryani", {
      token: junior.token,
    });
    assert.equal(search.body.myRecipes.length, 1);
    assert.equal(search.body.message, "Found in your own recipe book.");
  });

  it("asks for AI onboarding only when nothing internal exists", async () => {
    const search = await api<SearchResponse>(server.base, "/search?q=zanzibari%20octopus%20stew", {
      token: junior.token,
    });
    assert.equal(search.body.needsOnboarding, true);
    assert.equal(search.body.myRecipes.length, 0);
    assert.equal(search.body.sharedMatches.length, 0);
  });
});

describe("onboarding interview → portions → shopping list", () => {
  let recipeId = "";
  let listId = "";
  let result: OnboardingResult;

  before(async () => {
    const own = await api<{ recipes: RecipeView[] }>(server.base, "/recipes", { token: junior.token });
    recipeId = own.body.recipes[0].id;
  });

  it("scales every ingredient for the number of people", async () => {
    const response = await api<OnboardingResult>(server.base, `/recipes/${recipeId}/onboarding`, {
      method: "POST",
      token: junior.token,
      body: { servings: 3, mealOccasion: "breakfast", dietary: [], pantry: ["salt"] },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    result = response.body;
    listId = result.shoppingList.id;

    assert.equal(result.baseServings, 6);
    assert.equal(result.servings, 3);
    assert.equal(result.scaleFactor, 0.5);
    assert.match(result.mealHint, /Breakfast for 3 people/);
    assert.match(result.portionNote, /½|0\.5/);

    const rice = result.ingredients.find((ingredient) => ingredient.item.includes("basmati"));
    assert.equal(rice?.quantityText, "1½ cups", "3 cups × 0.5");

    const salt = result.ingredients.find((ingredient) => ingredient.item.toLowerCase().includes("salt"));
    assert.ok(salt, "salt should be on the list");
    assert.equal(salt?.scalable, false, "salt to taste is never scaled");
    assert.equal(salt?.quantityText, "");
  });

  it("builds an aisle-grouped shopping list and skips pantry items", async () => {
    assert.ok(result.shoppingList.groups.length >= 3);
    assert.ok(result.shoppingList.groups.some((group) => group.aisle === "meat"));
    assert.ok(result.shoppingList.groups.some((group) => group.aisle === "pantry"));
    assert.equal(result.shoppingList.totals.alreadyAtHome, 1);
    assert.ok(result.reminders.length >= 1);
  });

  it("limits a junior chef's batch size with a friendly note", async () => {
    const response = await api<OnboardingResult>(server.base, `/recipes/${recipeId}/onboarding`, {
      method: "POST",
      token: junior.token,
      body: { servings: 40, mealOccasion: "late-night-snack" },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.servings, junior.chef.maxBatchServings);
    assert.equal(
      response.body.reminders.some((reminder) => /up to 8 eaters/.test(reminder)),
      true,
    );
  });

  it("persists tick-offs on the shopping list", async () => {
    const list = await api<{ list: ShoppingListView }>(server.base, `/shopping-lists/${listId}`, {
      token: junior.token,
    });
    assert.equal(list.status, 200);
    const item = list.body.list.items.find((entry) => !entry.alreadyAtHome);
    assert.ok(item?.id);

    const toggled = await api<{ list: ShoppingListView }>(
      server.base,
      `/shopping-lists/${listId}/items/${item!.id}`,
      { method: "PATCH", token: junior.token, body: { checked: true } },
    );
    assert.equal(toggled.status, 200);
    assert.equal(toggled.body.list.items.find((entry) => entry.id === item!.id)?.checked, true);
    assert.equal(toggled.body.list.status, "shopping");

    const completed = await api<{ list: ShoppingListView }>(
      server.base,
      `/shopping-lists/${listId}/complete`,
      { method: "POST", token: junior.token, body: {} },
    );
    assert.equal(completed.body.list.status, "complete");
  });

  it("does not let another chef open that shopping list", async () => {
    const response = await api(server.base, `/shopping-lists/${listId}`, { token: teen.token });
    assert.equal(response.status, 404);
  });

  it("does not let another chef start onboarding on that recipe", async () => {
    const response = await api(server.base, `/recipes/${recipeId}/onboarding`, {
      method: "POST",
      token: teen.token,
      body: { servings: 2, mealOccasion: "dinner" },
    });
    assert.equal(response.status, 404);
  });
});

describe("fair-play points", () => {
  it("awards points once per unique dish, server-side", async () => {
    const first = await api<{ awarded: boolean; points: number }>(server.base, "/me/cook-completion", {
      method: "POST",
      token: junior.token,
      body: { recipeTitle: "Chicken Biryani" },
    });
    assert.equal(first.body.awarded, true);
    assert.equal(first.body.points, 50);

    const second = await api<{ awarded: boolean; points: number }>(server.base, "/me/cook-completion", {
      method: "POST",
      token: junior.token,
      body: { recipeTitle: "Chicken Biryani" },
    });
    assert.equal(second.body.awarded, false);
    assert.equal(second.body.points, 50);
  });
});

describe("media uploads", () => {
  it("stores a chef's photo and serves it back", async () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const uploaded = await api<{ url: string }>(server.base, "/uploads", {
      method: "POST",
      token: junior.token,
      body: { dataUrl: png },
    });
    assert.equal(uploaded.status, 201);
    assert.match(uploaded.body.url, /^\/api\/uploads\/.+\.png$/);

    const fetched = await fetch(`${server.base.replace(/\/api$/, "")}${uploaded.body.url}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get("content-type"), "image/png");
  });

  it("rejects a non-image payload", async () => {
    const response = await api(server.base, "/uploads", {
      method: "POST",
      token: junior.token,
      body: { dataUrl: "data:text/plain;base64,aGVsbG8=" },
    });
    assert.equal(response.status, 400);
  });
});
