import type { Recipe } from "../data/recipes";
import type { Ingredient, OnboardingResult, RecipeView } from "../../shared/types";

const EMOJI_RULES: Array<[RegExp, string]> = [
  [/biryani|pulao|mandi|rice/i, "🍛"],
  [/cake|cookie|brownie|cupcake|dessert|sweet|halwa/i, "🍰"],
  [/pizza/i, "🍕"],
  [/burger/i, "🍔"],
  [/pasta|spaghetti|lasagn|noodle|ramen/i, "🍝"],
  [/soup|shorba/i, "🍲"],
  [/salad/i, "🥗"],
  [/bread|naan|roti|paratha|toast/i, "🍞"],
  [/chicken|karahi|nihari|kebab|kabab|tikka/i, "🍗"],
  [/fish|salmon|prawn|shrimp/i, "🐟"],
  [/tea|chai|coffee/i, "☕"],
  [/juice|lassi|smoothie|shake/i, "🥤"],
  [/samosa|dumpling|spring roll/i, "🥟"],
  [/egg|omelette/i, "🍳"],
  [/pancake|waffle/i, "🥞"],
];

export function emojiFor(title: string): string {
  for (const [pattern, emoji] of EMOJI_RULES) {
    if (pattern.test(title)) return emoji;
  }
  return "🍽️";
}

export function difficultyOf(value: string | null | undefined): Recipe["difficulty"] {
  if (value === "Super Easy" || value === "Easy" || value === "A Little Tricky") return value;
  return "Easy";
}

export function ingredientLine(ingredient: Ingredient): string {
  const quantity = ingredient.quantityText?.trim() || "";
  const unit = quantity ? "" : "";
  const prep = ingredient.prepNote ? `, ${ingredient.prepNote}` : "";
  return `${quantity}${unit} ${ingredient.item}${prep}`.replace(/\s+/g, " ").trim();
}

/** Converts a database recipe (optionally scaled) into the shape the cooking screens expect. */
export function viewToLegacy(view: RecipeView, onboarding?: OnboardingResult): Recipe {
  const ingredients = onboarding?.ingredients ?? view.ingredients;
  const steps = (onboarding?.steps ?? view.steps).map((step) => step.instruction);

  return {
    name: view.title,
    emoji: emojiFor(view.title),
    time: view.totalMinutes ? `${view.totalMinutes} minutes` : "Take your time",
    difficulty: difficultyOf(view.difficulty),
    servings: onboarding
      ? `${onboarding.servings} ${onboarding.servings === 1 ? "person" : "people"}`
      : `${view.baseServings} ${view.baseServings === 1 ? "serving" : "servings"}`,
    ingredients: ingredients.map(ingredientLine),
    steps: steps.length > 0 ? steps : ["Enjoy your dish!"],
    tip: view.description ?? "Taste as you go and ask a grown-up for help with the hot bits!",
    image: view.heroImageUrl ?? undefined,
    youtubeVideo: view.sourceVideoId ?? undefined,
    source:
      view.sourceType === "youtube"
        ? `📺 ${view.sourceChannel ?? "YouTube"}${view.sourceAuthor ? ` · ${view.sourceAuthor}` : ""}`
        : view.sourceUrl
          ? `🌐 ${new URL(view.sourceUrl, "https://example.com").hostname.replace(/^www\./, "")}`
          : undefined,
    sourceUrl: view.sourceUrl ?? undefined,
  };
}
