import "./setup.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Database } from "../server/db/index.js";
import { createChef, freshDatabase, type TestChef } from "./helpers.js";

let db: Database;
let amina: TestChef;
let bilal: TestChef;

async function addRecipe(chef: TestChef, title: string): Promise<string> {
  const { insertChefRecipe } = await import("../server/services/recipes.js");
  return db.withChef(chef.id, (tx) =>
    insertChefRecipe(tx, chef.id, {
      title,
      cuisine: "Pakistani",
      description: "Family recipe",
      difficulty: "Easy",
      baseServings: 4,
      totalMinutes: 45,
      heroImageUrl: null,
      sourceType: "manual",
      sourceUrl: null,
      sourceVideoId: null,
      sourceChannel: null,
      sourceAuthor: null,
      ingredients: [
        { position: 0, quantity: 2, unit: "cups", item: "rice", prepNote: null, groupName: null, scalable: true, rawText: null },
      ],
      steps: [
        { position: 0, instruction: "Wash the rice.", durationSeconds: null, temperatureC: null, imageUrl: null, tip: null },
      ],
    }),
  );
}

before(async () => {
  db = await freshDatabase();
  amina = await createChef(db, "Amina", "junior");
  bilal = await createChef(db, "Bilal", "teen");
});

after(async () => {
  await db.close();
});

describe("role-scoped recipe books", () => {
  it("a chef can read their own recipe", async () => {
    const { loadChefRecipe } = await import("../server/services/recipes.js");
    const id = await addRecipe(amina, "Amina's Rice");
    const recipe = await db.withChef(amina.id, (tx) => loadChefRecipe(tx, id));
    assert.equal(recipe?.title, "Amina's Rice");
    assert.equal(recipe?.ownedByMe, true);
  });

  it("another chef gets nothing back — not even a row count", async () => {
    const { loadChefRecipe, listChefRecipes } = await import("../server/services/recipes.js");
    const id = await addRecipe(amina, "Secret Nihari");

    const stolen = await db.withChef(bilal.id, (tx) => loadChefRecipe(tx, id));
    assert.equal(stolen, null);

    const bilalBook = await db.withChef(bilal.id, (tx) => listChefRecipes(tx));
    assert.equal(bilalBook.some((recipe) => recipe.title === "Secret Nihari"), false);
  });

  it("row-level security blocks a WHERE clause that forgets the owner", async () => {
    const id = await addRecipe(amina, "RLS Proof");
    const rows = await db.withChef(bilal.id, (tx) =>
      tx.query(`select id from chef_recipes where id = $1`, [id]),
    );
    assert.equal(rows.rows.length, 0);

    const all = await db.withChef(bilal.id, (tx) => tx.query(`select id from chef_recipes`));
    assert.equal(
      all.rows.every((row) => row.id !== id),
      true,
    );
  });

  it("cannot update or delete another chef's recipe", async () => {
    const id = await addRecipe(amina, "Hands Off");
    const updated = await db.withChef(bilal.id, (tx) =>
      tx.query(`update chef_recipes set title = 'Hacked' where id = $1 returning id`, [id]),
    );
    assert.equal(updated.rows.length, 0);

    const deleted = await db.withChef(bilal.id, (tx) =>
      tx.query(`delete from chef_recipes where id = $1 returning id`, [id]),
    );
    assert.equal(deleted.rows.length, 0);

    const { loadChefRecipe } = await import("../server/services/recipes.js");
    const stillThere = await db.withChef(amina.id, (tx) => loadChefRecipe(tx, id));
    assert.equal(stillThere?.title, "Hands Off");
  });

  it("cannot read another chef's shopping list or onboarding session", async () => {
    await assert.rejects(async () => {
      const { getShoppingList } = await import("../server/services/onboarding.js");
      await getShoppingList(db, bilal.id, "00000000-0000-0000-0000-000000000000");
    });
  });

  it("search only returns the requesting chef's own copies", async () => {
    const { findInternalMatches } = await import("../server/services/recipes.js");
    await addRecipe(bilal, "Bilal Only Curry");
    const aminaSearch = await findInternalMatches(db, amina.id, "Bilal Only Curry");
    assert.equal(aminaSearch.myRecipes.length, 0);
    assert.equal(aminaSearch.sharedMatches.length, 0);

    const bilalSearch = await findInternalMatches(db, bilal.id, "Bilal Only Curry");
    assert.equal(bilalSearch.myRecipes.length, 1);
  });

  it("the shared catalogue copy never reveals who imported it", async () => {
    const { ensureCatalogueRecipe } = await import("../server/services/recipes.js");
    const ensured = await ensureCatalogueRecipe(
      db,
      {
        title: "Shared Seekh Kebab",
        cuisine: "Pakistani",
        description: null,
        difficulty: "Easy",
        baseServings: 4,
        totalMinutes: 30,
        heroImageUrl: null,
        sourceType: "web",
        sourceUrl: "https://example.com/kebab",
        sourceVideoId: null,
        sourceChannel: null,
        sourceAuthor: null,
        ingredients: [
          { position: 0, quantity: 500, unit: "g", item: "minced beef", prepNote: null, groupName: null, scalable: true, rawText: null },
        ],
        steps: [
          { position: 0, instruction: "Mix and grill.", durationSeconds: null, temperatureC: null, imageUrl: null, tip: null },
        ],
      },
      bilal.id,
    );

    const row = await db.query(`select * from catalogue_recipes where id = $1`, [ensured.id]);
    assert.equal(row.rows[0].created_by_chef, bilal.id, "provenance kept internally");

    const { findInternalMatches } = await import("../server/services/recipes.js");
    const result = await findInternalMatches(db, amina.id, "Shared Seekh Kebab");
    assert.equal(result.sharedMatches.length, 1);
    const returned = JSON.stringify(result);
    assert.equal(returned.includes(bilal.id), false, "chef id must never leak to another chef");
    assert.equal(returned.toLowerCase().includes("bilal"), false, "importer name must never leak");
    assert.equal("createdByChef" in (result.sharedMatches[0] as object), false);
  });
});
