import "./setup.js";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import {
  browseWebsite,
  browseYouTube,
  detectPageRecipe,
  extractRecipeLinks,
  extractYouTubeVideosFromHtml,
  sanitizeHtmlForPreview,
} from "../server/services/browser.js";
import { api, freshDatabase, startTestServer } from "./helpers.js";
import type { Database } from "../server/db/index.js";
import type {
  BrowserPageResponse,
  ChefProfile,
  ImportJobView,
  OnboardingResult,
} from "../shared/types.js";

const CHEF_SEARCH_HTML = `<!doctype html><html><head>
<title>Search Results for Biryani — Chef Kitchen</title>
</head><body>
<nav>
  <a href="/wp-login.php">Login</a>
  <a href="https://instagram.com/chef">Instagram</a>
  <a href="/privacy-policy">Privacy Policy</a>
</nav>
<main>
  <article class="recipe-card">
    <img data-lazy-src="/media/sindhi-biryani.jpg" alt="Sindhi Biryani">
    <h2><a href="/recipes/sindhi-chicken-biryani">Sindhi Chicken Biryani</a></h2>
    <p>Spicy, aromatic layered rice with tender chicken and potatoes.</p>
  </article>
  <article class="recipe-card">
    <img src="https://cdn.example.com/mutton-pulao.jpg" alt="Mutton Pulao">
    <h3><a href="/recipes/yakhni-mutton-pulao">Yakhni Mutton Pulao</a></h3>
    <p>Fragrant bone-broth rice cooked gently with whole spices.</p>
  </article>
</main>
<script>window.evilRedirect = function(){ location.href = "https://evil.example"; };</script>
</body></html>`;

const RECIPE_ARTICLE_HTML = `<!doctype html><html><head>
<title>Sindhi Chicken Biryani | Chef Kitchen</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Sindhi Chicken Biryani",
  "recipeYield": "4 servings",
  "totalTime": "PT60M",
  "recipeCuisine": "Pakistani",
  "image": "https://cdn.example.com/sindhi-biryani.jpg",
  "recipeIngredient": [
    "600 g chicken",
    "2 cups basmati rice",
    "1 cup yogurt",
    "2 potatoes, quartered",
    "Salt to taste"
  ],
  "recipeInstructions": [
    {"@type": "HowToStep", "text": "Cook chicken with yogurt, tomatoes and spices for 20 minutes."},
    {"@type": "HowToStep", "text": "Par-boil the basmati rice in salted water."},
    {"@type": "HowToStep", "text": "Layer rice over the masala and steam on low heat for 15 minutes."}
  ]
}
</script></head><body>
<h1>Sindhi Chicken Biryani</h1>
<a href="/recipes/yakhni-mutton-pulao" onclick="alert('xss')">Try Mutton Pulao Next</a>
</body></html>`;

const YOUTUBE_SEARCH_HTML = `<!doctype html><html><head><title>Food Fusion Biryani - YouTube</title></head><body>
<script>var ytInitialData = {
  "contents": {
    "twoColumnSearchResultsRenderer": {
      "primaryContents": {
        "sectionListRenderer": {
          "contents": [{
            "itemSectionRenderer": {
              "contents": [
                {
                  "videoRenderer": {
                    "videoId": "AbCdEfGh123",
                    "title": { "runs": [{ "text": "Chicken Biryani Recipe By Food Fusion" }] },
                    "ownerText": { "runs": [{ "text": "Food Fusion" }] },
                    "lengthText": { "simpleText": "8:42" },
                    "shortViewCountText": { "simpleText": "4.2M views" },
                    "publishedTimeText": { "simpleText": "1 year ago" },
                    "detailedMetadataSnippets": [{
                      "snippetText": { "runs": [{ "text": "Step by step restaurant style chicken biryani." }] }
                    }]
                  }
                },
                {
                  "videoRenderer": {
                    "videoId": "XyZ98765432",
                    "title": { "runs": [{ "text": "Easy Degi Pulao Recipe" }] },
                    "ownerText": { "runs": [{ "text": "Food Fusion" }] },
                    "lengthText": { "simpleText": "6:15" }
                  }
                }
              ]
            }
          }]
        }
      }
    }
  }
};</script>
</body></html>`;

let upstream: Server;
let upstreamOrigin = "";
let db: Database;
let appServer: { base: string; close: () => Promise<void> };
let chefAuth: { token: string; chef: ChefProfile };

before(async () => {
  upstream = createServer((req, res) => {
    if (req.url?.startsWith("/?s=biryani")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(CHEF_SEARCH_HTML);
      return;
    }
    if (req.url === "/recipes/sindhi-chicken-biryani") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(RECIPE_ARTICLE_HTML);
      return;
    }
    if (req.url === "/yt-results") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(YOUTUBE_SEARCH_HTML);
      return;
    }
    res.writeHead(404).end("not found");
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", () => resolve()));
  upstreamOrigin = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

  db = await freshDatabase();
  appServer = await startTestServer(db, {
    fetchImpl: async (input, init) => {
      const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      if (url.startsWith("https://www.youtube.com/oembed?")) {
        return new Response(JSON.stringify({ title: "Sindhi Chicken Biryani", author_name: "Food Fusion" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === "https://www.youtube.com/watch?v=AbCdEfGh123") {
        return new Response(
          '<meta name="title" content="Sindhi Chicken Biryani"><meta name="description" content="Ingredients:\n2 cups rice\nMethod:\nCook rice.">',
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return fetch(input, init);
    },
  });
  const created = await api<{ token: string; chef: ChefProfile }>(appServer.base, "/chefs", {
    method: "POST",
    body: { displayName: "Zara", role: "adult", avatar: "girl2" },
  });
  assert.equal(created.status, 201);
  chefAuth = created.body;
});

after(async () => {
  await appServer.close();
  upstream.close();
  await db.close();
});

describe("in-app browser HTML sanitization & link extraction", () => {
  it("strips page scripts and inline handlers while injecting the in-app navigation bridge", () => {
    const clean = sanitizeHtmlForPreview(RECIPE_ARTICLE_HTML, "https://chef.example/recipes/biryani");
    assert.doesNotMatch(clean, /onclick=/i);
    assert.doesNotMatch(clean, /application\/ld\+json/i);
    assert.match(clean, /<base href="https:\/\/chef\.example\/recipes\/biryani">/);
    assert.match(clean, /chef-browser:navigate/);
  });

  it("escapes hostile preview-base attributes instead of creating executable markup", () => {
    const clean = sanitizeHtmlForPreview("<html><head></head><body>safe</body></html>", 'https://chef.example/\"><script>alert(1)</script>?x=\'&y=<img src=x onerror=alert(1)>');
    assert.doesNotMatch(clean, /<base[^>]*><script>alert\(1\)/i);
    assert.match(clean, /&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(clean, /&amp;y=&lt;img src=x onerror=alert\(1\)&gt;/);
  });

  it("extracts recipe cards with resolved links and thumbnails while skipping login/social noise", () => {
    const cards = extractRecipeLinks(CHEF_SEARCH_HTML, "https://chef.example/?s=biryani");
    assert.equal(cards.length, 2);
    assert.equal(cards[0].title, "Sindhi Chicken Biryani");
    assert.equal(cards[0].url, "https://chef.example/recipes/sindhi-chicken-biryani");
    assert.equal(cards[0].imageUrl, "https://chef.example/media/sindhi-biryani.jpg");
    assert.equal(cards[0].isLikelyRecipe, true);
    assert.equal(cards.some((c) => /login|instagram|privacy/i.test(c.url)), false);
  });

  it("unwraps DuckDuckGo search result redirects to the real recipe URL", () => {
    const ddgHtml = `<a href="https://duckduckgo.com/l/?uddg=${encodeURIComponent("https://www.foodfusion.com/recipe/chicken-karahi/")}">Chicken Karahi Recipe</a>`;
    const cards = extractRecipeLinks(ddgHtml, "https://html.duckduckgo.com/html/?q=karahi");
    assert.equal(cards.length, 1);
    assert.equal(cards[0].url, "https://www.foodfusion.com/recipe/chicken-karahi/");
  });

  it("distinguishes listing pages from actual recipe pages", () => {
    assert.equal(detectPageRecipe(CHEF_SEARCH_HTML, "https://chef.example/?s=biryani"), null);
    const detected = detectPageRecipe(RECIPE_ARTICLE_HTML, "https://chef.example/recipes/sindhi-chicken-biryani");
    assert.ok(detected);
    assert.equal(detected.draft.title, "Sindhi Chicken Biryani");
    assert.equal(detected.draft.ingredients.length, 5);
    assert.equal(detected.draft.steps.length, 3);
  });

  it("extracts YouTube video cards from ytInitialData", () => {
    const videos = extractYouTubeVideosFromHtml(YOUTUBE_SEARCH_HTML);
    assert.equal(videos.length, 2);
    assert.equal(videos[0].videoId, "AbCdEfGh123");
    assert.equal(videos[0].title, "Chicken Biryani Recipe By Food Fusion");
    assert.equal(videos[0].channel, "Food Fusion");
    assert.equal(videos[0].duration, "8:42");
    assert.equal(videos[0].watchUrl, "https://www.youtube.com/watch?v=AbCdEfGh123");
  });
});

describe("in-app browser → choose recipe → AI-powered onboarding end-to-end", () => {
  it("loads a chef website search page inside the browser for any user without leaving the app", async () => {
    const res = await api<{ page: BrowserPageResponse }>(
      appServer.base,
      `/browser/navigate?url=${encodeURIComponent(`${upstreamOrigin}/?s=biryani`)}`,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.page.kind, "website");
    assert.equal(res.body.page.detectedRecipe, null);
    assert.equal(res.body.page.links.length, 2);
    assert.equal(res.body.page.links[0].title, "Sindhi Chicken Biryani");
  });

  it("detects the complete recipe on the chosen page and completes AI onboarding + shopping list", async () => {
    const chosenUrl = `${upstreamOrigin}/recipes/sindhi-chicken-biryani`;
    const browsed = await browseWebsite(chosenUrl);
    assert.ok(browsed.detectedRecipe);
    assert.equal(browsed.detectedRecipe.title, "Sindhi Chicken Biryani");

    // Import chosen recipe from the internal browser
    const imported = await api<{ job: ImportJobView }>(appServer.base, "/imports", {
      method: "POST",
      token: chefAuth.token,
      body: {
        inputValue: chosenUrl,
        allowAiFallback: true,
        draftHint: browsed.detectedRecipe,
      },
    });
    assert.equal(imported.status, 201);
    assert.equal(imported.body.job.status, "review");
    assert.equal(imported.body.job.draft?.ingredients.length, 5);

    const confirmed = await api<{ recipeId: string }>(
      appServer.base,
      `/imports/${imported.body.job.id}/confirm`,
      { method: "POST", token: chefAuth.token, body: {} },
    );
    assert.equal(confirmed.status, 201);

    // Run AI-powered onboarding for 8 dinner guests
    const onboarded = await api<OnboardingResult>(
      appServer.base,
      `/recipes/${confirmed.body.recipeId}/onboarding`,
      {
        method: "POST",
        token: chefAuth.token,
        body: { servings: 8, mealOccasion: "dinner", pantry: ["salt"] },
      },
    );
    assert.equal(onboarded.status, 201);
    assert.equal(onboarded.body.servings, 8);
    assert.equal(onboarded.body.scaleFactor, 2);
    assert.ok(onboarded.body.shoppingList.items.length >= 4);
  });

  it("browses YouTube video results and supports AI fallback onboarding when video description is sparse", async () => {
    const ytPage = await browseYouTube("Food Fusion Biryani", {
      fetchImpl: async () =>
        new Response(YOUTUBE_SEARCH_HTML, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    });
    assert.equal(ytPage.kind, "youtube-search");
    assert.equal(ytPage.videos.length, 2);

    // Even when a video link has no written recipe block, allowAiFallback matches catalogue / starter draft
    const fallbackImport = await api<{ job: ImportJobView }>(appServer.base, "/imports", {
      method: "POST",
      token: chefAuth.token,
      body: {
        inputValue: ytPage.videos[0].watchUrl,
        allowAiFallback: true,
        draftHint: {
          title: "Sindhi Chicken Biryani",
          baseServings: 4,
          sourceType: "youtube",
          sourceUrl: ytPage.videos[0].watchUrl,
          sourceVideoId: ytPage.videos[0].videoId,
          sourceChannel: ytPage.videos[0].channel,
          ingredients: [],
          steps: [],
        },
      },
    });
    assert.equal(fallbackImport.status, 201);
    assert.equal(fallbackImport.body.job.status, "review");
    assert.equal(fallbackImport.body.job.draft?.sourceVideoId, "AbCdEfGh123");
    assert.ok((fallbackImport.body.job.draft?.ingredients.length ?? 0) >= 3);
    assert.ok((fallbackImport.body.job.draft?.steps.length ?? 0) >= 2);
  });
});
