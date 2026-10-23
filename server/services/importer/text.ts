import type { Ingredient, RecipeDraft, Step } from "../../../shared/types.js";
import { emptyDraft, parseIngredientLine, parseServings, stepFromText, titleFromUrl } from "./parse.js";

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

/** Group captions inside a block: "Prepare Balochi Tikka Boti:", "For the marinade:" … */
function groupHeadingOf(line: string): string | null {
  const cleaned = line.replace(/\*\*/g, "").trim();
  if (cleaned.length < 3 || cleaned.length > 60) return null;
  if (/^(?:for the|for|prepare|to make|for making)\b/i.test(cleaned) && /:?\s*$/.test(cleaned)) {
    return cleaned.replace(/:\s*$/, "").trim() || null;
  }
  if (/:\s*$/.test(cleaned) && !/^\d/.test(cleaned)) {
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
        .replace(/^\s*(?:[-*•·–—]\s*)+/, "")
        .replace(/^\s*\d{1,2}[.)]\s+/, (match) => match)
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

/**
 * Deterministic parser for a YouTube description, pasted recipe text, OCR
 * scan, or stripped web page. Handles the common "Ingredients / Method"
 * layout, Food Fusion's trailing quantities + group captions + Roman-Urdu
 * repeat, plus a heuristic fallback when there are no headings at all.
 */
export function parseRecipeFromText(
  rawText: string,
  options: { title?: string; sourceUrl?: string | null; sourceVideoId?: string | null; sourceChannel?: string | null } = {},
): RecipeDraft {
  const lines = cleanLines(rawText);
  const nonEmpty = lines.filter((line) => line.length > 0);

  const ingredientStart = findHeading(lines, INGREDIENT_HEADING, INGREDIENT_HEADING_SUFFIX);
  const stepStart = findHeading(lines, STEP_HEADING, STEP_HEADING_SUFFIX);

  const ingredients: Ingredient[] = [];
  const steps: Step[] = [];

  if (ingredientStart >= 0 && stepStart > ingredientStart) {
    let currentGroup: string | null = null;
    for (const line of lines.slice(ingredientStart + 1, stepStart)) {
      if (!line) continue;
      if (TRANSLATION_BLOCK_START.test(line.replace(/\*\*/g, "").trim())) break;
      const group = groupHeadingOf(line);
      if (group) {
        currentGroup = group;
        continue;
      }
      const parsed = parseIngredientLine(line, ingredients.length);
      if (parsed) {
        parsed.groupName = currentGroup;
        ingredients.push(parsed);
      }
    }

    let buffer = "";
    let position = 0;
    const flush = () => {
      const text = buffer.trim();
      if (text.length >= 15) {
        steps.push(stepFromText(text, position++));
      }
      buffer = "";
    };
    for (const line of lines.slice(stepStart + 1)) {
      if (!line) continue;
      const bare = line.replace(/\*\*/g, "").trim();
      if (TRANSLATION_BLOCK_START.test(bare)) break;
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
      const parsed = parseIngredientLine(line, ingredients.length);
      if (parsed && (parsed.quantity !== null || parsed.unit !== null)) {
        ingredients.push(parsed);
      }
    }
  }

  if (steps.length === 0) {
    for (const line of nonEmpty) {
      if (line.length < 40 || line.length > 600) continue;
      if (/^(ingredients?|method|instructions?|directions?|steps?)\s*:?$/i.test(line)) continue;
      if (/https?:\/\//.test(line)) continue;
      if (/^\d/.test(line) && ingredients.some((i) => line.toLowerCase().includes(i.item.toLowerCase()))) continue;
      steps.push(stepFromText(line, steps.length));
    }
  }

  const servingsLine = rawText.match(/(?:serves?|servings?|makes|yield)\s*:?\s*(\d+)/i);
  const timeLine = rawText.match(/(?:total time|prep(?:aration)? time|cook time)\s*:?\s*([^\n]{1,40})/i);
  const totalMinutes = timeLine
    ? (Number(/(\d+)\s*(?:hours?|hrs?)/i.exec(timeLine[1])?.[1] ?? 0) * 60 +
        Number(/(\d+)\s*(?:minutes?|mins?)/i.exec(timeLine[1])?.[1] ?? 0)) || null
    : null;

  const titleLine = nonEmpty.find(
    (line) => line.length >= 3 && line.length <= 100 && !INGREDIENT_HEADING.test(line) && !STEP_HEADING.test(line),
  );

  return emptyDraft({
    title: options.title?.trim() || titleLine || (options.sourceUrl ? titleFromUrl(options.sourceUrl) : "Imported recipe"),
    description: nonEmpty.slice(0, 2).join(" ").slice(0, 400) || null,
    baseServings: parseServings(servingsLine?.[1]) ?? 4,
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
