import type { Database } from "../db/index.js";
import type { RecipeDraft } from "../../shared/types.js";
import { ApiError } from "../lib/errors.js";
import { config } from "../config.js";
import { browseWebsite, browseYouTube } from "./browser.js";
import {
  importRecipe, tidyDraft, warningsFor, type ImportOutcome,
} from "./importer/index.js";
import { rankCardsForDish, dishTokens } from "./importer/links.js";
import { llmConfigured, structureWithLlm } from "./importer/llm.js";
import { confidenceOf } from "./importer/parse.js";
import { findInternalMatches, loadCatalogueRecipe, loadChefRecipe } from "./recipes.js";

/**
 * AI-onboarding cascade for a bare dish name ("Chicken Balochi Karahi",
 * "Chicken Balochi Karahi from Food Fusion"):
 *
 *   1. 🗄️ Internal first — my book, then the shared catalogue (no internet).
 *   2. 🌐 Website — the requested chef site's own search (Food Fusion first
 *      when asked for), then a general web search; the best recipe cards are
 *      imported with the normal website importer (JSON-LD → heuristic → AI).
 *   3. 📺 YouTube — search "<channel> <dish> recipe"; the top videos are
 *      opened and the recipe is parsed from the video DESCRIPTION (+captions).
 *   4. 🤖 AI draft from the dish name (only when an LLM key is configured).
 *   5. Otherwise an honest error that tells the chef exactly what to try
 *      next (YouTube tab, OCR scan, paste) — never a bare "(404)".
 */

export type KnownSource = {
  name: string;
  aliases: string[];
  /** Native search on the chef's own website; `{query}` is replaced. */
  siteSearch?: string;
  host?: string;
};

export const KNOWN_SOURCES: KnownSource[] = [
  { name: "Food Fusion", aliases: ["food fusion", "foodfusion"], siteSearch: "https://www.foodfusion.com/?s={query}", host: "foodfusion.com" },
  { name: "SooperChef", aliases: ["sooperchef", "sooper chef"], siteSearch: "https://www.sooperchef.pk/?s={query}", host: "sooperchef.pk" },
  { name: "Hebbars Kitchen", aliases: ["hebbars kitchen", "hebbarskitchen", "hebbars"], siteSearch: "https://hebbarskitchen.com/?s={query}", host: "hebbarskitchen.com" },
  { name: "Ranveer Brar", aliases: ["ranveer brar", "chef ranveer"], siteSearch: "https://ranveerbrar.com/?s={query}", host: "ranveerbrar.com" },
  { name: "Kun Foods", aliases: ["kun foods"] },
  { name: "Your Food Lab", aliases: ["your food lab"] },
  { name: "Sanjeev Kapoor", aliases: ["sanjeev kapoor", "sanjeev kapoor khazana"] },
  { name: "Cakes by MK", aliases: ["cakes by mk"], siteSearch: "https://cakesbymk.com/?s={query}", host: "cakesbymk.com" },
];

/** "Chicken Balochi Karahi from Food Fusion" → source Food Fusion, dish "Chicken Balochi Karahi". */
export function parseDishRequest(raw: string): { dish: string; source: KnownSource | null } {
  const cleaned = raw
    .replace(/\brecipe\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = cleaned.toLowerCase();
  for (const source of KNOWN_SOURCES) {
    for (const alias of source.aliases) {
      const index = lower.indexOf(alias);
      if (index >= 0) {
        const dish = `${cleaned.slice(0, index)} ${cleaned.slice(index + alias.length)}`
          .replace(/\b(?:from|by|via|on)\s*$/i, " ")
          .replace(/^\s*(?:from|by|via|on)\b/i, " ")
          .replace(/\s+/g, " ")
          .trim();
        return { dish: dish || cleaned, source };
      }
    }
  }
  return { dish: cleaned, source: null };
}

function usable(draft: RecipeDraft, minIngredients = 3): boolean {
  return draft.ingredients.length >= minIngredients && draft.steps.length >= 1;
}

/**
 * A catalogue hit only short-circuits the cascade when it really is the dish
 * asked for (every significant dish word appears in the title). Otherwise —
 * e.g. seeded "Chicken Karahi" for a "Chicken Balochi Karahi" request — the
 * cascade keeps hunting on the web and keeps the catalogue dish only as a
 * clearly-labelled last resort.
 */
function isStrongMatch(title: string, dish: string): boolean {
  const wanted = dishTokens(dish);
  if (wanted.length === 0) return true;
  const inTitle = dishTokens(title);
  return wanted.every((token) => inTitle.includes(token));
}

function viewToDraft(view: RecipeDraft): RecipeDraft {
  return tidyDraft({
    title: view.title,
    cuisine: view.cuisine,
    description: view.description,
    difficulty: view.difficulty,
    baseServings: view.baseServings,
    totalMinutes: view.totalMinutes,
    heroImageUrl: view.heroImageUrl,
    sourceType: view.sourceType,
    sourceUrl: view.sourceUrl,
    sourceVideoId: view.sourceVideoId,
    sourceChannel: view.sourceChannel,
    sourceAuthor: view.sourceAuthor,
    ingredients: view.ingredients,
    steps: view.steps,
  });
}

export type CascadeOptions = {
  fetchImpl?: typeof fetch;
  useLlm?: boolean;
};

export async function importDishByCascade(
  db: Database,
  chefId: string,
  rawDish: string,
  options: CascadeOptions = {},
): Promise<ImportOutcome> {
  const { dish, source } = parseDishRequest(rawDish);
  const tried: string[] = [];
  const fetchImpl = options.fetchImpl;
  const useLlm = options.useLlm ?? Boolean(config.llm.apiKey);

  // 1) Internal first — my book, then the shared catalogue (strong matches only;
  //    a weaker relative is kept as a labelled last resort, never substituted).
  let catalogueFallback: RecipeDraft | null = null;
  try {
    const matches = await findInternalMatches(db, chefId, dish);
    const mine = matches.myRecipes[0];
    if (mine?.recipeId && isStrongMatch(mine.title, dish)) {
      const own = await db.withChef(chefId, (tx) => loadChefRecipe(tx, mine.recipeId as string));
      if (own) {
        const draft = viewToDraft(own);
        return {
          draft,
          method: "catalogue",
          confidence: 0.95,
          warnings: ["Already in your recipe book — review it below and save a fresh copy, or just open it from My Recipes."],
        };
      }
    }
    const shared = matches.sharedMatches[0];
    if (shared?.catalogueId) {
      const catalogueDraft = await loadCatalogueRecipe(db, shared.catalogueId);
      if (catalogueDraft && usable(catalogueDraft)) {
        if (isStrongMatch(shared.title, dish)) {
          const draft = viewToDraft(catalogueDraft);
          return {
            draft,
            method: "catalogue",
            confidence: 0.9,
            warnings: ["Found in the shared recipe catalogue — no internet needed. Review, then save your own private copy."],
          };
        }
        catalogueFallback = catalogueDraft;
      }
    }
  } catch {
    // Internal lookup must never block the web cascade.
  }
  tried.push("your book + shared catalogue");

  // 2) Website — requested chef site first (e.g. Food Fusion), then web search.
  const candidateUrls: string[] = [];
  const seenUrls = new Set<string>();
  const collect = (urls: string[]) => {
    for (const url of urls) {
      const key = url.replace(/\/$/, "").toLowerCase();
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        candidateUrls.push(url);
      }
    }
  };

  if (source?.siteSearch) {
    tried.push(`${source.name} website`);
    try {
      const page = await browseWebsite(source.siteSearch.replace("{query}", encodeURIComponent(dish)), { fetchImpl });
      if (page.detectedRecipe && usable(page.detectedRecipe)) {
        const draft = tidyDraft(page.detectedRecipe);
        return {
          draft,
          method: page.detectedMethod === "jsonld" ? "jsonld" : "heuristic",
          confidence: page.detectedConfidence ?? confidenceOf(draft),
          warnings: [`Found on the ${source.name} website. Review every quantity before cooking.`, ...warningsFor(draft, "heuristic")],
        };
      }
      collect(rankCardsForDish(page.links.filter((c) => c.isLikelyRecipe), dish).map((c) => c.url));
    } catch {
      // Try the general web next.
    }
  }

  tried.push("web recipe search");
  try {
    const page = await browseWebsite(source ? `${dish} ${source.name}` : dish, { fetchImpl });
    collect(rankCardsForDish(page.links.filter((c) => c.isLikelyRecipe), dish).map((c) => c.url));
  } catch {
    // YouTube may still save the day.
  }

  for (const url of candidateUrls.slice(0, 3)) {
    try {
      const outcome = await importRecipe(
        { inputType: "url", inputValue: url },
        { fetchImpl, useLlm, allowAiFallback: true },
      );
      if (usable(outcome.draft)) {
        return {
          ...outcome,
          warnings: [
            `Found “${outcome.draft.title}” on ${outcome.draft.sourceAuthor ?? outcome.draft.sourceUrl ?? "the web"} while searching for “${dish}”. Review it before cooking.`,
            ...outcome.warnings,
          ],
        };
      }
    } catch {
      // Next candidate.
    }
  }

  // 3) YouTube — the recipe usually lives in the video description.
  const ytQueries = source
    ? [`${source.name} ${dish} recipe`, `${dish} recipe`]
    : [`${dish} recipe`];
  tried.push(source ? `YouTube (${source.name} first)` : "YouTube");
  const seenVideos = new Set<string>();
  let bestEffort: ImportOutcome | null = null;
  for (const query of ytQueries) {
    let videos;
    try {
      videos = (await browseYouTube(query, { fetchImpl })).videos;
    } catch {
      continue;
    }
    const wanted = dishTokens(dish);
    const ranked = [...videos]
      .map((video, index) => {
        const titleTokens = dishTokens(video.title);
        const overlap = wanted.filter((t) => titleTokens.includes(t)).length;
        const channelBoost =
          source && video.channel?.toLowerCase().includes(source.name.toLowerCase()) ? 2 : 0;
        return { video, index, score: overlap + channelBoost };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ video }) => video)
      .filter((video) => !seenVideos.has(video.videoId))
      .slice(0, 3);

    for (const video of ranked) {
      seenVideos.add(video.videoId);
      try {
        const outcome = await importRecipe(
          { inputType: "youtube", inputValue: video.watchUrl },
          { fetchImpl, useLlm, allowAiFallback: true },
        );
        if (usable(outcome.draft, 2)) {
          return {
            ...outcome,
            warnings: [
              `The recipe was read from the description of “${video.title}”${video.channel ? ` by ${video.channel}` : ""} on YouTube.`,
              ...outcome.warnings,
            ],
          };
        }
        if (
          outcome.draft.ingredients.length >= 1 &&
          (!bestEffort || outcome.draft.ingredients.length > bestEffort.draft.ingredients.length)
        ) {
          bestEffort = outcome;
        }
      } catch {
        // Next video.
      }
    }
    if (bestEffort) break;
  }
  if (bestEffort) {
    return {
      ...bestEffort,
      warnings: [
        "YouTube gave us a partial recipe for this dish — please fill in anything missing before saving.",
        ...bestEffort.warnings,
      ],
    };
  }

  // 3b) Closest internal relative — clearly labelled, never passed off as the
  //     exact dish (e.g. "Chicken Karahi" when "Balochi" couldn't be found).
  if (catalogueFallback) {
    const draft = viewToDraft(catalogueFallback);
    return {
      draft,
      method: "catalogue",
      confidence: 0.7,
      warnings: [
        `We couldn't find an exact “${dish}” online, so here's the closest recipe we already know: “${draft.title}”. Rename and adjust it below, try the YouTube tab, or scan a photo with OCR.`,
        ...warningsFor(draft, "catalogue"),
      ],
    };
  }

  // 4) AI draft from the dish name alone (only with a configured LLM key).
  if (useLlm && llmConfigured()) {
    tried.push("AI drafting");
    const generated = await structureWithLlm({
      text: `Draft a complete ${dish} recipe with realistic ingredient quantities for 4 servings.`,
      title: dish,
      sourceType: "ai",
      allowGeneration: true,
      fetchImpl,
    });
    if (generated) {
      const draft = tidyDraft({ ...generated, sourceType: "ai", title: generated.title || dish });
      if (usable(draft)) {
        return { draft, method: "llm", confidence: confidenceOf(draft), warnings: warningsFor(draft, "llm") };
      }
    }
  }

  // 5) Honest dead-end with the three ways forward — never a bare "(404)".
  throw ApiError.badRequest(
    `We searched ${tried.join(", ")} but couldn't find a readable “${dish}” recipe to import. ` +
      "Try the YouTube tab (the recipe is usually in the video description), scan a photo or screenshot with OCR, or paste the recipe text — AI Onboarding will take it from there.",
    { next: ["youtube", "ocr", "paste"], tried },
  );
}
