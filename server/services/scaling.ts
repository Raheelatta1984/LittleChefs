/**
 * Portion scaling: `servings / base_servings` applied to every ingredient with
 * human-friendly rounding so a junior chef never reads "0.6666667 cups".
 */

export type IngredientInput = {
  id?: string;
  position?: number;
  quantity: number | string | null;
  unit: string | null;
  item: string;
  prepNote?: string | null;
  groupName?: string | null;
  scalable?: boolean;
  rawText?: string | null;
};

export type ScaledIngredient = IngredientInput & {
  quantity: number | null;
  quantityText: string;
  scaled: number | null;
  scalable: boolean;
  note: string | null;
};

const FRACTION_UNITS = new Set([
  "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons",
]);
const MASS_UNITS = new Set(["g", "gram", "grams", "kg", "kilogram", "kilograms", "mg"]);
const VOLUME_UNITS = new Set(["ml", "millilitre", "milliliter", "l", "litre", "liter", "litres", "liters"]);
const COUNT_UNITS = new Set([
  "piece", "pieces", "pc", "pcs", "egg", "eggs", "clove", "cloves", "slice", "slices",
  "can", "cans", "tin", "tins", "bunch", "bunches", "sprig", "sprigs", "pinch", "pinches",
  "packet", "packets", "sheet", "sheets", "stalk", "stalks", "head", "heads", "leaves",
  "drop", "drops", "scoop", "scoops", "handful", "handfuls",
]);
const NON_SCALABLE_UNITS = new Set(["pinch", "dash", "to taste", "as needed", "for garnish"]);

const FRACTIONS: Array<[number, string]> = [
  [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
];

/** Parses "1 1/2", "1/2", "1,5", "½", "2-3" (takes the lower bound). */
export function parseQuantity(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let text = String(raw).trim().replace(/,/g, ".");
  if (!text) return null;

  for (const [value, glyph] of FRACTIONS) {
    if (text.includes(glyph)) {
      const whole = Number(text.replace(glyph, "").trim() || 0);
      return (Number.isFinite(whole) ? whole : 0) + value;
    }
  }

  const range = text.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)$/i);
  if (range) return Number(range[1]);

  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  const number = text.match(/^[~≈]?\s*(\d+(?:\.\d+)?)/);
  if (number) return Number(number[1]);

  text = text.replace(/[^0-9.]/g, "");
  const fallback = Number(text);
  return Number.isFinite(fallback) && text !== "" ? fallback : null;
}

function roundTo(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  return Math.round(rounded * 1000) / 1000;
}

export function friendlyRound(value: number, unit: string | null): number {
  const u = (unit ?? "").toLowerCase().trim();
  if (value <= 0) return 0;
  if (NON_SCALABLE_UNITS.has(u)) return value;
  if (FRACTION_UNITS.has(u)) return roundTo(value, u.startsWith("t") ? 0.25 : 0.25);
  if (MASS_UNITS.has(u) || VOLUME_UNITS.has(u)) {
    const metric = MASS_UNITS.has(u) && ["kg", "kilogram", "kilograms", "l", "litre", "liter", "litres", "liters"].includes(u);
    if (metric) return roundTo(value, 0.05);
    if (value < 1) return roundTo(value, 0.1);
    if (value < 10) return roundTo(value, 1);
    if (value < 100) return roundTo(value, 5);
    return roundTo(value, 10);
  }
  if (COUNT_UNITS.has(u)) {
    if (/^(pinch|dash|drop|handful)/.test(u)) return Math.max(1, Math.round(value));
    // eggs: never tell someone to use 1.5 eggs — round to the nearest whole egg
    if (/^(egg|eggs)$/.test(u)) return Math.max(1, Math.round(value));
    return roundTo(value, 0.5);
  }
  // No unit — treat as a count.
  if (value < 1) return roundTo(value, 0.25);
  if (value < 10) return roundTo(value, 0.5);
  return roundTo(value, 1);
}

export function formatQuantity(value: number | null, unit?: string | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  const whole = Math.floor(value + 1e-9);
  const rest = Math.round((value - whole) * 1000) / 1000;
  let text: string;

  if (rest < 0.02) {
    text = String(whole);
  } else {
    const match = FRACTIONS.reduce<{ diff: number; glyph: string } | null>((best, [v, glyph]) => {
      const diff = Math.abs(v - rest);
      if (diff > 0.045) return best;
      if (!best || diff < best.diff) return { diff, glyph };
      return best;
    }, null);
    if (match) text = whole > 0 ? `${whole}${match.glyph}` : match.glyph;
    else text = String(Math.round(value * 100) / 100);
  }

  const u = (unit ?? "").trim();
  if (!u) return text;
  // "1 cups" → "1 cup"
  const displayUnit =
    value <= 1 && /^[a-z]+s$/i.test(u) && !/(ss|us|is)$/i.test(u) ? u.slice(0, -1) : u;
  const needsSpace = !/^(g|kg|mg|ml|l)$/i.test(displayUnit);
  return needsSpace ? `${text} ${displayUnit}` : `${text}${displayUnit}`;
}

export function scaleIngredients(
  ingredients: IngredientInput[],
  factor: number,
  baseServings: number,
): ScaledIngredient[] {
  return ingredients.map((ing) => {
    const quantity = parseQuantity(ing.quantity);
    const rawUnit = (ing.unit ?? "").toLowerCase().trim();
    const isScalable =
      ing.scalable !== false &&
      quantity !== null &&
      !NON_SCALABLE_UNITS.has(rawUnit) &&
      !/to taste|as needed/i.test(ing.rawText ?? "");

    if (!isScalable || quantity === null) {
      return {
        ...ing,
        quantity,
        quantityText: quantity !== null ? formatQuantity(quantity, ing.unit) : "",
        scaled: quantity,
        scalable: false,
        note: factor !== 1 ? "Kept as is — season to taste" : null,
      };
    }

    const scaled = friendlyRound(quantity * factor, ing.unit);
    return {
      ...ing,
      quantity,
      quantityText: formatQuantity(scaled, ing.unit),
      scaled,
      scalable: true,
      note:
        factor !== 1
          ? `scaled from ${formatQuantity(quantity, ing.unit)} for ${baseServings}`
          : null,
    };
  });
}

/** e.g. 1.5x — used in UI copy. */
export function scaleFactorLabel(factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0) return "1×";
  const rounded = Math.round(factor * 100) / 100;
  return `${rounded}×`;
}
