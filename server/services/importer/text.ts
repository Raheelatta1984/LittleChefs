import type { Ingredient, RecipeDraft, Step } from "../../../shared/types.js";
import { emptyDraft, parseIngredientLine, stepFromText, titleFromUrl } from "./parse.js";
import {
  isDateLikeLine, isPageNoiseLine, isSectionStopHeading, isLikelyStepLine,
} from "./clean.js";

const INGREDIENT_WORDS = String.raw`(?:ingredients?|you(?:'| wi)ll need|what you need|shopping list)`;
const STEP_WORDS = String.raw`(?:method|instructions?|directions?|steps?|preparation|how to (?:make|cook)|procedure|cooking|directions in english)`;

const INGREDIENT_HEADING =
  /^(?:🛒\s*)?(?:ingredients?|you(?:'| wi)ll need|what you need|shopping list|for the .+)\s*:?\s*$/i;
const STEP_HEADING =
  /^(?:👩‍🍳\s*)?(?:method|instructions?|directions?|steps?|preparation|how to (?:make|cook)|procedure|cooking)\s*:?\s*$/i;

// Same headings, but allowed to sit at the END of a line that starts with
// site chrome — stripped HTML often glues nav text onto the heading line
// ("Home Recipes English Urdu Ingredients:"), especially on WordPress sites.
const INGREDIENT_HEADING_SUFFIX = new RegExp(String.raw`\b${INGREDIENT_WORDS}\s*:?\s*$`, "i");
const STEP_HEADING_SUFFIX = new RegExp(String.raw`\b${STEP_WORDS}\s*:?\s*$`, "i");

// Food Fusion (and many Pakistani/Indian sources) repeat the whole recipe a
// second time in Roman Urdu: "Ajza:" = ingredients, "Tarkeeb:" = method.
// We already captured the English block, so the Urdu repeat must never leak
// in as duplicate ingredients or fake steps.
const TRANSLATION_BLOCK_START =
  /^(?:ajza|tarkeeb|tarika|recipe in (?:roman\s+)?urdu|roman urdu(?:\s+recipe)?|urdu recipe|हिंदी में)\b\s*:?\s*$/i;

const KNOWN_GROUP_NAMES = new Set([
  "marinade", "roasting", "dressing", "to serve", "to garnish", "sauce", "filling",
  "topping", "toppings", "crust", "base", "dough", "batter", "glaze", "garnish",
  "garnishes", "salad", "syrup", "icing", "frosting", "rub", "dry rub", "seasoning",
  "spice mix", "spice blend", "spices", "assembly", "pastry", "pasta dough", "for serving",
]);

/** Group captions inside a block: "Prepare Balochi Tikka Boti:", "For the marinade:", "Roasting", "Dressing" … */
function groupHeadingOf(line: string): string | null {
  const cleaned = line.replace(/\*\*/g, "").replace(/__/g, "").trim();
  if (cleaned.length < 2 || cleaned.length > 50) return null;
  // A group heading never contains quantities or numbers
  if (/[\d½¼¾⅓⅔⅛]/.test(cleaned)) return null;

  if (/^(?:for the|for|prepare|to make|for making|to serve|for serving)\b/i.test(cleaned)) {
    return cleaned.replace(/:\s*$/, "").trim() || null;
  }
  if (/:\s*$/.test(cleaned)) {
    return cleaned.replace(/:\s*$/, "").trim() || null;
  }
  const lower = cleaned.toLowerCase().replace(/:\s*$/, "").trim();
  if (KNOWN_GROUP_NAMES.has(lower)) {
    return cleaned.replace(/:\s*$/, "").trim() || null;
  }
  // Short category label without commas or unscalable modifiers
  if (
    cleaned.length <= 35 &&
    !/,/.test(cleaned) &&
    !/\b(?:to taste|as needed|for frying|for cooking|optional)\b/i.test(cleaned) &&
    cleaned.split(/\s+/).length <= 4
  ) {
    return cleaned.replace(/:\s*$/, "").trim() || null;
  }
  return null;
}

function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, "")
        .replace(/^\s*(?:[-*•·–—]\s*)+/, "")
        .replace(/^\s*\d{1,2}[.)]\s+/, (match) => match)
        .replace(/\*\*/g, "")
        .replace(/__/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
}

function findHeading(lines: string[], exact: RegExp, suffix: RegExp): number {
  const exactIndex = lines.findIndex(
    (line) => line.length > 0 && line.length < 60 && exact.test(line.replace(/[:\s]+$/, "").trim()),
  );
  if (exactIndex >= 0) return exactIndex;
  return lines.findIndex(
    (line) => line.length > 0 && line.length < 90 && suffix.test(line.replace(/\*\*/g, "").trim()),
  );
}

/** Locates the Ingredients / Method section line indexes (−1 when absent). */
export function findRecipeSections(rawText: string): { ingredients: number; steps: number } {
  const lines = cleanLines(rawText);
  return {
    ingredients: findHeading(lines, INGREDIENT_HEADING, INGREDIENT_HEADING_SUFFIX),
    steps: findHeading(lines, STEP_HEADING, STEP_HEADING_SUFFIX),
  };
}

/** What the parser had to throw away — surfaced to the chef as a warning. */
export type ParseReport = { skippedNoiseLines: number; collapsedDuplicates: number };

function minutesFromLine(line: string): number | null {
  const hours = line.match(/(?:(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const minutes = line.match(/(?:(\d+)\s*(?:-|–|to)\s*)?(\d+)\s*(?:minutes?|mins?|min|m)\b/i);
  const h = hours ? Number(hours[2] ?? hours[1]) : 0;
  const m = minutes ? Number(minutes[2] ?? minutes[1]) : 0;
  const total = h * 60 + m;
  return total > 0 ? Math.round(total) : null;
}

function firstLineMinutes(lines: string[], pattern: RegExp): number | null {
  for (const line of lines) {
    if (!pattern.test(line)) continue;
    const found = minutesFromLine(line);
    if (found) return found;
  }
  return null;
}

/**
 * "Serves 6", "Serve is for 6 people", "6 servings" or a "Number of servings"
 * field followed by its value. Read line-by-line so the number can never be
 * stolen from the first ingredient ("Number of servings ⏎ 2 tsp oil").
 */
export function detectServings(lines: string[]): number | null {
  const clamp = (value: number) => (value >= 1 && value <= 100 ? value : null);
  for (const line of lines) {
    const direct = line.match(/^\s*(?:serves?|servings?|yield|makes)\b[^0-9\n]{0,24}(\d{1,3})\b/i);
    if (direct) {
      const parsed = clamp(Number(direct[1]));
      if (parsed) return parsed;
    }
    const reverse = line.match(/^\s*(\d{1,3})\s*(?:servings?|portions?|people|persons?)\b/i);
    if (reverse) {
      const parsed = clamp(Number(reverse[1]));
      if (parsed) return parsed;
    }
  }
  const label = lines.findIndex((line) => /^\s*number of servings\b/i.test(line));
  if (label >= 0) {
    for (const line of lines.slice(label + 1, label + 4)) {
      const match = line.match(/^\s*(\d{1,3})\s*$/);
      if (match) {
        const parsed = clamp(Number(match[1]));
        if (parsed) return parsed;
      }
    }
  }
  return null;
}

/** Total time from explicit "Total time" lines, else prep + cook (supports inline "Prep 15 mins | Cook 40 mins"). */
export function detectTotalMinutes(lines: string[]): number | null {
  const total = firstLineMinutes(lines, /^\s*(?:total|overall)\b[^a-z]*(?:time)?\b/i);
  if (total) return total;
  let prep: number | null = null;
  let cook: number | null = null;
  for (const line of lines) {
    if (prep === null) {
      const pMatch = line.match(/\bprep(?:aration)?(?:\s*time)?\s*[:\-]?\s*(.*?)(?=\bcook|$|\||,)/i);
      if (pMatch) prep = minutesFromLine(pMatch[1]);
    }
    if (cook === null) {
      const cMatch = line.match(/\bcook(?:ing)?(?:\s*time)?\s*[:\-]?\s*(.*?)(?=\bprep|$|\||,)/i);
      if (cMatch) cook = minutesFromLine(cMatch[1]);
    }
    if (prep !== null && cook !== null) break;
  }
  if (prep || cook) return (prep ?? 0) + (cook ?? 0) || null;
  return firstLineMinutes(lines, /(?:total|prep(?:aration)?|cook(?:ing)?)\s*time\s*[:\-]/i);
}

function ingredientKey(ingredient: { item: string; quantity: number | null; unit: string | null; groupName: string | null }): string {
  return [ingredient.groupName ?? "", ingredient.unit ?? "", ingredient.quantity ?? "", ingredient.item.toLowerCase()]
    .join("|")
    .replace(/\s+/g, " ");
}

/**
 * Deterministic parser for a YouTube description, pasted recipe text, OCR
 * scan, or stripped web page. Handles the common "Ingredients / Method"
 * layout, Food Fusion's trailing quantities + group captions + Roman-Urdu
 * repeat, plus a heuristic fallback when there are no headings at all.
 */
export function parseRecipeFromText(
  rawText: string,
  options: {
    title?: string;
    sourceUrl?: string | null;
    sourceVideoId?: string | null;
    sourceChannel?: string | null;
    /** Filled in with how much page furniture was filtered out. */
    report?: ParseReport;
  } = {},
): RecipeDraft {
  const lines = cleanLines(rawText);
  const nonEmpty = lines.filter((line) => line.length > 0);
  const report: ParseReport = options.report ?? { skippedNoiseLines: 0, collapsedDuplicates: 0 };
  const ingredients: Ingredient[] = [];
  const steps: Step[] = [];
  const noise = (line: string) => {
    if (isPageNoiseLine(line) || isSectionStopHeading(line)) {
      report.skippedNoiseLines += 1;
      return true;
    }
    return false;
  };
  const seenIngredients = new Set<string>();
  const addIngredient = (ingredient: ReturnType<typeof parseIngredientLine>, group: string | null) => {
    if (!ingredient) return;
    ingredient.groupName = group;
    const key = ingredientKey(ingredient);
    if (seenIngredients.has(key)) {
      report.collapsedDuplicates += 1;
      return;
    }
    seenIngredients.add(key);
    ingredients.push(ingredient);
  };

  const ingredientStart = findHeading(lines, INGREDIENT_HEADING, INGREDIENT_HEADING_SUFFIX);
  const stepStart = findHeading(lines, STEP_HEADING, STEP_HEADING_SUFFIX);

  if (ingredientStart >= 0 && stepStart > ingredientStart) {
    let currentGroup: string | null = null;
    for (const line of lines.slice(ingredientStart + 1, stepStart)) {
      if (!line) continue;
      const bare = line.replace(/\*\*/g, "").trim();
      if (TRANSLATION_BLOCK_START.test(bare)) break;
      // Nutrition panels, reviews, descriptions and related-recipe blocks
      // start after the ingredient list — stop instead of swallowing them.
      if (isSectionStopHeading(bare)) break;
      if (noise(bare)) continue;
      const group = groupHeadingOf(line);
      if (group) {
        currentGroup = group;
        continue;
      }
      addIngredient(parseIngredientLine(line, ingredients.length), currentGroup);
    }

    let buffer = "";
    let position = 0;
    const flush = () => {
      const text = buffer.trim();
      if (text.length >= 15) {
        if (isLikelyStepLine(text)) steps.push(stepFromText(text, position++));
        else report.skippedNoiseLines += 1;
      }
      buffer = "";
    };
    for (const line of lines.slice(stepStart + 1)) {
      if (!line) continue;
      const bare = line.replace(/\*\*/g, "").trim();
      if (TRANSLATION_BLOCK_START.test(bare)) break;
      // "Reviews", "You might also like", "Cost per serve" … end the method.
      if (isSectionStopHeading(bare)) break;
      if (noise(bare)) continue;
      if (groupHeadingOf(line)) {
        flush();
        continue;
      }
      if (/^\d{1,2}[.)]\s+/.test(line)) {
        flush();
        buffer = line.replace(/^\d{1,2}[.)]\s+/, "");
      } else if (/^(subscribe|follow|timestamps?|chapters?|#\w)/i.test(line)) {
        continue;
      } else {
        // A finished sentence followed by a new capitalised line is a new step,
        // even when the source list numbering was lost (e.g. HTML <ol> → text).
        if (buffer && /[.!?]$/.test(buffer.trim()) && /^[A-Z0-9]/.test(line)) flush();
        buffer = buffer ? `${buffer} ${line}` : line;
      }
    }
    flush();
  }

  if (ingredients.length === 0) {
    // Heuristic: short lines carrying a quantity (leading OR Food Fusion
    // trailing style) are ingredients.
    for (const line of nonEmpty) {
      if (line.length > 100 || line.split(/\s+/).length > 9) continue;
      if (TRANSLATION_BLOCK_START.test(line)) break;
      if (isSectionStopHeading(line)) continue;
      if (noise(line)) continue;
      const parsed = parseIngredientLine(line, ingredients.length);
      if (parsed && (parsed.quantity !== null || parsed.unit !== null)) {
        addIngredient(parsed, null);
      }
    }
  }

  if (steps.length === 0) {
    for (const line of nonEmpty) {
      if (line.length < 40 || line.length > 600) continue;
      if (/^(ingredients?|method|instructions?|directions?|steps?)\s*:?$/i.test(line)) continue;
      if (/https?:\/\//.test(line)) continue;
      if (/^\d/.test(line) && ingredients.some((i) => line.toLowerCase().includes(i.item.toLowerCase()))) continue;
      if (isSectionStopHeading(line) || noise(line)) continue;
      if (!isLikelyStepLine(line)) continue;
      steps.push(stepFromText(line, steps.length));
    }
  }

  const servings = detectServings(nonEmpty);
  const totalMinutes = detectTotalMinutes(nonEmpty);

  const titleLine = nonEmpty.find(
    (line) =>
      line.length >= 3 &&
      line.length <= 100 &&
      !INGREDIENT_HEADING.test(line) &&
      !STEP_HEADING.test(line) &&
      !isSectionStopHeading(line) &&
      !isPageNoiseLine(line) &&
      !isDateLikeLine(line),
  );

  return emptyDraft({
    title: options.title?.trim() || titleLine || (options.sourceUrl ? titleFromUrl(options.sourceUrl) : "Imported recipe"),
    description: nonEmpty.slice(0, 2).join(" ").slice(0, 400) || null,
    baseServings: servings ?? 4,
    totalMinutes,
    sourceType: options.sourceVideoId ? "youtube" : "web",
    sourceUrl: options.sourceUrl ?? null,
    sourceVideoId: options.sourceVideoId ?? null,
    sourceChannel: options.sourceChannel ?? null,
    sourceAuthor: options.sourceChannel ?? null,
    ingredients,
    steps,
  });
}
