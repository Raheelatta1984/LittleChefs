/**
 * Page-noise filtering for recipe imports.
 *
 * Real recipe pages are wrapped in a lot of furniture: nutrition panels,
 * star ratings, review widgets (with dates and internal tokens), "Print /
 * Save / Add to list" buttons, sponsored blocks, related-recipe carousels and
 * copyright footers. When a page has no usable schema.org block we read the
 * page text, and without filtering, all of that leaks into the ingredient
 * list and the cooking steps — e.g. `March 2021` became the ingredient
 * "March", `30.8g` became "g", and a review widget became a cooking step.
 *
 * Everything here is deterministic and offline: no AI key required.
 */

const MONTH_WORD =
  String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

const MONTH_ONLY = new RegExp(`^${MONTH_WORD}$`, "i");

/** Dates, times and timestamps — never ingredients, never steps. */
const DATE_PATTERNS: RegExp[] = [
  // 2024-03-12 or 2024-03-12T11:03:00+11:00
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/,
  // 12/03/2024 and 12.03.24
  /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/,
  // March 12, 2024 / Mar 12 2024
  new RegExp(String.raw`\b${MONTH_WORD}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b`, "i"),
  // 12 March 2024
  new RegExp(String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+${MONTH_WORD}\.?,?\s+\d{4}\b`, "i"),
  // March 2021 / Jun 2024 — the "month and year" that used to become an ingredient
  new RegExp(String.raw`\b${MONTH_WORD}\.?\s+\d{4}\b`, "i"),
  // 12 March
  new RegExp(String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+${MONTH_WORD}\b`, "i"),
  // 11:03 or 11:03 pm
  /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/i,
  // 2021-03 or 2021/03
  /\b(?:19|20)\d{2}[-/]\d{1,2}\b/,
];

/** True when a whole line is a date/time/timestamp (or a year on its own). */
export function isDateLikeLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  if (/^(?:19|20)\d{2}$/.test(text)) return true;
  return DATE_PATTERNS.some((pattern) => pattern.test(text));
}

/** "March" — used to reject a parsed item that is really a month name. */
export function isMonthWord(value: string): boolean {
  return MONTH_ONLY.test(value.trim().replace(/[.,:;]+$/, ""));
}

/** Nutrition panels: 30.8g, 1970kJ / 468Cal, 23% of daily energy intake, "Protein"… */
const NUTRITION_LABEL = new RegExp(
  String.raw`^(?:nutrition(?:al)?(?: information| info)?(?: per serving)?|per serving|per 100 ?g|serving size|energy|calories?|kilojoules?|protein|total fat|saturated fat|fat|trans fat|carbohydrates?|carbs?|sugars|fibre|fiber|sodium|cholesterol)$`,
  "i",
);
const NUTRITION_VALUE =
  /^[\s\d.,]*(?:g|mg|kg|kj|kcal|cal|calories|kilojoules?)\s*$/i;

export function isNutritionLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  if (NUTRITION_LABEL.test(text)) return true;
  if (NUTRITION_VALUE.test(text)) return true;
  if (/^\d+(?:[.,]\d+)?\s*kj\s*\/\s*\d+(?:[.,]\d+)?\s*(?:cal|kcal)/i.test(text)) return true;
  if (/^\d+(?:[.,]\d+)?\s*%/.test(text)) return true;
  return /\b(?:kilojoule|calorie|daily energy intake|daily intake|nutrition information|nutrition per serving)\b/i.test(
    text,
  );
}

/** Review widgets, cookie/legal footers, share bars and other site chrome. */
const PAGE_NOISE: RegExp[] = [
  /bvseo/i,
  /bvpage\s*\d*/i,
  /^loc_[a-z]{2}_[a-z]{2}\b/i,
  /^co_(?:hasreviews|noquestions)\b/i,
  /^cp_\d+\b/i,
  /\bvn_firebird\b/i,
  /was this (?:review )?helpful/i,
  /found this (?:review )?helpful/i,
  /submitted by our users/i,
  /not endorsed by/i,
  /your identity is kept private/i,
  /\bprivacy policy\b|\bterms (?:of use|and conditions)\b|\ball rights reserved\b/i,
  /©|\(c\)\s*(?:19|20)\d{2}|\bcopyright\b|\babn\s*[\d\s]{6,}/i,
  /\bfollow us\b|\bsubscribe\b|\bnewsletter\b|\bdownload the app\b|\bcontact us\b/i,
  /^https?:\/\/|^www\./i,
  /\bsame page link\b/i,
  /^(?:sponsored|advertisement|advertising)$/i,
];

/** Buttons and controls that sit around the recipe. */
const UI_ACTION_WORDS =
  /\b(?:print|print recipe|save recipe|save|add to list|add to cart|shop recipe|shop ingredients|copy text|copy|share this recipe|share|email|tweet|pin it|add to meal plan|jump to recipe|jump to video|read a review|read reviews|write a review|rate this recipe|rate|load more|show more|read more|see more|view all|sold out|in stock|out of stock)\b/gi;

const UI_LINE_PATTERNS: RegExp[] = [
  /^\d+\s+ingredients?$/i,
  /^\(\d+\)$/,
  /number of servings/i,
  /\bcost per serve\b/i,
  /difficulty level\s*:/i,
  /\b(?:preparation|prep|cook|total|baking) time is\b/i,
  /serve is for \d+ people/i,
  /\bout of 5 stars?\b/i,
  /\b\d+(?:\.\d+)?\s*(?:of|\/)\s*5\b/i,
  /^serves?\b.*\bpeople\b/i,
  /^(?:step|part)\s*\d+\s*(?:of|\/)\s*\d+$/i,
  /\bquantities above are a guide\b/i,
  /^[a-z ]{0,30}\s(?:m|mins?|minutes?|h|hrs?|hours?)$/i,
  /^\$\d+(?:\.\d+)?(?:\s*ea)?(?:\s*\$\d+.*)?$/i,
];

export function isUiChromeLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  if (UI_LINE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  const remainder = text.replace(UI_ACTION_WORDS, " ").replace(/[^a-z]/gi, "");
  return remainder.length < 3 && text.length > 2;
}

/** Any line that must never become an ingredient or a step. */
export function isPageNoiseLine(line: string): boolean {
  const text = line.trim();
  if (!text) return true;
  if (!/[a-z]/i.test(text) && !/\d/.test(text)) return true;
  if (isDateLikeLine(text)) return true;
  if (isNutritionLine(text)) return true;
  if (isUiChromeLine(text)) return true;
  if (PAGE_NOISE.some((pattern) => pattern.test(text))) return true;
  return false;
}

/**
 * Headings that end a recipe section. Everything after "Nutrition per
 * serving", "Reviews", "You might also like" … is page furniture, so the
 * ingredient/method scan stops there instead of swallowing it.
 */
const STOP_HEADING_EXACT =
  /^(?:nutrition(?:al)?(?: information| info)?(?: per serving)?|nutrition per serving|description|about(?: this recipe| the recipe)?|reviews?|ratings?|comments?|leave a (?:review|comment)|cost per serve|disclaimer|legal|notes?|chef'?s notes?|tips?|top tips|equipment|share(?: this(?: recipe)?)?|print(?: recipe)?|save(?: recipe)?|sponsored|advertisement|you (?:might|may) also like|related(?: recipes)?|more recipes|new recipes|similar recipes|featured recipes|recommended(?: for you)?|recipe source|source|products|shop ingredients|your cart)\s*:?\s*$/i;

const STOP_HEADING_PREFIX =
  /^(?:nutrition(?:al)?(?: information| info)?\b|you (?:might|may) also like\b|related recipes\b|more recipes\b|new recipes\b|similar recipes\b|featured recipes\b|cost per serve\b|disclaimer\b|reviews? and (?:recipe )?photos\b|ingredients for\b|shop (?:the )?(?:ingredients|recipe|products)\b|buy (?:the )?ingredients\b|products (?:for|in)\b|your cart\b|how would you like to shop\b|select a time\b|choose how you'd like to shop\b|find your local\b)/i;

export function isSectionStopHeading(line: string): boolean {
  const text = line.replace(/\*\*/g, "").trim();
  if (!text) return false;
  return STOP_HEADING_EXACT.test(text) || STOP_HEADING_PREFIX.test(text);
}

/**
 * Screen-reader/duplicate DOM copies appear as the same line twice:
 * "2 tsp extra virgin olive oil 2teaspoons extra virgin olive oil".
 * Keep the first copy (it uses the site's own short units).
 */
export function collapseRepeatedText(line: string): string {
  const text = line.replace(/\s+/g, " ").trim();
  if (text.length < 8) return text;

  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (!/\d/.test(text[i])) continue;
    if (i > 0 && /[a-z0-9]/i.test(text[i - 1])) continue;
    positions.push(i);
  }
  for (const start of positions.slice(1)) {
    const head = text.slice(0, start).trim();
    const tail = text.slice(start).trim();
    if (head.length < 4 || tail.length < 4) continue;
    if (sameRecipeText(head, tail)) return head;
  }
  // Whole-string duplication without a second quantity ("Salt to taste Salt to taste").
  const half = Math.floor(text.length / 2);
  for (const pivot of [text.indexOf(" ", half), text.lastIndexOf(" ", half)]) {
    if (pivot <= 0) continue;
    const head = text.slice(0, pivot).trim();
    const tail = text.slice(pivot).trim();
    if (head.length > 6 && sameRecipeText(head, tail)) return head;
  }
  return text;
}

const UNIT_ALIASES: Array<[RegExp, string]> = [
  [/(?<![a-z])teaspoons?(?![a-z])/gi, "tsp"],
  [/(?<![a-z])tsp(?![a-z])/gi, "tsp"],
  [/(?<![a-z])tablespoons?(?![a-z])/gi, "tbsp"],
  [/(?<![a-z])tbsps?(?![a-z])/gi, "tbsp"],
  [/(?<![a-z])tbs(?![a-z])/gi, "tbsp"],
  [/(?<![a-z])grams?(?![a-z])/gi, "g"],
  [/(?<![a-z])kilograms?(?![a-z])/gi, "kg"],
  [/(?<![a-z])millilit(?:re|er)s?(?![a-z])/gi, "ml"],
  [/(?<![a-z])lit(?:re|er)s?(?![a-z])/gi, "l"],
  [/(?<![a-z])cups?(?![a-z])/gi, "cup"],
  [/(?<![a-z])ounces?(?![a-z])/gi, "oz"],
  [/(?<![a-z])pounds?(?![a-z])/gi, "lb"],
  [/(?<![a-z])pieces?(?![a-z])/gi, "pieces"],
];

function normaliseForCompare(value: string): string {
  // Split "500grams" / "2teaspoons" into "500 grams" / "2 teaspoons" so both
  // copies of a screen-reader duplicate normalise to the same tokens.
  let text = value.toLowerCase().replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2");
  for (const [pattern, replacement] of UNIT_ALIASES) text = text.replace(pattern, replacement);
  return text.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function sameRecipeText(a: string, b: string): boolean {
  const left = normaliseForCompare(a);
  const right = normaliseForCompare(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftWords = left.split(" ");
  const rightWords = right.split(" ");
  const [shorter, longer] = leftWords.length <= rightWords.length ? [leftWords, rightWords] : [rightWords, leftWords];
  if (shorter.length < 3) return false;
  // "500g lean beef mince" vs "500grams lean beef mince, trimmed" — one copy
  // may carry an extra preparation note.
  return longer.slice(0, shorter.length).join(" ") === shorter.join(" ") && shorter.length / longer.length >= 0.6;
}

const PROSE_MARKERS =
  /\b(?:you|your|we|our|this recipe|discover|enjoy|perfect for|whether you|find out|learn how|welcome to)\b/i;

/**
 * Rejects paragraphs and captions that live near the ingredient list but are
 * not ingredients. Real ingredient lines are short, start with a quantity or
 * a food word, and rarely end in a full stop.
 */
export function isLikelyIngredientLine(line: string): boolean {
  const text = line.trim();
  if (text.length < 2 || text.length > 220) return false;
  if (isPageNoiseLine(text)) return false;
  if (!/[a-z]{2,}/i.test(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  const hasQuantity = /^(?:[\d½¼¾⅓⅔⅛]|\d+\s*\/)/.test(text) || /\s[\d½¼¾⅓⅔⅛][^a-z]{0,3}\s*[a-z]*$/i.test(text);

  if (words.length > 18) return false;
  if (!hasQuantity && words.length > 10) return false;
  if (!hasQuantity && /[.!?]$/.test(text) && words.length >= 6) return false;
  if (words.length >= 6 && PROSE_MARKERS.test(text)) return false;
  if (isSectionStopHeading(text)) return false;
  return true;
}

/**
 * Cuts review-widget/footer tokens that got glued onto the end of a step
 * ("… Serve with mixed leaves. bvseo_fps, prod_bvrr, vn_firebird_3.1.26").
 */
const INLINE_NOISE =
  /\s*(?:bvseo\w*|bvpage\s*\d*|loc_[a-z]{2}_[a-z]{2}\b|co_hasreviews\b|cp_\d+\b|vn_firebird\w*|©|copyright\b|all rights reserved\b)/i;

export function stripInlineNoise(text: string): string {
  const match = INLINE_NOISE.exec(text);
  if (match && match.index > 20) return text.slice(0, match.index).trim().replace(/[,;:\-–—]+$/, "").trim();
  return text;
}

/** Steps must read like instructions, not like footer or review text. */
export function isLikelyStepLine(line: string): boolean {
  const text = line.trim().replace(/^\s*(?:step|part)\s*\d+\s*(?:of|\/)\s*\d+\s*[:.-]?\s*/i, "");
  if (text.length < 15 || text.length > 1200) return false;
  if (isPageNoiseLine(text)) return false;
  if (isSectionStopHeading(text)) return false;
  if (NUTRITION_LABEL.test(text)) return false;
  if (/^(?:ingredients?|method|instructions?|directions?|steps?)\s*:?$/i.test(text)) return false;
  return /[a-z]{3,}/i.test(text);
}
