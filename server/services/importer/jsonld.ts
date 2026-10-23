import type { Ingredient, RecipeDraft, Step } from "../../../shared/types.js";
import {
  confidenceOf, decodeEntities, emptyDraft, firstString, parseDuration, parseIngredientLine,
  parseServings, parseTemperature, stepFromText, stripHtml, titleFromUrl,
} from "./parse.js";

type Json = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function hasType(node: Json, type: string): boolean {
  return asArray(node["@type"]).some((t) => String(t).toLowerCase() === type.toLowerCase());
}

function walk(node: unknown, visit: (node: Json) => void, depth = 0): void {
  if (depth > 8 || !node) return;
  if (Array.isArray(node)) {
    node.forEach((entry) => walk(entry, visit, depth + 1));
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Json;
  visit(record);
  for (const key of ["@graph", "mainEntity", "itemListElement", "hasPart"]) {
    if (record[key]) walk(record[key], visit, depth + 1);
  }
}

function stepsFromInstructions(value: unknown, depth = 0): Step[] {
  const steps: Step[] = [];
  const push = (text: string, image: string | null) => {
    const cleaned = decodeEntities(stripHtml(text));
    if (cleaned.length < 3) return;
    const step = stepFromText(cleaned, steps.length, image);
    steps.push({ ...step, temperatureC: parseTemperature(cleaned) });
  };

  for (const entry of asArray(value)) {
    if (typeof entry === "string") {
      const paragraphs = entry.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      if (paragraphs.length > 1) paragraphs.forEach((p) => push(p, null));
      else push(entry, null);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Json;
    if (hasType(record, "HowToSection") || record.itemListElement) {
      steps.push(...stepsFromInstructions(record.itemListElement, depth + 1));
      continue;
    }
    const text = firstString(record.text) ?? firstString(record.name) ?? firstString(record.description);
    const image = firstString(record.image);
    if (text) push(text, image);
  }
  return steps;
}

export function extractJsonLdRecipe(html: string, pageUrl: string): RecipeDraft | null {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates: Json[] = [];

  for (const match of scripts) {
    const raw = match[1].trim().replace(/^<!--|-->$/g, "");
    try {
      const parsed = JSON.parse(raw) as unknown;
      walk(parsed, (node) => {
        if (hasType(node, "Recipe")) candidates.push(node);
      });
    } catch {
      // Some sites emit multiple JSON objects or trailing commas — skip bad blocks.
      continue;
    }
  }

  const best = candidates.sort((a, b) => {
    const score = (node: Json) =>
      asArray(node.recipeIngredient).length * 2 + asArray(node.recipeInstructions).length;
    return score(b) - score(a);
  })[0];
  if (!best) return null;

  const ingredients: Ingredient[] = asArray(best.recipeIngredient)
    .map((line, index) => parseIngredientLine(String(line), index))
    .filter((value): value is Ingredient => Boolean(value));

  const steps = stepsFromInstructions(best.recipeInstructions);

  const totalMinutes =
    parseDuration(firstString(best.totalTime)) ??
    ((parseDuration(firstString(best.prepTime)) ?? 0) +
      (parseDuration(firstString(best.cookTime)) ?? 0) ||
      null);

  const draft = emptyDraft({
    title: firstString(best.name) ?? titleFromUrl(pageUrl),
    cuisine: firstString(best.recipeCuisine),
    description: firstString(best.description),
    difficulty: null,
    baseServings: parseServings(best.recipeYield) ?? 4,
    totalMinutes: totalMinutes && totalMinutes > 0 ? totalMinutes : null,
    heroImageUrl: firstString(best.image),
    sourceType: pageUrl.includes("youtube.com") || pageUrl.includes("youtu.be") ? "youtube" : "web",
    sourceUrl: pageUrl,
    sourceAuthor: firstString(best.author),
    ingredients,
    steps,
  });

  if (draft.ingredients.length === 0 && draft.steps.length === 0) return null;
  return draft;
}

/**
 * "Healthier Spaghetti Bolognese Recipe | Woolworths" → "Healthier Spaghetti
 * Bolognese Recipe". Drops a trailing site-name segment (it matches the page
 * host, or is a short brand-like block) but keeps real subtitle text.
 */
export function tidyPageTitle(value: string | null, pageUrl: string): string | null {
  if (!value) return value;
  const trimmed = value.trim();
  const segments = trimmed.split(/\s*[|·•—–]\s*/).filter(Boolean);
  if (segments.length < 2) return trimmed;
  let host = "";
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./i, "").split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  } catch {
    /* keep host empty */
  }
  const last = segments[segments.length - 1].trim();
  const lastKey = last.toLowerCase().replace(/[^a-z0-9]/g, "");
  const looksLikeSiteName = Boolean(host) && lastKey.length > 2 && (host.startsWith(lastKey) || lastKey.startsWith(host));
  const shortBrand = last.split(/\s+/).length <= 3 && last.length <= 24;
  if (looksLikeSiteName || shortBrand) return segments.slice(0, -1).join(" — ").trim();
  return trimmed;
}

/** OpenGraph / meta fallback when a page has no schema.org Recipe block. */
export function extractPageFallback(html: string, pageUrl: string): RecipeDraft {
  const meta = (property: string): string | null => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return decodeEntities(match[1]).trim();
    }
    return null;
  };

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const text = stripHtml(html);
  const rawTitle =
    [meta("og:title"), decodeEntities(titleTag?.[1] ?? ""), decodeEntities(heading?.[1] ?? "")]
      .map((candidate) => candidate?.trim())
      .find((candidate) => Boolean(candidate)) ?? "";

  return emptyDraft({
    title: tidyPageTitle(rawTitle, pageUrl) || titleFromUrl(pageUrl),
    description: meta("og:description") ?? meta("description"),
    heroImageUrl: meta("og:image") ?? meta("twitter:image"),
    sourceType: pageUrl.includes("youtube.com") || pageUrl.includes("youtu.be") ? "youtube" : "web",
    sourceUrl: pageUrl,
    baseServings: 4,
    ingredients: [],
    steps: [],
    // Keep the cleaned text so the heuristic / LLM pass has something to work with.
    ...(text ? { description: (meta("og:description") ?? meta("description") ?? text.slice(0, 1800)) } : {}),
  });
}

export { confidenceOf };
