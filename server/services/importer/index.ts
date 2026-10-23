import type { RecipeDraft } from "../../../shared/types.js";
import { ApiError } from "../../lib/errors.js";
import { confidenceOf, emptyDraft, stripHtml, titleFromUrl } from "./parse.js";
import { safeFetchPage } from "./fetch.js";
import { extractJsonLdRecipe, extractPageFallback } from "./jsonld.js";
import { importFromYouTube, youtubeVideoId } from "./youtube.js";
import { parseRecipeFromText } from "./text.js";
import { extractRecipeLinks, rankCardsForDish } from "./links.js";
import { llmConfigured, structureWithLlm } from "./llm.js";

/** First YouTube video embedded or linked from a recipe page (Food Fusion embeds its video). */
function embeddedYouTubeId(html: string): string | null {
  const match = html.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([\w-]{6,15})/i,
  );
  return match?.[1] ?? null;
}

/** The dish a listing/search URL is about ("?s=Chicken+Balochi+Karahi", "?q=… recipe"). */
function dishHintFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const q = parsed.searchParams.get("s") ?? parsed.searchParams.get("q") ?? parsed.searchParams.get("search_query");
    if (q) return q.replace(/\brecipe\b/gi, "").replace(/\s+/g, " ").trim();
  } catch {
    /* fall through */
  }
  return titleFromUrl(rawUrl);
}

export type ImportInputType = "url" | "youtube" | "text" | "dish";

export type ImportOutcome = {
  draft: RecipeDraft;
  method: "jsonld" | "youtube" | "heuristic" | "llm" | "manual" | "ocr" | "catalogue";
  confidence: number;
  warnings: string[];
};

export function classifyInput(raw: string): ImportInputType {
  const value = raw.trim();
  if (!value) return "text";
  const looksLikeUrl =
    /^https?:\/\//i.test(value) || /^www\./i.test(value) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(value);
  if (!looksLikeUrl) return value.length < 60 && !/\n/.test(value) ? "dish" : "text";
  return youtubeVideoId(value) ? "youtube" : "url";
}

/** Prefer the richer draft, but keep useful media/metadata from the other. */
export function mergeDrafts(primary: RecipeDraft, secondary: RecipeDraft): RecipeDraft {
  const better =
    confidenceOf(primary) >= confidenceOf(secondary) ? primary : secondary;
  const other = better === primary ? secondary : primary;
  return {
    ...better,
    cuisine: better.cuisine ?? other.cuisine,
    description: better.description ?? other.description,
    difficulty: better.difficulty ?? other.difficulty,
    heroImageUrl: better.heroImageUrl ?? other.heroImageUrl,
    totalMinutes: better.totalMinutes ?? other.totalMinutes,
    sourceUrl: better.sourceUrl ?? other.sourceUrl,
    sourceVideoId: better.sourceVideoId ?? other.sourceVideoId,
    sourceChannel: better.sourceChannel ?? other.sourceChannel,
    sourceAuthor: better.sourceAuthor ?? other.sourceAuthor,
    baseServings: better.baseServings > 0 ? better.baseServings : other.baseServings || 4,
  };
}

export function tidyDraft(input: RecipeDraft): RecipeDraft {
  const seenSteps = new Set<string>();
  const steps = input.steps
    .filter((step) => step.instruction?.trim())
    .filter((step) => {
      const key = step.instruction.trim().toLowerCase();
      if (seenSteps.has(key)) return false;
      seenSteps.add(key);
      return true;
    })
    .slice(0, 60)
    .map((step, position) => ({ ...step, position, instruction: step.instruction.trim().slice(0, 1200) }));

  const ingredients = input.ingredients
    .filter((ing) => ing.item?.trim())
    .slice(0, 80)
    .map((ing, position) => ({
      ...ing,
      position,
      item: ing.item.trim().slice(0, 160),
      unit: ing.unit?.trim() || null,
      prepNote: ing.prepNote?.trim() || null,
      groupName: ing.groupName?.trim() || null,
      scalable: ing.scalable !== false && ing.quantity !== null,
    }));

  const difficulty =
    input.difficulty ??
    (steps.length > 12 || ingredients.length > 14 ? "A Little Tricky" : ingredients.length > 8 ? "Easy" : "Super Easy");

  return {
    ...input,
    title: (input.title || "Imported recipe").trim().slice(0, 140),
    description: input.description?.trim().slice(0, 900) ?? null,
    cuisine: input.cuisine?.trim() ?? null,
    difficulty,
    baseServings: Math.min(100, Math.max(1, Math.round(input.baseServings || 4))),
    totalMinutes: input.totalMinutes && input.totalMinutes > 0 ? Math.min(2880, Math.round(input.totalMinutes)) : null,
    ingredients,
    steps,
  };
}

export function warningsFor(draft: RecipeDraft, method: ImportOutcome["method"]): string[] {
  const warnings: string[] = [];
  if (draft.ingredients.length < 3) {
    warnings.push("Only a few ingredients were recognised — please check the ingredient list before cooking.");
  }
  if (draft.steps.length < 2) {
    warnings.push("The cooking steps look incomplete. Add any missing steps before you save.");
  }
  if (!draft.heroImageUrl) {
    warnings.push("The source had no recipe photo, so a friendly placeholder will be used.");
  }
  if (draft.steps.length > 0 && draft.steps.every((step) => !step.imageUrl)) {
    warnings.push("The source has no step-by-step photos. Steps are mapped, but images are placeholders.");
  }
  if (method === "llm") {
    warnings.push("AI helped structure this recipe. Please review every quantity and step with a grown-up.");
  }
  if (draft.sourceType === "ai") {
    warnings.push("This recipe was drafted by AI from the dish name only — no source link was used.");
  }
  return warnings;
}

export type ImportOptions = {
  fetchImpl?: typeof fetch;
  useLlm?: boolean;
  allowAiFallback?: boolean;
  /** Internal: how many listing/search hops have already been followed. */
  _depth?: number;
};

export async function importRecipe(
  input: { inputType: ImportInputType; inputValue: string },
  options: ImportOptions = {},
): Promise<ImportOutcome> {
  const value = input.inputValue.trim();
  if (!value) throw ApiError.badRequest("Paste a recipe link or description first.");

  const inputType = input.inputType === "url" || input.inputType === "youtube" || input.inputType === "dish"
    ? input.inputType
    : classifyInput(value);

  if (inputType === "dish") {
    if (!llmConfigured()) {
      throw ApiError.badRequest(
        "We could not find that dish internally yet. Add an AI key on the server, or paste a recipe link / YouTube description so we can import it exactly.",
      );
    }
    const generated = await structureWithLlm({
      text: `Draft a complete ${value} recipe with realistic ingredient quantities for 4 servings.`,
      title: value,
      sourceType: "ai",
      allowGeneration: true,
      fetchImpl: options.fetchImpl,
    });
    if (!generated) throw ApiError.upstream("The AI helper could not draft that recipe. Try a recipe link instead.");
    const draft = tidyDraft({ ...generated, sourceType: "ai", title: generated.title || value });
    return { draft, method: "llm", confidence: confidenceOf(draft), warnings: warningsFor(draft, "llm") };
  }

  if (inputType === "text") {
    const heuristic = parseRecipeFromText(value, {});
    let draft = heuristic;
    let method: ImportOutcome["method"] = "heuristic";

    if (options.useLlm !== false && llmConfigured() && confidenceOf(draft) < 0.8) {
      const llm = await structureWithLlm({ text: value, title: heuristic.title, sourceType: "web", fetchImpl: options.fetchImpl });
      if (llm) {
        draft = mergeDrafts(llm, heuristic);
        method = "llm";
      }
    }

    if (draft.ingredients.length === 0 && draft.steps.length === 0) {
      throw ApiError.badRequest(
        "We could not find ingredients and steps in that text. Paste the recipe description, or use a recipe link.",
      );
    }
    const tidy = tidyDraft({ ...draft, sourceType: draft.sourceType === "ai" ? "ai" : "web" });
    return { draft: tidy, method, confidence: confidenceOf(tidy), warnings: warningsFor(tidy, method) };
  }

  if (inputType === "youtube") {
    const { draft: heuristic, description, captionText, meta } = await importFromYouTube(value, {
      fetchImpl: options.fetchImpl,
    });
    let draft = heuristic;
    let method: ImportOutcome["method"] = "youtube";

    if (draft.ingredients.length === 0 && captionText) {
      const fromCaptions = parseRecipeFromText(captionText, {
        title: meta.title,
        sourceUrl: draft.sourceUrl,
        sourceVideoId: meta.videoId,
        sourceChannel: meta.channel,
      });
      fromCaptions.sourceType = "youtube";
      fromCaptions.heroImageUrl = meta.thumbnailUrl;
      fromCaptions.sourceAuthor = meta.channel;
      draft = mergeDrafts(fromCaptions, draft);
    }

    if (options.useLlm !== false && llmConfigured() && confidenceOf(draft) < 0.8) {
      const sourceText = [description, captionText, heuristic.description]
        .filter(Boolean)
        .join("\n\n");
      const llm = await structureWithLlm({
        text:
          sourceText ||
          `Draft a structured recipe matching this cooking video: "${meta.title}" by ${meta.channel ?? "YouTube Chef"}.`,
        title: heuristic.title,
        sourceUrl: heuristic.sourceUrl,
        sourceType: "youtube",
        allowGeneration: Boolean(options.allowAiFallback && draft.ingredients.length === 0),
        fetchImpl: options.fetchImpl,
      });
      if (llm) {
        draft = mergeDrafts(
          {
            ...llm,
            heroImageUrl: heuristic.heroImageUrl,
            sourceVideoId: meta.videoId,
            sourceChannel: meta.channel,
            sourceAuthor: meta.channel,
            sourceType: "youtube",
          },
          heuristic,
        );
        method = "llm";
      }
    }

    if (draft.ingredients.length === 0 && draft.steps.length === 0) {
      throw ApiError.badRequest(
        "That video's description has no recipe in it. Try another video for this dish, scan the recipe with OCR (photo/screenshot), or paste the recipe text.",
        { next: ["youtube", "ocr", "paste"] },
      );
    }
    const tidy = tidyDraft(draft);
    return { draft: tidy, method, confidence: confidenceOf(tidy), warnings: warningsFor(tidy, method) };
  }

  // --- Website ---
  const page = await safeFetchPage(value, { fetchImpl: options.fetchImpl });
  const jsonld = extractJsonLdRecipe(page.html, page.url);

  let draft: RecipeDraft;
  let method: ImportOutcome["method"] = "jsonld";

  if (jsonld && jsonld.ingredients.length >= 3 && jsonld.steps.length >= 1) {
    draft = jsonld;
  } else {
    const fallback = extractPageFallback(page.html, page.url);
    const pageText = stripHtml(page.html).slice(0, 14_000);
    const heuristic = parseRecipeFromText(pageText, {
      title: fallback.title ?? titleFromUrl(page.url),
      sourceUrl: page.url,
    });
    heuristic.heroImageUrl = heuristic.heroImageUrl ?? fallback.heroImageUrl;
    heuristic.description = heuristic.description ?? fallback.description;
    draft = jsonld ? mergeDrafts(jsonld, heuristic) : heuristic;
    method = "heuristic";

    if (options.useLlm !== false && llmConfigured() && confidenceOf(draft) < 0.8) {
      const llm = await structureWithLlm({
        text: pageText,
        title: fallback.title,
        sourceUrl: page.url,
        sourceType: "web",
        fetchImpl: options.fetchImpl,
      });
      if (llm) {
        draft = mergeDrafts(llm, draft);
        method = "llm";
      }
    }
  }

  // Keep the page's own cooking video attached (in-app player + provenance),
  // and when the page text is thin, mine that video's description — Food
  // Fusion puts the full written recipe in both places.
  const videoId = embeddedYouTubeId(page.html);
  if (videoId && !draft.sourceVideoId) {
    draft.sourceVideoId = videoId;
  }
  if (videoId && draft.ingredients.length < 3) {
    try {
      const fromVideo = await importFromYouTube(`https://www.youtube.com/watch?v=${videoId}`, {
        fetchImpl: options.fetchImpl,
      });
      if (fromVideo.draft.ingredients.length > draft.ingredients.length) {
        draft = mergeDrafts(
          { ...fromVideo.draft, sourceUrl: page.url, sourceType: "web" },
          draft,
        );
        draft.sourceVideoId = videoId;
      }
    } catch {
      // The webpage draft still stands on its own.
    }
  }

  // Search-results / listing pages (e.g. foodfusion.com/?s=Chicken+Balochi+Karahi
  // or a DuckDuckGo results page) hold cards, not a recipe. Follow the best
  // matching card once and import the real recipe page behind it.
  if (draft.ingredients.length < 3 && (options._depth ?? 0) < 1) {
    const cards = rankCardsForDish(
      extractRecipeLinks(page.html, page.url).filter((card) => card.isLikelyRecipe),
      dishHintFromUrl(page.url),
    );
    const best = cards[0];
    if (best && best.url !== page.url) {
      try {
        const followed = await importRecipe(
          { inputType: "url", inputValue: best.url },
          { ...options, _depth: (options._depth ?? 0) + 1 },
        );
        return {
          ...followed,
          warnings: [
            `That link was a search page, so we opened its best-matching recipe: “${followed.draft.title}”.`,
            ...followed.warnings,
          ],
        };
      } catch {
        // Fall through to the honest error below.
      }
    }
  }

  if (draft.ingredients.length === 0 && draft.steps.length === 0) {
    throw ApiError.badRequest(
      "That page does not contain a readable recipe. Try the YouTube tab for this dish (the recipe is usually in the video description), scan a photo with OCR, or paste the recipe text.",
    );
  }

  const tidy = tidyDraft(draft);
  return { draft: tidy, method, confidence: confidenceOf(tidy), warnings: warningsFor(tidy, method) };
}

export { emptyDraft };
