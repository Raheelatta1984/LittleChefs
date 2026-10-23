import "./setup.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import type { ImportJobView, OcrImportResponse, OnboardingResult, RecipeDraft } from "../shared/types.js";
import { ApiError } from "../server/lib/errors.js";
import { importDishByCascade, parseDishRequest } from "../server/services/cascade.js";
import { importRecipe } from "../server/services/importer/index.js";
import { parseIngredientLine } from "../server/services/importer/parse.js";
import { parseRecipeFromText } from "../server/services/importer/text.js";
import { ensureCatalogueRecipe } from "../server/services/recipes.js";
import type { Database } from "../server/db/index.js";
import { api, createChef, freshDatabase, type TestChef } from "./helpers.js";

/**
 * Fixtures modelled on the REAL Food Fusion "Balochi Chicken Tikka boti" page
 * and its YouTube description (fetched 2026-10-23): trailing quantities in
 * `tbs`, Roman-Urdu + (English) names, group captions, then the whole recipe
 * repeated under "Ajza:" in Roman Urdu.
 */
const BALOCHI_VIDEO_ID = "4vPWbp3ajxU";

const FOOD_FUSION_TEXT = `Ingredients:

Prepare Balochi Tikka Boti:

-Sabut dhania (Coriander seeds) ½ tbs
-Lal mirch (Red chilli) crushed ½ tbs
-Zeera (Cumin seeds) roasted & crushed ½ tbs
-Kali mirch powder (Black pepper powder) 1 tsp
-Chaat masala 1 tsp
-Garam masala powder 1 tsp
-Namak (Salt) 1 tsp or to taste
-Karahi masasla ½ tbs
-Kasuri methi (Dried fenugreek leaves) ½ tbs
-Cooking oil ½ Cup
-Hari mirch (Green chillies) 7-8
-Adrak (Ginger) crushed 1 tbs
-Lehsan (Garlic) crushed 1 tbs
-Chicken karahi cut 500g
-Lemon juice 1 tbs

Directions:

Prepare Balochi Tikka Boti:

-In a bowl,add coriander seeds,red chilli crushed,cumin seeds,black pepper powder,chaat masala, garam masala powder,salt,karahi masala,dried fenugreek leaves & mix well.Balochi tikka spice mix is ready!
-In a wok,add cooking oil,green chillies (slit with the help of knife) and fry until light brown.
-Add ginger,garlic,mix well and cook for 2 minutes.
-Add chicken & mix well,cover and cook on low flame for 4-5 minutes then cook on high flame until oil separates.
-Add Balochi tikka spice mix (1-2 tbs),lemon juice,cover & simmer on low flame for 1-2 minutes.
-Sprinkle Balochi tikka spice mix,fresh coriander & lemon juice.
-Garnish with onion rings,lemon wedges & serve hot with naan!

Ajza:

Prepare Balochi Tikka Boti:

-Sabut dhania (Coriander seeds) ½ tbs
-Lal mirch (Red chilli) crushed ½ tbs`;

const FOOD_FUSION_RECIPE_HTML = `<!doctype html><html><head>
<title>Balochi Chicken Tikka boti - Food Fusion</title>
<meta property="og:image" content="https://media.foodfusion.com/balochi.jpg">
</head><body>
<nav>Home Recipes English Urdu</nav>
<h1>Balochi Chicken Tikka boti</h1>
<iframe src="https://www.youtube.com/embed/${BALOCHI_VIDEO_ID}"></iframe>
<h2>Ingredients:</h2>
<p><strong>Prepare Balochi Tikka Boti:</strong></p>
<ul>
<li>-Sabut dhania (Coriander seeds) ½ tbs</li>
<li>-Lal mirch (Red chilli) crushed ½ tbs</li>
<li>-Zeera (Cumin seeds) roasted &amp; crushed ½ tbs</li>
<li>-Kali mirch powder (Black pepper powder) 1 tsp</li>
<li>-Chaat masala 1 tsp</li>
<li>-Namak (Salt) 1 tsp or to taste</li>
<li>-Cooking oil ½ Cup</li>
<li>-Hari mirch (Green chillies) 7-8</li>
<li>-Adrak (Ginger) crushed 1 tbs</li>
<li>-Lehsan (Garlic) crushed 1 tbs</li>
<li>-Chicken karahi cut 500g</li>
<li>-Lemon juice 1 tbs</li>
</ul>
<h2>Directions:</h2>
<ul>
<li>-In a bowl,add all the dry spices and mix well. Balochi tikka spice mix is ready!</li>
<li>-In a wok,add cooking oil and green chillies and fry until light brown.</li>
<li>-Add ginger and garlic, mix well and cook for 2 minutes.</li>
<li>-Add chicken, cover and cook on low flame for 15 minutes until oil separates.</li>
<li>-Add spice mix and lemon juice, garnish and serve hot with naan.</li>
</ul>
<h2>Ajza:</h2>
<ul><li>-Sabut dhania (Coriander seeds) ½ tbs</li></ul>
</body></html>`;

const FOOD_FUSION_SEARCH_HTML = `<!doctype html><html><head><title>Search Results - Food Fusion</title></head><body>
<article>
  <h2><a href="https://www.foodfusion.com/recipe/chicken-karahi-gosht/">Chicken Karahi Gosht</a></h2>
  <p>Classic restaurant style karahi.</p>
</article>
<article>
  <h2><a href="https://www.foodfusion.com/recipe/balochi-chicken-tikka-boti/">Balochi Chicken Tikka boti</a></h2>
  <img src="https://media.foodfusion.com/balochi-thumb.jpg">
  <p>Highway style Balochi chicken with karahi spices.</p>
</article>
</body></html>`;

const DDG_HTML = `<!doctype html><html><body>
<a class="result__a" href="https://duckduckgo.com/l/?uddg=${encodeURIComponent("https://www.foodfusion.com/recipe/balochi-chicken-tikka-boti/")}">Balochi Chicken Tikka boti - Food Fusion</a>
</body></html>`;

const YOUTUBE_SEARCH_HTML = `<!doctype html><html><head><title>YouTube</title></head><body>
<script>var ytInitialData = {"contents":{"x":[{"videoRenderer":{
  "videoId":"${BALOCHI_VIDEO_ID}",
  "title":{"runs":[{"text":"Balochi Chicken Tikka Boti Recipe By Food Fusion (Eid Special)"}]},
  "ownerText":{"runs":[{"text":"Food Fusion"}]},
  "lengthText":{"simpleText":"3:12"}
}},{"videoRenderer":{
  "videoId":"DecoyVideo1",
  "title":{"runs":[{"text":"Random Vlog Day 4"}]},
  "ownerText":{"runs":[{"text":"Some Channel"}]}
}}]}};</script>
</body></html>`;

const YOUTUBE_WATCH_HTML = `<!doctype html><html><head>
<meta name="title" content="Balochi Chicken Tikka Boti Recipe By Food Fusion (Eid Special)">
</head><body><script>var ytInitialPlayerResponse = {"videoDetails":{
"shortDescription":${JSON.stringify(`An Eid special balochi chicken tikka boti recipe for you. #FoodFusion\n\nWritten Recipe:\n\n${FOOD_FUSION_TEXT}`)},
"ownerChannelName":"Food Fusion"
}};</script></body></html>`;

const OCR_TEXT = `Chicken Balochi Karahi

Ingredients:
1 kg chicken, cut into pieces
0.5 cup cooking oil
1 tbs ginger, crushed
1 tbs garlic, crushed
7 green chillies, slit
1 tsp black pepper powder
1 tsp chaat masala
Salt to taste

Method:
1. Heat oil in a karahi and fry the green chillies until light brown.
2. Add ginger and garlic and cook for 2 minutes.
3. Add chicken, cover and cook on low flame for 15 minutes until tender.
4. Sprinkle the spices, mix well and serve hot with naan.`;

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "content-type": "text/html" } });
}

/** URL-routed fetch stub; unmatched URLs 404 like a dead upstream. */
function stubFetch(routes: Array<[RegExp, () => Response]>, calls: string[] = []): typeof fetch {
  return (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    for (const [pattern, make] of routes) {
      if (pattern.test(url)) return make();
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

const websiteRoutes: Array<[RegExp, () => Response]> = [
  [/foodfusion\.com\/\?s=/i, () => htmlResponse(FOOD_FUSION_SEARCH_HTML)],
  [/foodfusion\.com\/recipe\/balochi-chicken-tikka-boti/i, () => htmlResponse(FOOD_FUSION_RECIPE_HTML)],
  [/html\.duckduckgo\.com/i, () => htmlResponse(DDG_HTML)],
  [/youtube\.com\/oembed/i, () =>
    new Response(JSON.stringify({ title: "Balochi Chicken Tikka Boti Recipe By Food Fusion (Eid Special)", author_name: "Food Fusion" }), {
      headers: { "content-type": "application/json" },
    })],
  [/youtube\.com\/watch\?v=/i, () => htmlResponse(YOUTUBE_WATCH_HTML)],
];

const youtubeOnlyRoutes: Array<[RegExp, () => Response]> = [
  [/youtube\.com\/results\?search_query=/i, () => htmlResponse(YOUTUBE_SEARCH_HTML)],
  [/youtube\.com\/oembed/i, () =>
    new Response(JSON.stringify({ title: "Balochi Chicken Tikka Boti Recipe By Food Fusion (Eid Special)", author_name: "Food Fusion" }), {
      headers: { "content-type": "application/json" },
    })],
  [/youtube\.com\/watch\?v=/i, () => htmlResponse(YOUTUBE_WATCH_HTML)],
];

describe("Food Fusion ingredient lines (trailing quantities)", () => {
  it("parses 'Name (English) ½ tbs' with quantity, unit and English item", () => {
    const parsed = parseIngredientLine("Sabut dhania (Coriander seeds) ½ tbs", 0);
    assert.equal(parsed?.quantity, 0.5);
    assert.equal(parsed?.unit, "tbsp");
    assert.equal(parsed?.item, "Coriander seeds");
  });

  it("parses ranges, glued weights and 'or to taste'", () => {
    const chillies = parseIngredientLine("Hari mirch (Green chillies) 7-8", 0);
    assert.equal(chillies?.quantity, 7);
    assert.equal(chillies?.item, "Green chillies");

    const chicken = parseIngredientLine("Chicken karahi cut 500g", 0);
    assert.equal(chicken?.quantity, 500);
    assert.equal(chicken?.unit, "g");

    const salt = parseIngredientLine("Namak (Salt) 1 tsp or to taste", 0);
    assert.equal(salt?.item, "Salt");
    assert.equal(salt?.scalable, false);
    assert.equal(salt?.quantity, null, "to-taste quantities are never scaled");
  });

  it("still parses classic leading quantities and never eats step lines", () => {
    const flour = parseIngredientLine("2 cups plain flour", 0);
    assert.equal(flour?.quantity, 2);
    assert.equal(flour?.unit, "cups");
    assert.equal(flour?.item, "plain flour");

    const stepLike = parseIngredientLine("cook for 2 minutes", 0);
    assert.equal(stepLike?.quantity, null);
  });
});

describe("Food Fusion description parsing", () => {
  it("maps quantities, groups and steps — and stops at the Roman-Urdu repeat", () => {
    const draft = parseRecipeFromText(FOOD_FUSION_TEXT, { title: "Balochi Chicken Tikka boti" });
    assert.ok(draft.ingredients.length >= 14, `got ${draft.ingredients.length} ingredients`);
    assert.ok(
      draft.ingredients.filter((i) => i.quantity !== null).length >= 12,
      "most ingredients must carry quantities for scaling",
    );
    assert.equal(draft.ingredients[0].groupName, "Prepare Balochi Tikka Boti");
    assert.ok(draft.steps.length >= 6, `got ${draft.steps.length} steps`);
    assert.equal(draft.steps.some((s) => /ajza/i.test(s.instruction)), false, "Urdu block must not pollute steps");
    assert.equal(
      draft.ingredients.filter((i) => i.item === "Coriander seeds").length,
      1,
      "translated repeat must not duplicate ingredients",
    );
  });
});

describe("website import of a Food Fusion page", () => {
  it("imports the recipe (heuristic) and keeps the embedded video attached", async () => {
    const outcome = await importRecipe(
      { inputType: "url", inputValue: "https://www.foodfusion.com/recipe/balochi-chicken-tikka-boti/" },
      { fetchImpl: stubFetch(websiteRoutes), useLlm: false },
    );
    assert.match(outcome.draft.title, /balochi/i);
    assert.ok(outcome.draft.ingredients.length >= 10);
    assert.ok(outcome.draft.ingredients.filter((i) => i.quantity !== null).length >= 8);
    assert.ok(outcome.draft.steps.length >= 4);
    assert.equal(outcome.draft.sourceVideoId, BALOCHI_VIDEO_ID);
  });

  it("follows a Food Fusion SEARCH page to the real recipe", async () => {
    const outcome = await importRecipe(
      { inputType: "url", inputValue: "https://www.foodfusion.com/?s=Chicken+Balochi+Karahi" },
      { fetchImpl: stubFetch(websiteRoutes), useLlm: false },
    );
    assert.match(outcome.draft.title, /balochi/i);
    assert.ok(outcome.draft.ingredients.length >= 10);
    assert.ok(outcome.warnings.some((w) => /search page/i.test(w)));
  });
});

describe("dish-name cascade: Chicken Balochi Karahi", () => {
  let db: Database;
  let chef: TestChef;

  before(async () => {
    db = await freshDatabase();
    chef = await createChef(db, "CascadeKid", "teen");
  });

  after(async () => {
    await db.close();
  });

  it("parses the requested source out of the dish name", () => {
    const parsed = parseDishRequest("Chicken Balochi Karahi from Food Fusion");
    assert.equal(parsed.dish, "Chicken Balochi Karahi");
    assert.equal(parsed.source?.name, "Food Fusion");
    assert.equal(parseDishRequest("Chicken Balochi Karahi").source, null);
  });

  it("onboards from the Food Fusion website when asked by dish name", async () => {
    const calls: string[] = [];
    const outcome = await importDishByCascade(db, chef.id, "Chicken Balochi Karahi from Food Fusion", {
      fetchImpl: stubFetch(websiteRoutes, calls),
      useLlm: false,
    });
    assert.match(outcome.draft.title, /balochi/i);
    assert.ok(outcome.draft.ingredients.length >= 10);
    assert.ok(outcome.draft.steps.length >= 4);
    assert.ok(calls.some((url) => /foodfusion\.com\/\?s=/i.test(url)), "Food Fusion site search tried first");
    assert.equal(outcome.draft.sourceVideoId, BALOCHI_VIDEO_ID);
  });

  it("redirects to YouTube and reads the recipe from the video description", async () => {
    const calls: string[] = [];
    const outcome = await importDishByCascade(db, chef.id, "Chicken Balochi Karahi", {
      fetchImpl: stubFetch(youtubeOnlyRoutes, calls),
      useLlm: false,
    });
    assert.equal(outcome.method, "youtube");
    assert.equal(outcome.draft.sourceVideoId, BALOCHI_VIDEO_ID);
    assert.ok(outcome.draft.ingredients.length >= 10);
    assert.ok(outcome.warnings.some((w) => /description/i.test(w)));
  });

  it("never silently substitutes a different dish from the catalogue", async () => {
    const genericKarahi: RecipeDraft = {
      title: "Chicken Karahi",
      cuisine: "Pakistani",
      description: "Classic karahi.",
      difficulty: "Easy",
      baseServings: 4,
      totalMinutes: 35,
      heroImageUrl: null,
      sourceType: "builtin",
      sourceUrl: null,
      sourceVideoId: null,
      sourceChannel: null,
      sourceAuthor: "Chef Universe",
      ingredients: [
        { position: 0, quantity: 1, unit: "kg", item: "chicken", prepNote: null, groupName: null, scalable: true, rawText: "1 kg chicken" },
        { position: 1, quantity: 4, unit: null, item: "tomatoes", prepNote: null, groupName: null, scalable: true, rawText: "4 tomatoes" },
        { position: 2, quantity: 0.5, unit: "cups", item: "oil", prepNote: null, groupName: null, scalable: true, rawText: "1/2 cup oil" },
      ],
      steps: [
        { position: 0, instruction: "Fry the chicken in hot oil until golden.", durationSeconds: null, temperatureC: null, imageUrl: null, tip: null },
        { position: 1, instruction: "Add tomatoes and cook until the oil separates.", durationSeconds: null, temperatureC: null, imageUrl: null, tip: null },
      ],
    };
    await ensureCatalogueRecipe(db, genericKarahi, chef.id);

    // Exact dish → served internally, no web needed.
    const exact = await importDishByCascade(db, chef.id, "Chicken Karahi", {
      fetchImpl: stubFetch([]),
      useLlm: false,
    });
    assert.equal(exact.method, "catalogue");
    assert.equal(exact.draft.title, "Chicken Karahi");

    // Balochi (different dish) with the web down → closest-relative fallback, honestly labelled.
    const fallback = await importDishByCascade(db, chef.id, "Chicken Balochi Karahi", {
      fetchImpl: stubFetch([]),
      useLlm: false,
    });
    assert.equal(fallback.method, "catalogue");
    assert.ok(fallback.warnings.some((w) => /closest/i.test(w)), "must admit it is not the exact dish");

    // And with the web up, Balochi must beat the generic catalogue dish.
    const web = await importDishByCascade(db, chef.id, "Chicken Balochi Karahi from Food Fusion", {
      fetchImpl: stubFetch(websiteRoutes),
      useLlm: false,
    });
    assert.match(web.draft.title, /balochi/i);
  });

  it("fails honestly with YouTube/OCR next steps when nothing is found anywhere", async () => {
    const emptyDb = await freshDatabase();
    const lonely = await createChef(emptyDb, "LonelyKid", "teen");
    try {
      await assert.rejects(
        () =>
          importDishByCascade(emptyDb, lonely.id, "Unobtainium Soup", {
            fetchImpl: stubFetch([]),
            useLlm: false,
          }),
        (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.equal(error.status, 400);
          assert.match(error.message, /youtube/i);
          assert.match(error.message, /OCR/);
          assert.doesNotMatch(error.message, /404/);
          const details = error.details as { next?: string[] };
          assert.ok(details.next?.includes("ocr"));
          return true;
        },
      );
    } finally {
      await emptyDb.close();
    }
  });
});

describe("API: dish search → cascade import → confirm → onboarding + OCR", () => {
  let db: Database;
  let server: Server;
  let base = "";
  let chef: TestChef;

  before(async () => {
    db = await freshDatabase();
    chef = await createChef(db, "ApiKid", "teen");
    const { createApp } = await import("../server/app.js");
    const app = createApp(db, {
      fetchImpl: stubFetch([...websiteRoutes, ...youtubeOnlyRoutes]),
      ocrRecognise: async () => ({ text: OCR_TEXT, confidence: 92 }),
    });
    server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  });

  it("unknown API routes return JSON (never a bare platform 404)", async () => {
    const response = await api<{ error: string; message: string }>(base, "/definitely-not-a-route", {
      token: chef.token,
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.error, "not_found");
    assert.match(response.body.message, /definitely-not-a-route/);
  });

  it("imports 'Chicken Balochi Karahi from Food Fusion' by dish name end-to-end", async () => {
    const created = await api<{ job: ImportJobView }>(base, "/imports", {
      method: "POST",
      token: chef.token,
      body: { inputValue: "Chicken Balochi Karahi from Food Fusion" },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const job = created.body.job;
    assert.equal(job.status, "review");
    assert.equal(job.inputType, "dish");
    assert.match(job.draft?.title ?? "", /balochi/i);
    assert.ok((job.draft?.ingredients.length ?? 0) >= 10);

    const confirmed = await api<{ recipeId: string }>(base, `/imports/${job.id}/confirm`, {
      method: "POST",
      token: chef.token,
      body: {},
    });
    assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));

    const onboarded = await api<OnboardingResult>(base, `/recipes/${confirmed.body.recipeId}/onboarding`, {
      method: "POST",
      token: chef.token,
      body: { servings: 8, mealOccasion: "dinner", dietary: [], pantry: [] },
    });
    assert.equal(onboarded.status, 201, JSON.stringify(onboarded.body));
    assert.equal(onboarded.body.scaleFactor, 2);
    const oil = onboarded.body.ingredients.find((i) => /oil/i.test(i.item));
    assert.equal(oil?.scaled, 1, "½ cup oil at base 4 doubles to 1 cup for 8 people");
    assert.ok(onboarded.body.shoppingList.items.length >= 8);
  });

  it("scans a recipe photo with OCR into the same onboarding flow", async () => {
    const png = readFileSync(new URL("./fixtures/balochi-scan.png", import.meta.url));
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const scanned = await api<OcrImportResponse>(base, "/imports/ocr", {
      method: "POST",
      token: chef.token,
      body: { dataUrl },
    });
    assert.equal(scanned.status, 201, JSON.stringify(scanned.body).slice(0, 300));
    assert.equal(scanned.body.job.method, "ocr");
    assert.equal(scanned.body.job.inputType, "ocr");
    assert.match(scanned.body.ocrText, /Balochi Karahi/i);
    assert.ok((scanned.body.job.draft?.ingredients.length ?? 0) >= 6);
    assert.ok((scanned.body.job.draft?.steps.length ?? 0) >= 3);

    const confirmed = await api<{ recipeId: string }>(base, `/imports/${scanned.body.job.id}/confirm`, {
      method: "POST",
      token: chef.token,
      body: {},
    });
    assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
  });
});
