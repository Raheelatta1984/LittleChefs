import { createHash } from "node:crypto";

/** Words that carry no dish identity — removed from both stored titles and queries. */
const FILLER = new Set([
  "the", "a", "an", "my", "our", "and", "with", "for",
  "easy", "easy-peasy", "quick", "best", "ultimate", "perfect", "classic", "classical",
  "simple", "homemade", "recipe", "recipes", "authentic", "traditional", "healthy",
  "delicious", "yummy", "tasty", "style", "styled", "restaurant",
]);

const KEEP_PLURAL = new Set([
  "hummus", "couscous", "asparagus", "swiss", "glass", "grass", "molasses", "chips", "grits",
  "oats", "pasta", "salsa", "pizza", "samosa", "lassi", "sushi", "risotto", "bbq",
]);

const LIGATURES: Record<string, string> = {
  "œ": "oe", "æ": "ae", "ß": "ss", "ø": "o", "ł": "l", "đ": "d", "þ": "th", "ð": "d",
};

export function stripDiacritics(value: string): string {
  return value
    .replace(/[œæßøłđþð]/gi, (char) => LIGATURES[char.toLowerCase()] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function singularise(token: string): string {
  if (token.length <= 3 || KEEP_PLURAL.has(token)) return token;
  if (token === "leaves") return "leaf";
  if (/ies$/.test(token) && token.length > 4) return `${token.slice(0, -3)}y`;
  if (/(o|ch|sh|ss|x)es$/.test(token)) return token.slice(0, -2);
  if (/(ss|us|is|ous|as)$/.test(token)) return token;
  if (/s$/.test(token)) return token.slice(0, -1);
  return token;
}

/** "Easy Chicken Biryani Recipe!" → "chicken biryani" */
export function normaliseDishName(raw: string): string {
  return stripDiacritics(raw ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !FILLER.has(word))
    .map(singularise)
    .join(" ")
    .trim();
}

export function dedupeKey(rawTitle: string): string {
  const normalised = normaliseDishName(rawTitle) || (rawTitle ?? "").trim().toLowerCase();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 40);
}

export function tokens(normalised: string): string[] {
  return normalised.split(/\s+/).filter(Boolean);
}

/**
 * Are these the same dish? Used to answer "does this recipe already exist
 * internally?" before spending a web import.
 */
export function isSameDish(a: string, b: string): boolean {
  const na = normaliseDishName(a);
  const nb = normaliseDishName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = new Set(tokens(na));
  const tb = new Set(tokens(nb));
  if (ta.size === 0 || tb.size === 0) return false;

  // "chicken biryani" ⊂ "hyderabadi chicken biryani" → same family of dish
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  const contained = [...small].every((t) => big.has(t));
  if (contained) {
    // Guard against a single generic token ("cake", "chicken") claiming everything.
    const specific = [...small].filter((t) => !GENERIC_DISH_WORDS.has(t));
    if (specific.length >= 1 || small.size >= 2) return true;
  }

  const shared = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return shared / union >= 0.75;
}

const GENERIC_DISH_WORDS = new Set([
  "cake", "chicken", "beef", "rice", "bread", "soup", "salad", "curry", "pasta",
  "cookie", "pie", "smoothie", "sandwich", "burger", "sauce", "drink", "dessert",
]);

/** Ingredient identity for de-duplicating the shopping list. */
export function normaliseIngredient(raw: string): string {
  return stripDiacritics(raw ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !INGREDIENT_NOISE.has(w))
    .filter((w) => !/^\d+([.,]\d+)?$/.test(w))
    .map(singularise)
    .join(" ")
    .trim();
}

const INGREDIENT_NOISE = new Set([
  "fresh", "freshly", "finely", "chopped", "diced", "minced", "large", "small", "medium",
  "ripe", "of", "a", "an", "the", "optional", "to", "taste", "plus", "more", "for",
  "garnish", "serving", "room", "temperature", "cold", "warm", "hot", "organic",
]);

export function slugify(value: string): string {
  return normaliseDishName(value).replace(/\s+/g, "-") || "recipe";
}
