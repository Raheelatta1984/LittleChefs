import { formatQuantity } from "./scaling.js";
import { normaliseIngredient, stripDiacritics } from "./normalise.js";

export const AISLE_ORDER = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "pantry",
  "spices",
  "sauces",
  "frozen",
  "drinks",
  "other",
] as const;

export type Aisle = (typeof AISLE_ORDER)[number];

export const AISLE_META: Record<Aisle, { label: string; emoji: string }> = {
  produce: { label: "Fruit & Veg", emoji: "🥕" },
  meat: { label: "Meat & Poultry", emoji: "🍗" },
  seafood: { label: "Fish & Seafood", emoji: "🐟" },
  dairy: { label: "Dairy & Eggs", emoji: "🥛" },
  bakery: { label: "Bakery", emoji: "🍞" },
  pantry: { label: "Pantry & Dry Goods", emoji: "🫙" },
  spices: { label: "Spices & Herbs", emoji: "🌿" },
  sauces: { label: "Sauces & Oils", emoji: "🫒" },
  frozen: { label: "Frozen", emoji: "🧊" },
  drinks: { label: "Drinks", emoji: "🧃" },
  other: { label: "Other", emoji: "🧺" },
};

/**
 * Keyword → aisle. Longest matching keyword wins, so "soy sauce" (sauces)
 * beats "soy" and "bell pepper" (produce) beats "pepper" (spices).
 */
const AISLE_KEYWORDS: Array<[Aisle, string[]]> = [
  ["produce", [
    "onion", "garlic", "ginger", "tomato", "potato", "carrot", "capsicum", "bell pepper",
    "chilli", "chili", "green chilli", "coriander leaf", "cilantro", "mint", "parsley",
    "basil", "spinach", "lettuce", "cucumber", "lemon", "lime", "apple", "banana",
    "mango", "berry", "strawberry", "blueberry", "avocado", "broccoli", "cauliflower",
    "cabbage", "mushroom", "zucchini", "courgette", "eggplant", "aubergine", "pumpkin",
    "spring onion", "scallion", "leek", "celery", "beans", "peas", "corn", "sweet potato",
    "coriander leaf", "mint leaf", "basil leaf", "curry leaf", "parsley leaf",
    "fresh herb", "curry leaf", "shallot", "pear", "peach", "orange", "grape", "melon",
    "pineapple", "pomegranate", "dates", "raisin", "leaves", "mixed leaves", "salad",
    "rocket", "arugula", "kale", "silverbeet", "bok choy", "snow pea", "bean sprout",
  ]],
  ["meat", [
    "chicken", "beef", "lamb", "mutton", "pork", "turkey", "bacon", "sausage", "mince",
    "minced meat", "veal", "duck", "ham", "steak", "thigh", "breast", "drumstick",
    "keema", "pepperoni", "salami", "chorizo",
  ]],
  ["seafood", [
    "fish", "salmon", "tuna", "prawn", "shrimp", "crab", "lobster", "squid", "mussel",
    "clam", "oyster", "cod", "tilapia", "anchovy", "sardine", "seafood",
  ]],
  ["dairy", [
    "milk", "cream", "yogurt", "yoghurt", "curd", "butter", "cheese", "mozzarella",
    "parmesan", "cheddar", "egg", "paneer", "condensed milk", "evaporated milk",
    "sour cream", "mascarpone", "ricotta", "feta", "custard",
  ]],
  ["bakery", [
    "bread", "bun", "baguette", "pita", "tortilla", "naan", "puff pastry", "filo",
    "phyllo", "brioche", "croissant", "bagel", "wrap", "english muffin", "breadcrumb",
    "panko", "cake base", "sponge",
  ]],
  ["pantry", [
    "flour", "sugar", "rice", "basmati", "pasta", "spaghetti", "noodle", "lentil", "dal",
    "daal", "chickpea", "bean", "quinoa", "oats", "cereal", "baking powder",
    "baking soda", "bicarbonate", "yeast", "cocoa", "chocolate", "vanilla", "honey",
    "syrup", "cornflour", "cornstarch", "semolina", "gram flour", "besan", "tahini",
    "peanut butter", "almond", "cashew", "walnut", "pistachio", "nut", "seed", "gelatin",
    "stock cube", "bouillon", "desiccated coconut", "coconut", "food colour", "sprinkle",
  ]],
  ["spices", [
    "salt", "pepper", "cumin", "coriander", "turmeric", "paprika", "chilli powder",
    "chili powder", "garam masala", "masala", "cardamom", "cinnamon", "clove", "nutmeg",
    "bay leaf", "oregano", "thyme", "rosemary", "cumin seed", "mustard seed", "fennel",
    "star anise", "saffron", "fenugreek", "dried herb", "spice", "seasoning", "za'atar",
    "sumac", "allspice", "curry powder", "red chilli flake", "chili flake",
  ]],
  ["sauces", [
    "oil", "olive oil", "vegetable oil", "sesame oil", "vinegar", "soy sauce",
    "fish sauce", "ketchup", "mayonnaise", "mustard", "hot sauce", "sriracha",
    "tomato paste", "tomato puree", "passata", "stock", "broth", "worcestershire",
    "oyster sauce", "hoisin", "miso", "pesto", "salsa", "dressing", "lemon juice",
    "lime juice", "ghee", "coconut milk", "cream of coconut", "rose water",
    "orange blossom", "kewra", "essence", "extract", "jam", "chutney", "pickle", "ghee",
  ]],
  ["frozen", ["frozen", "ice cream", "ice", "puff pastry sheet", "frozen peas"]],
  ["drinks", ["water", "juice", "soda", "sparkling water", "tea", "coffee", "cola", "wine", "beer"]],
];

function keywordScore(item: string, keyword: string): number {
  const target = normaliseIngredient(item);
  const key = normaliseIngredient(keyword);
  if (!target || !key) return 0;
  if (target === key) return 1000 + key.length;
  const asWords = new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
  if (asWords.test(target)) {
    // A leading ingredient ("saffron ... in milk") beats a trailing mention.
    const leading = target.startsWith(key) ? 60 : 0;
    return 500 + key.length + leading;
  }
  if (target.includes(key)) return 100 + key.length;
  return 0;
}

export function aisleFor(item: string): Aisle {
  let best: { aisle: Aisle; score: number } = { aisle: "other", score: 0 };
  for (const [aisle, keywords] of AISLE_KEYWORDS) {
    for (const keyword of keywords) {
      const score = keywordScore(item, keyword);
      if (score > best.score) best = { aisle, score };
    }
  }
  return best.aisle;
}

export type ShoppingIngredient = {
  item: string;
  quantityText: string;
  quantity?: number | null;
  unit?: string | null;
  group?: string | null;
  scalable?: boolean;
};

export type ShoppingItem = {
  aisle: Aisle;
  item: string;
  quantityText: string;
  checked: boolean;
  alreadyAtHome: boolean;
  note: string | null;
};

export type ShoppingList = {
  items: ShoppingItem[];
  groups: Array<{ aisle: Aisle; label: string; emoji: string; items: ShoppingItem[] }>;
  totals: { toBuy: number; alreadyAtHome: number };
};

function pantryMatch(item: string, pantry: string[]): boolean {
  const target = normaliseIngredient(item);
  if (!target) return false;
  return pantry.some((entry) => {
    const p = normaliseIngredient(stripDiacritics(entry));
    if (!p) return false;
    return target === p || target.includes(p) || p.includes(target);
  });
}

/**
 * Builds one consolidated shopping list: de-duplicated by ingredient across
 * all recipe sections, quantities summed when the unit agrees, and grouped by
 * supermarket aisle in the order you actually walk the shop.
 */
export function buildShoppingList(
  ingredients: ShoppingIngredient[],
  options: { pantry?: string[]; checked?: Record<string, boolean> } = {},
): ShoppingList {
  const pantry = options.pantry ?? [];
  const merged = new Map<string, ShoppingItem & { numeric: number | null; unit: string | null }>();

  for (const ing of ingredients) {
    const key = `${aisleFor(ing.item)}::${normaliseIngredient(ing.item) || ing.item.toLowerCase()}`;
    const existing = merged.get(key);
    const numeric = typeof ing.quantity === "number" && Number.isFinite(ing.quantity) ? ing.quantity : null;
    const unit = (ing.unit ?? "").trim().toLowerCase() || null;

    if (!existing) {
      merged.set(key, {
        aisle: aisleFor(ing.item),
        item: ing.item.trim(),
        quantityText: ing.quantityText?.trim() ?? "",
        checked: false,
        alreadyAtHome: pantryMatch(ing.item, pantry),
        note: ing.group ?? null,
        numeric,
        unit,
      });
      continue;
    }

    if (existing.numeric !== null && numeric !== null && existing.unit === unit) {
      existing.numeric = Math.round((existing.numeric + numeric) * 1000) / 1000;
      existing.quantityText = formatQuantity(existing.numeric, unit);
    } else if (ing.quantityText) {
      existing.quantityText = existing.quantityText
        ? `${existing.quantityText} + ${ing.quantityText}`
        : ing.quantityText;
    }
    if (pantryMatch(ing.item, pantry)) existing.alreadyAtHome = true;
  }

  const items: ShoppingItem[] = [...merged.values()]
    .map(({ numeric: _numeric, unit: _unit, ...item }) => item)
    .map((item) => ({
      ...item,
      checked: Boolean(options.checked?.[`${item.aisle}::${item.item}`]),
    }))
    .sort((a, b) => {
      const aisleDiff = AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle);
      if (aisleDiff !== 0) return aisleDiff;
      return a.item.localeCompare(b.item);
    });

  const groups = AISLE_ORDER.map((aisle) => ({
    aisle,
    label: AISLE_META[aisle].label,
    emoji: AISLE_META[aisle].emoji,
    items: items.filter((i) => i.aisle === aisle),
  })).filter((group) => group.items.length > 0);

  return {
    items,
    groups,
    totals: {
      toBuy: items.filter((i) => !i.alreadyAtHome).length,
      alreadyAtHome: items.filter((i) => i.alreadyAtHome).length,
    },
  };
}
