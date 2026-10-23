import type { Ingredient, RecipeDraft, Step } from "../../../shared/types.js";
import { parseQuantity } from "../scaling.js";

export const UNIT_WORDS = [
  "cups", "cup", "tablespoons", "tablespoon", "tbsp", "teaspoons", "teaspoon", "tsp",
  "kilograms", "kilogram", "kg", "grams", "gram", "g", "millilitres", "millilitre",
  "milliliters", "milliliter", "ml", "litres", "litre", "liters", "liter", "l",
  "ounces", "ounce", "oz", "pounds", "pound", "lb", "lbs",
  "pieces", "piece", "pcs", "pc", "cloves", "clove", "slices", "slice", "cans", "can",
  "tins", "tin", "bunches", "bunch", "sprigs", "sprig", "stalks", "stalk", "heads", "head",
  "packets", "packet", "sheets", "sheet", "pinches", "pinch", "dashes", "dash",
  "handfuls", "handful", "scoops", "scoop", "drops", "drop", "sticks", "stick",
];

const UNIT_LOOKUP = new Map<string, string>([
  ["g", "g"], ["kg", "kg"], ["mg", "mg"], ["ml", "ml"], ["l", "l"],
  ["oz", "oz"], ["lb", "lb"], ["tbsp", "tbsp"], ["tsp", "tsp"], ["cup", "cups"], ["cups", "cups"],
  ["tablespoon", "tbsp"], ["tablespoons", "tbsp"], ["teaspoon", "tsp"], ["teaspoons", "tsp"],
  ["kilogram", "kg"], ["kilograms", "kg"], ["gram", "g"], ["grams", "g"],
  ["millilitre", "ml"], ["millilitres", "ml"], ["milliliter", "ml"], ["milliliters", "ml"],
  ["litre", "l"], ["litres", "l"], ["liter", "l"], ["liters", "l"],
  ["ounce", "oz"], ["ounces", "oz"], ["pound", "lb"], ["pounds", "lb"], ["lbs", "lb"],
  ["piece", "pieces"], ["pc", "pieces"], ["pcs", "pieces"], ["clove", "cloves"],
  ["slice", "slices"], ["can", "cans"], ["tin", "cans"], ["bunch", "bunches"],
  ["sprig", "sprigs"], ["stalk", "stalks"], ["head", "heads"], ["packet", "packets"],
  ["sheet", "sheets"], ["pinch", "pinches"], ["dash", "dashes"], ["handful", "handfuls"],
  ["scoop", "scoops"], ["drop", "drops"], ["stick", "sticks"], ["cup", "cups"],
]);

export function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°",
    frac12: "½", frac14: "¼", frac34: "¾", frac13: "⅓", frac23: "⅔",
  };
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "1 1/2 cups all-purpose flour, sifted" → structured ingredient. */
/** Splits on commas that are not inside brackets: "toppings (ham, cheese), salt". */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

export function parseIngredientLine(line: string, position: number): Ingredient | null {
  const raw = decodeEntities(line)
    .replace(/^\s*(?:[-*•·–—]|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (raw.length < 2) return null;

  // Order matters: a plain fraction ("1/4 tsp") must win over the whole number "1".
  const match = raw.match(
    /^([0-9]+\s*\/\s*[0-9]+|[0-9]+(?:[.,][0-9]+)?(?:\s+[0-9]+\s*\/\s*[0-9]+)?|[½¼¾⅓⅔⅛])(?:\s*[-–]\s*[0-9]+(?:[.,][0-9]+)?)?\s*(.*)$/,
  );

  let quantity: number | null = null;
  let rest = raw;
  if (match) {
    quantity = parseQuantity(match[1].replace(",", "."));
    rest = match[2] ?? "";
  }

  let unit: string | null = null;
  const unitMatch = rest.match(/^([a-zA-Z]+)\.?\s+(.*)$/);
  if (unitMatch && UNIT_LOOKUP.has(unitMatch[1].toLowerCase())) {
    unit = UNIT_LOOKUP.get(unitMatch[1].toLowerCase()) ?? null;
    rest = unitMatch[2];
  }

  const segments = splitTopLevel(rest).map((segment) => segment.trim()).filter(Boolean);
  const [itemPart, ...noteParts] = segments.length > 0 ? segments : [""];
  const item = (itemPart ?? "").trim();
  if (!item) return null;
  const prepNote = noteParts.join(", ").trim() || null;

  const unscalable = /to taste|as needed|for garnish|optional/i.test(raw);
  return {
    position,
    quantity: unscalable ? null : quantity,
    unit,
    item,
    prepNote,
    groupName: null,
    scalable: !unscalable && quantity !== null,
    rawText: raw,
  };
}

export function parseIngredientsFromLines(lines: string[]): Ingredient[] {
  return lines
    .map((line, index) => parseIngredientLine(line, index))
    .filter((value): value is Ingredient => Boolean(value));
}

export function cleanStep(line: string): string {
  return decodeEntities(line)
    .replace(/^\s*(?:[-*•·–—]|\d+[.)]|step\s*\d+[:.)]?)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDuration(text: string | null | undefined): number | null {
  if (!text) return null;
  const iso = text.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso && (iso[1] || iso[2] || iso[3])) {
    return Number(iso[1] ?? 0) * 1440 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
  }
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const minutes = text.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  const total = Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
  return total > 0 ? Math.round(total) : null;
}

export function parseServings(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === "string") {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
    }
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseServings(entry);
      if (parsed) return parsed;
    }
  }
  return null;
}

export function firstString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return firstString(record.url ?? record.name ?? record["@id"]);
  }
  return null;
}

export function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      const candidate = decodeURIComponent(segments[i])
        .replace(/\.(html?|php|aspx?|jsp)$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\d{4,}\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (candidate.length >= 3 && !/^(index|recipe|recipes|watch|video|search|post)$/i.test(candidate)) {
        return candidate.replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "Imported recipe";
  }
}

export function confidenceOf(draft: RecipeDraft): number {
  let score = 0;
  if (draft.title?.trim()) score += 0.2;
  if (draft.ingredients.length >= 3) score += 0.25;
  else if (draft.ingredients.length > 0) score += 0.1;
  if (draft.steps.length >= 2) score += 0.25;
  else if (draft.steps.length === 1) score += 0.1;
  if (draft.heroImageUrl) score += 0.15;
  if (draft.baseServings > 0) score += 0.15;
  return Math.round(Math.min(1, score) * 100) / 100;
}

export function emptyDraft(partial: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    title: "",
    cuisine: null,
    description: null,
    difficulty: null,
    baseServings: 4,
    totalMinutes: null,
    heroImageUrl: null,
    sourceType: "web",
    sourceUrl: null,
    sourceVideoId: null,
    sourceChannel: null,
    sourceAuthor: null,
    ingredients: [],
    steps: [],
    ...partial,
  };
}

export function stepFromText(text: string, position: number, imageUrl: string | null = null): Step {
  return {
    position,
    instruction: cleanStep(text),
    durationSeconds: parseDuration(text) ? parseDuration(text)! * 60 : null,
    temperatureC: parseTemperature(text),
    imageUrl,
    tip: null,
  };
}

export function parseTemperature(text: string): number | null {
  const gasMark = text.match(/gas\s*mark\s*(\d)/i);
  if (gasMark) {
    const map = [140, 150, 160, 180, 190, 200, 220, 230, 240];
    return map[Number(gasMark[1]) - 1] ?? null;
  }
  const fahrenheit = text.match(/(\d{2,3})\s*(?:°|º)?\s*F\b/i);
  if (fahrenheit) return Math.round(((Number(fahrenheit[1]) - 32) * 5) / 9);
  const celsius = text.match(/(\d{2,3})\s*(?:°|º)?\s*C\b/i);
  if (celsius) return Number(celsius[1]);
  return null;
}
