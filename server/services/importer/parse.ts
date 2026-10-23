import type { Ingredient, RecipeDraft, Step } from "../../../shared/types.js";
import { parseQuantity } from "../scaling.js";
import { collapseRepeatedText, isLikelyIngredientLine, isMonthWord, stripInlineNoise } from "./clean.js";

export const UNIT_WORDS = [
  "cups", "cup", "tablespoons", "tablespoon", "tbsp", "tbs", "teaspoons", "teaspoon", "tsp",
  "kilograms", "kilogram", "kg", "grams", "gram", "g", "millilitres", "millilitre",
  "milliliters", "milliliter", "ml", "litres", "litre", "liters", "liter", "l",
  "ounces", "ounce", "oz", "pounds", "pound", "lb", "lbs",
  "pieces", "piece", "pcs", "pc", "cloves", "clove", "slices", "slice", "cans", "can",
  "tins", "tin", "bunches", "bunch", "sprigs", "sprig", "stalks", "stalk", "heads", "head",
  "bulbs", "bulb",
  "packets", "packet", "sheets", "sheet", "pinches", "pinch", "dashes", "dash",
  "handfuls", "handful", "scoops", "scoop", "drops", "drop", "sticks", "stick",
];

const UNIT_LOOKUP = new Map<string, string>([
  ["g", "g"], ["kg", "kg"], ["mg", "mg"], ["ml", "ml"], ["l", "l"],
  ["oz", "oz"], ["lb", "lb"], ["tbsp", "tbsp"], ["tbs", "tbsp"], ["tsp", "tsp"], ["cup", "cups"], ["cups", "cups"],
  ["gm", "g"], ["gms", "g"], ["kgs", "kg"], ["tsps", "tsp"], ["tbsps", "tbsp"],
  ["tablespoon", "tbsp"], ["tablespoons", "tbsp"], ["teaspoon", "tsp"], ["teaspoons", "tsp"],
  ["kilogram", "kg"], ["kilograms", "kg"], ["gram", "g"], ["grams", "g"],
  ["millilitre", "ml"], ["millilitres", "ml"], ["milliliter", "ml"], ["milliliters", "ml"],
  ["litre", "l"], ["litres", "l"], ["liter", "l"], ["liters", "l"],
  ["ounce", "oz"], ["ounces", "oz"], ["pound", "lb"], ["pounds", "lb"], ["lbs", "lb"],
  ["piece", "pieces"], ["pc", "pieces"], ["pcs", "pieces"], ["clove", "cloves"],
  ["slice", "slices"], ["can", "cans"], ["tin", "cans"], ["bunch", "bunches"],
  ["sprig", "sprigs"], ["stalk", "stalks"], ["head", "heads"], ["bulb", "bulbs"], ["bulbs", "bulbs"],
  ["packet", "packets"],
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
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      // Break BEFORE block elements too — otherwise nav/header text glues onto
      // the next heading ("English Urdu Ingredients:") and section detection fails.
      .replace(/(?=<(?:p|div|li|h[1-6]|section|article|tr|blockquote|pre|nav|header|footer)[\s>])/gi, "\n")
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

/**
 * Roman-Urdu / Hindi ingredient-name words. Sites like Food Fusion write
 * "Sabut dhania (Coriander seeds) ½ tbs" — local name first, English in
 * brackets, quantity LAST. When the bracket form is detected we prefer the
 * English name as the item (shopping aisles + scaling work far better) and
 * keep the full original line in rawText.
 */
const ROMAN_URDU_WORDS = new Set([
  "sabut", "dhania", "lal", "mirch", "mirchi", "zeera", "kali", "namak", "kasuri", "qasuri",
  "hari", "hara", "adrak", "lehsan", "lahsun", "dahi", "podina", "kala", "pyaz", "piyaz",
  "aloo", "gajar", "haldi", "ajwain", "saunf", "sonf", "elaichi", "dalchini", "laung",
  "maida", "atta", "besan", "chawal", "gosht", "murghi", "machli", "tamatar", "nimbu",
  "tatri", "methi", "sarson", "moong", "chana", "masoor", "arhar", "rajma", "katori",
]);

function capitalise(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

/**
 * "Sabut dhania (Coriander seeds) roasted & crushed" →
 * item "Coriander seeds", extraNote "roasted & crushed".
 * Only swaps when the pre-bracket name contains a Roman-Urdu word, so plain
 * English lines like "flour (all-purpose)" are left untouched.
 */
function extractBracketedEnglish(itemText: string): { item: string; extraNote: string | null } {
  const match = itemText.match(/^(.+?)\s*\(([^)]{3,60})\)\s*(.*)$/);
  if (!match) return { item: itemText, extraNote: null };
  const [, before, inside, after] = match;
  const beforeWords = before.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const looksLocal = beforeWords.some((word) => ROMAN_URDU_WORDS.has(word));
  if (!looksLocal || /^\d/.test(inside.trim()) || !/[a-z]/i.test(inside)) {
    return { item: itemText, extraNote: null };
  }
  return { item: capitalise(inside), extraNote: after.trim() || null };
}

const LEADING_QTY_RE =
  /^([0-9]+\s*[½¼¾⅓⅔⅛]|[0-9]+\s*\/\s*[0-9]+|[0-9]+(?:[.,][0-9]+)?(?:\s+[0-9]+\s*\/\s*[0-9]+)?|[½¼¾⅓⅔⅛])(?:\s*[-–]\s*[0-9]+(?:[.,][0-9]+)?)?\s*(.*)$/;

// Food Fusion style: the quantity (and unit) come at the END of the line —
// "Kali mirch powder (Black pepper powder) 1 tsp", "Hari mirch 7-8", "Chicken 500g".
const TRAILING_QTY_RE =
  /^(.*\S)\s+([0-9]+\s*[½¼¾⅓⅔⅛]|[0-9]+\s+[0-9]+\s*\/\s*[0-9]+|[0-9]+\s*\/\s*[0-9]+|[0-9]+(?:[.,][0-9]+)?(?:\s*[-–]\s*[0-9]+(?:[.,][0-9]+)?)?|[½¼¾⅓⅔⅛](?:\s*[-–]\s*(?:[0-9]+(?:[.,][0-9]+)?|[½¼¾⅓⅔⅛]))?)\s*([a-zA-Z]+)?\.?\s*(?:or\s+to\s+taste|to\s+taste)?\s*$/i;

const NUMBER_WORDS: Record<string, number> = {
  half: 0.5, "a half": 0.5, "half a": 0.5, "half an": 0.5, "a quarter": 0.25,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function normalizeLeadingWordNumber(raw: string): string {
  const match = raw.match(/^(half\s+an?|a\s+half|a\s+quarter|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.*)$/i);
  if (match) {
    const val = NUMBER_WORDS[match[1].toLowerCase()];
    if (val !== undefined) return `${val} ${match[2]}`;
  }
  return raw;
}

export function parseIngredientLine(line: string, position: number): Ingredient | null {
  const collapsed = collapseRepeatedText(
    decodeEntities(line)
      .replace(/^\s*(?:[-*•·–—]|\d+[.)])\s+/, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (collapsed.length < 2) return null;
  // Page furniture (nutrition panels, review dates, "Copy text / Add to list"
  // buttons, prose paragraphs) must never become an ingredient — this single
  // guard covers every import path (JSON-LD, page text, YouTube, OCR, LLM).
  if (!isLikelyIngredientLine(collapsed)) return null;

  const raw = normalizeLeadingWordNumber(collapsed);

  let quantity: number | null = null;
  let unit: string | null = null;
  let rest = raw;

  // Order matters: a plain fraction ("1/4 tsp") must win over the whole number "1".
  const match = raw.match(LEADING_QTY_RE);
  if (match) {
    quantity = parseQuantity(match[1].replace(",", "."));
    rest = match[2] ?? "";
    const unitMatch = rest.match(/^([a-zA-Z]+)\.?\s+(?:of\s+)?(.*)$/);
    if (unitMatch) {
      const word = unitMatch[1].toLowerCase();
      // Plural units that are missing from the lookup ("2 cloves garlic").
      const resolved = UNIT_LOOKUP.get(word) ?? (word.endsWith("s") ? UNIT_LOOKUP.get(word.slice(0, -1)) : undefined);
      if (resolved) {
        unit = resolved;
        rest = unitMatch[2];
      }
    }
    // Count-unit layout where unit follows item: "3 garlic cloves, crushed", "8 rosemary sprigs"
    if (!unit) {
      const countUnitMatch = rest.match(
        /^([a-zA-Z\s]+?)\s+(cloves?|sprigs?|stalks?|slices?|pieces?|heads?|bulbs?)\b\.?\s*(?:,\s*(.*))?$/i,
      );
      if (countUnitMatch) {
        const word = countUnitMatch[2].toLowerCase();
        const resolved = UNIT_LOOKUP.get(word) ?? (word.endsWith("s") ? UNIT_LOOKUP.get(word.slice(0, -1)) : undefined);
        if (resolved) {
          unit = resolved;
          rest = countUnitMatch[1].trim() + (countUnitMatch[3] ? `, ${countUnitMatch[3].trim()}` : "");
        }
      }
    }
  } else {
    // No leading quantity — try the trailing-quantity layout. The trailing
    // word after the number must be a known unit (or absent), so step-like
    // lines ("cook for 2 minutes") are never mistaken for ingredients.
    const trailing = raw.match(TRAILING_QTY_RE);
    if (trailing) {
      const trailingUnit = trailing[3]?.toLowerCase();
      if (!trailingUnit || UNIT_LOOKUP.has(trailingUnit)) {
        const parsed = parseQuantity(trailing[2].replace(",", "."));
        // A bare 4-digit "quantity" at the end of a line is a year
        // ("Published March 2021"), not an ingredient amount.
        const looksLikeYear = !trailingUnit && parsed !== null && parsed >= 1900 && parsed <= 2100;
        if (parsed !== null && parsed > 0 && parsed < 100_000 && !looksLikeYear) {
          quantity = parsed;
          unit = trailingUnit ? (UNIT_LOOKUP.get(trailingUnit) ?? null) : null;
          rest = trailing[1].trim();
        }
      }
    }
  }

  const segments = splitTopLevel(rest).map((segment) => segment.trim()).filter(Boolean);
  const [itemPart, ...noteParts] = segments.length > 0 ? segments : [""];
  // "2 cups (250g) plain flour" → item "plain flour"; the bracket is the same
  // amount in another unit, not part of the shopping name.
  const rawItem = (itemPart ?? "")
    .trim()
    .replace(/^\(\s*[^)]*\d[^)]*\)\s*/, "")
    .replace(/:\s*$/, "");
  if (!rawItem) return null;
  if (isMonthWord(rawItem)) return null;

  const { item, extraNote } = extractBracketedEnglish(rawItem);
  const notes = [extraNote, ...noteParts].filter(Boolean) as string[];
  const prepNote = notes.join(", ").trim() || null;

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
  return stripInlineNoise(decodeEntities(line)
    .replace(
      /^\s*(?:[-*•·–—]|\d+[.)]|step\s*\d+\s*(?:of|\/)\s*\d+|step\s*\d+[:.)]?|\d+\s*(?:of|\/)\s*\d+)\s+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim());
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
