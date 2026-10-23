import "./setup.js";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, it } from "node:test";
import type { RecipeView, SearchResponse } from "../shared/types.js";

import App from "../src/App.js";
import { ChefGate } from "../src/components/ChefGate.js";
import { MyRecipes } from "../src/components/MyRecipes.js";
import { DbRecipeDetail } from "../src/components/DbRecipeDetail.js";
import { RecipeImporter } from "../src/components/RecipeImporter.js";
import { InternalMatches } from "../src/components/InternalMatches.js";
import { OnboardingFlow } from "../src/components/OnboardingFlow.js";
import { WhatsNewTab } from "../src/components/WhatsNewTab.js";
import { InAppBrowser } from "../src/components/InAppBrowser.js";

const recipe: RecipeView = {
  id: "11111111-1111-1111-1111-111111111111",
  catalogueId: null,
  title: "Test Biryani",
  cuisine: "Pakistani",
  description: "A test recipe",
  difficulty: "Easy",
  baseServings: 4,
  totalMinutes: 45,
  heroImageUrl: null,
  sourceType: "web",
  sourceUrl: "https://example.com/biryani",
  sourceVideoId: null,
  sourceChannel: null,
  sourceAuthor: null,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ownedByMe: true,
  claimedFromCatalogue: false,
  ingredients: [
    { id: "i1", position: 0, quantity: 2, unit: "cups", item: "basmati rice", prepNote: null, groupName: null, scalable: true, rawText: null },
    { id: "i2", position: 1, quantity: null, unit: null, item: "salt", prepNote: null, groupName: null, scalable: false, rawText: "Salt to taste" },
  ],
  steps: [
    { id: "s1", position: 0, instruction: "Wash the rice.", durationSeconds: null, temperatureC: null, imageUrl: null, tip: null },
    { id: "s2", position: 1, instruction: "Cook for 20 minutes.", durationSeconds: 1200, temperatureC: 180, imageUrl: null, tip: "Low heat is best" },
  ],
};

const search: SearchResponse = {
  query: "biryani",
  normalisedQuery: "biryani",
  myRecipes: [],
  sharedMatches: [
    { source: "shared-catalogue", catalogueId: "c1", title: "Chicken Biryani", cuisine: null, heroImageUrl: null, baseServings: 6, totalMinutes: 75, ingredientCount: 12, stepCount: 8 },
  ],
  needsOnboarding: false,
  message: "Found in the shared recipe catalogue.",
};

const noop = () => {};
const characters = [{ id: "girl1", name: "Sunny", title: "Braided Chef", image: "/images/characters/girl1.jpg", emoji: "👧" }];

describe("UI renders without crashing", () => {
  it("renders the welcome screen with What's New access for every user", () => {
    const html = renderToString(createElement(App));
    assert.match(html, /Chef Universe/);
    assert.match(html, /Pick your chef buddy/);
    assert.match(html, /What&#x27;s New/);
  });

  it("renders the What's New tab with in-app browser & AI onboarding highlights", () => {
    const html = renderToString(
      createElement(WhatsNewTab, { chefName: "Sunny", onAction: noop }),
    );
    assert.match(html, /What&#x27;s New for Every Chef/);
    assert.match(html, /In-App Chef Website Browser/);
    assert.match(html, /In-App YouTube Channel/);
    assert.match(html, /Open Website Browser/);
  });

  it("renders the in-app website & YouTube browser without external redirects", () => {
    const html = renderToString(
      createElement(InAppBrowser, {
        initialQuery: "Chicken Biryani",
        onClose: noop,
        onImportWithAi: noop,
      }),
    );
    assert.match(html, /Browse Recipes &amp; YouTube Without Leaving Chef Universe/);
    assert.match(html, /Chef Website &amp; Web Search/);
    assert.match(html, /YouTube Channel &amp; Videos/);
    assert.doesNotMatch(html, /target="_blank"/);
  });

  it("renders the chef gate with roles and avatars", () => {
    const html = renderToString(
      createElement(ChefGate, { characters, onAuthed: noop, onClose: noop }),
    );
    assert.match(html, /My Chef Kitchen/);
    assert.match(html, /Junior Chef/);
    assert.match(html, /Master Chef/);
  });

  it("renders the empty private book with an import call to action", () => {
    const html = renderToString(
      createElement(MyRecipes, {
        recipes: [], loading: false, error: null,
        onOpen: noop, onImport: noop, onDelete: noop, onRefresh: noop, onBack: noop,
      }),
    );
    assert.match(html, /My Recipe Book/);
    assert.match(html, /Import my first recipe/);
  });

  it("renders a database recipe with its photo placeholders", () => {
    const html = renderToString(
      createElement(DbRecipeDetail, { recipe, onBack: noop, onStartPrep: noop, onDelete: noop, deleting: false }),
    );
    assert.match(html, /Test Biryani/);
    assert.match(html, /no photo for this step/);
    assert.match(html, /Prep &amp; shopping list/);
  });

  it("renders the importer input stage", () => {
    const html = renderToString(
      createElement(RecipeImporter, { token: "t", canPublish: true, initialQuery: "", onClose: noop, onSaved: noop }),
    );
    assert.match(html, /AI Recipe Onboarding/);
    assert.match(html, /Import &amp; map this recipe/);
  });

  it("renders internal matches with a copy action", () => {
    const html = renderToString(
      createElement(InternalMatches, {
        result: search, busyId: null, onOpenOwn: noop, onClaim: noop,
        onSearchOnline: noop, onImport: noop, onClose: noop,
      }),
    );
    assert.match(html, /Chicken Biryani/);
    assert.match(html, /Copy to my book/);
  });

  it("renders the onboarding interview questions", () => {
    const html = renderToString(
      createElement(OnboardingFlow, { recipe, token: "t", onCancel: noop, onStartCooking: noop }),
    );
    assert.match(html, /How many people are eating/);
    assert.match(html, /What meal is this for/);
    assert.match(html, /Late-night snack/);
    assert.match(html, /already in your kitchen/);
  });
});
