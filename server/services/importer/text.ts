import type { Ingredient, RecipeDraft, Step } from "../../../shared/types.js";
import { emptyDraft, parseIngredientLine, parseServings, stepFromText, titleFromUrl } from "./parse.js";

const INGREDIENT_HEADING =
  /^(?:🛒\s*)?(?:ingredients?|you(?:'| wi)ll need|what you need|shopping list|for the .+)\s*:?\s*$/i;
const STEP_HEADING =
  /^(?:👩‍🍳\s*)?(?:method|instructions?|directions?|steps?|preparation|how to (?:make|cook)|procedure|cooking)\s*:?\s*$/i;

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

function findHeading(lines: string[], pattern: RegExp): number {
  return lines.findIndex((line) => line.length > 0 && line.length < 60 && pattern.test(line.replace(/[:\s]+$/, "").trim()));
}

/**
 * Deterministic parser for a YouTube description or pasted recipe text.
 * Handles the common "Ingredients / Method" layout plus a heuristic fallback.
 */
export function parseRecipeFromText(
  rawText: string,
  options: { title?: string; sourceUrl?: string | null; sourceVideoId?: string | null; sourceChannel?: string | null } = {},
): RecipeDraft {
  const lines = cleanLines(rawText);
  const nonEmpty = lines.filter((line) => line.length > 0);

  const ingredientStart = findHeading(lines, INGREDIENT_HEADING);
  const stepStart = findHeading(lines, STEP_HEADING);

  const ingredients: Ingredient[] = [];
  const steps: Step[] = [];

  if (ingredientStart >= 0 && stepStart > ingredientStart) {
    const ingredientLines = lines.slice(ingredientStart + 1, stepStart);
    ingredientLines.forEach((line, index) => {
      const parsed = parseIngredientLine(line, index);
      if (parsed) ingredients.push(parsed);
    });
    const stepLines = lines.slice(stepStart + 1);
    let buffer = "";
    let position = 0;
    const flush = () => {
      const text = buffer.trim();
      if (text.length >= 15) {
        steps.push(stepFromText(text, position++));
      }
      buffer = "";
    };
    for (const line of stepLines) {
      if (!line) continue;
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
    // Heuristic: lines that start with a quantity are ingredients.
    for (const line of nonEmpty) {
      if (line.length > 120) continue;
      if (!/^\d|^[½¼¾⅓⅔]|^a (?:pinch|dash)|^salt|^pepper/i.test(line)) continue;
      const parsed = parseIngredientLine(line, ingredients.length);
      if (parsed) ingredients.push(parsed);
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

  const servingsLine = rawText.match(/(?:serves|servings?|makes|yield)\s*:?\s*(\d+)/i);
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
