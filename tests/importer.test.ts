import "./setup.js";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { extractJsonLdRecipe } from "../server/services/importer/jsonld.js";
import { parseRecipeFromText } from "../server/services/importer/text.js";
import { classifyInput, importRecipe } from "../server/services/importer/index.js";
import { isPrivateAddress } from "../server/services/importer/fetch.js";
import { youtubeVideoId } from "../server/services/importer/youtube.js";
import { config } from "../server/config.js";

const BIRYANI_HTML = `<!doctype html><html><head>
<title>Chicken Biryani | Test Kitchen</title>
<meta property="og:image" content="https://cdn.example.com/biryani.jpg">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Chicken Biryani",
  "description": "Fragrant layered rice.",
  "recipeYield": "6 servings",
  "totalTime": "PT1H15M",
  "recipeCuisine": "Pakistani",
  "author": {"@type":"Person","name":"Test Kitchen"},
  "image": ["https://cdn.example.com/biryani.jpg"],
  "recipeIngredient": [
    "750 g chicken thighs, cut into pieces",
    "3 cups basmati rice",
    "1 1/2 cups yogurt",
    "Salt to taste"
  ],
  "recipeInstructions": [
    {"@type":"HowToStep","text":"Marinate the chicken in yogurt for 30 minutes.","image":"https://cdn.example.com/step1.jpg"},
    {"@type":"HowToStep","text":"Par-boil the rice with whole spices."},
    {"@type":"HowToSection","name":"Assemble","itemListElement":[
      {"@type":"HowToStep","text":"Layer rice over the chicken and cook on low heat for 25 minutes at 180C."}
    ]}
  ]
}
</script></head><body><h1>Chicken Biryani</h1></body></html>`;

const PLAIN_HTML = `<!doctype html><html><head>
<title>Simple Pancakes — Home Cooking</title>
<meta property="og:image" content="https://cdn.example.com/pancakes.jpg">
</head><body>
<h1>Simple Pancakes</h1>
<h2>Ingredients</h2>
<ul>
  <li>1 cup flour</li>
  <li>1 cup milk</li>
  <li>1 egg</li>
  <li>1 tbsp sugar</li>
</ul>
<h2>Method</h2>
<ol>
  <li>Whisk the flour, milk, egg and sugar into a smooth batter.</li>
  <li>Heat a pan and pour a small ladle of batter.</li>
  <li>Flip when bubbles appear and cook until golden.</li>
</ol>
</body></html>`;

let server: Server;
let origin = "";

before(async () => {
  server = createServer((req, res) => {
    if (req.url === "/biryani") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(BIRYANI_HTML);
      return;
    }
    if (req.url === "/pancakes") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(PLAIN_HTML);
      return;
    }
    if (req.url === "/empty") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body><h1>Nothing here</h1></body></html>");
      return;
    }
    res.writeHead(404).end("nope");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe("input classification", () => {
  it("recognises links, videos, text and dish names", () => {
    assert.equal(classifyInput("https://example.com/chicken-biryani"), "url");
    assert.equal(classifyInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "youtube");
    assert.equal(classifyInput("Chicken Biryani"), "dish");
    assert.equal(classifyInput("Ingredients\n1 cup rice\nMethod\nBoil the rice."), "text");
  });

  it("extracts YouTube ids from every common URL shape", () => {
    assert.equal(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
    assert.equal(youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(youtubeVideoId("https://www.youtube.com/@somechannel"), null);
  });
});

describe("schema.org extraction", () => {
  it("maps ingredients, steps, servings, time, images and nested sections", () => {
    const draft = extractJsonLdRecipe(BIRYANI_HTML, "https://example.com/biryani");
    assert.ok(draft);
    assert.equal(draft.title, "Chicken Biryani");
    assert.equal(draft.baseServings, 6);
    assert.equal(draft.totalMinutes, 75);
    assert.equal(draft.cuisine, "Pakistani");
    assert.equal(draft.heroImageUrl, "https://cdn.example.com/biryani.jpg");
    assert.equal(draft.ingredients.length, 4);
    assert.equal(draft.ingredients[0].quantity, 750);
    assert.equal(draft.ingredients[0].unit, "g");
    assert.equal(draft.ingredients[0].item, "chicken thighs");
    assert.equal(draft.ingredients[2].quantity, 1.5);
    assert.equal(draft.steps.length, 3, "HowToSection is flattened into ordered steps");
    assert.equal(draft.steps[0].imageUrl, "https://cdn.example.com/step1.jpg");
    assert.equal(draft.steps[2].temperatureC, 180);
  });
});

describe("text and YouTube-description parsing", () => {
  it("parses a typical video description", () => {
    const draft = parseRecipeFromText(
      `Chicken Karahi — Restaurant Style
Ingredients:
- 1 kg chicken
- 4 tomatoes
- 2 tbsp ginger garlic paste
Salt to taste

Method:
1. Heat oil and fry the chicken until golden.
2. Add tomatoes and cook until soft.
3. Add spices and simmer for 20 minutes.

Subscribe for more recipes!`,
      { title: "Chicken Karahi", sourceVideoId: "abc12345", sourceChannel: "Test Kitchen" },
    );
    assert.equal(draft.ingredients.length, 4);
    assert.equal(draft.steps.length, 3);
    assert.equal(draft.sourceType, "youtube");
    assert.equal(draft.ingredients[0].quantity, 1);
    assert.equal(draft.ingredients[0].unit, "kg");
    assert.equal(draft.ingredients[3].scalable, false);
    assert.equal(draft.steps.some((step) => /subscribe/i.test(step.instruction)), false);
  });
});

describe("full import pipeline", () => {
  it("imports a website with structured data", async () => {
    const outcome = await importRecipe({ inputType: "url", inputValue: `${origin}/biryani` });
    assert.equal(outcome.method, "jsonld");
    assert.equal(outcome.draft.title, "Chicken Biryani");
    assert.ok(outcome.confidence >= 0.8, `confidence was ${outcome.confidence}`);
    assert.equal(outcome.draft.ingredients.length, 4);
  });

  it("falls back to heuristic parsing when a page has no structured data", async () => {
    const outcome = await importRecipe({ inputType: "url", inputValue: `${origin}/pancakes` });
    assert.equal(outcome.method, "heuristic");
    assert.ok(outcome.draft.ingredients.length >= 3);
    assert.ok(outcome.draft.steps.length >= 2);
    assert.equal(outcome.draft.heroImageUrl, "https://cdn.example.com/pancakes.jpg");
  });

  it("fails honestly when a page holds no recipe", async () => {
    await assert.rejects(
      () => importRecipe({ inputType: "url", inputValue: `${origin}/empty` }),
      /does not contain a readable recipe/i,
    );
  });

  it("warns when a page has no step photos", async () => {
    const outcome = await importRecipe({ inputType: "url", inputValue: `${origin}/pancakes` });
    assert.equal(outcome.warnings.some((warning) => /step-by-step photos/i.test(warning)), true);
  });
});

describe("SSRF protection", () => {
  it("identifies private and link-local addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.4", "172.16.5.5", "192.168.1.10", "169.254.1.1", "::1", "fd00::1"]) {
      assert.equal(isPrivateAddress(address), true, `${address} should be blocked`);
    }
    for (const address of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      assert.equal(isPrivateAddress(address), false, `${address} should be allowed`);
    }
  });

  it("refuses to fetch a private address when the guard is on", async () => {
    const previous = config.imports.allowPrivateHosts;
    (config.imports as unknown as { allowPrivateHosts: boolean }).allowPrivateHosts = false;
    try {
      await assert.rejects(
        () => importRecipe({ inputType: "url", inputValue: `${origin}/biryani` }),
        /not allowed/i,
      );
    } finally {
      (config.imports as unknown as { allowPrivateHosts: boolean }).allowPrivateHosts = previous;
    }
  });

  it("rejects non-http protocols", async () => {
    await assert.rejects(
      () => importRecipe({ inputType: "url", inputValue: "javascript:alert(1)" }),
      /web link|http and https/i,
    );
  });
});
