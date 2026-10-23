import type { ContinentId } from "./topChefs";

// ---------------------------------------------------------------------------
// Famous chefs / cooking channels, grouped by region & country.
//
// Shown when the user taps "❌ Not This" on a wrong recipe: the app switches
// to AI Top-Chef mode and offers the top chefs for the dish's region/country
// as multiple numbered options (e.g. 1. Food Fusion 🇵🇰, 2. Ranveer Brar 🇮🇳).
//
// HONESTY RULES (same as topChefs.ts — see AGENT_BUILD_GUIDE.md §8):
//  • An in-app recipe is only ever "inspired by / in the style of" a chef.
//  • In-app videos ALWAYS come from a recipe's own TheMealDB `strYoutube` —
//    never claim a video is by one of these chefs.
//  • The website / YouTube buttons are SEARCHES for the dish on that chef's
//    own official site / channel ("Search Food Fusion for 'Biryani'") — they
//    never promise that chef has that exact recipe.
// ---------------------------------------------------------------------------

export type ChefRegionId =
  | "all"
  | "south-asia"
  | "pakistan"
  | "india"
  | "east-asia"
  | "europe"
  | "middle-east-africa"
  | "americas"
  | "australia"
  | "baking";

export const CHEF_REGIONS: { id: ChefRegionId; label: string }[] = [
  { id: "all", label: "🌍 All Top Chefs" },
  { id: "south-asia", label: "🍛 South Asia" },
  { id: "pakistan", label: "🇵🇰 Pakistan" },
  { id: "india", label: "🇮🇳 India" },
  { id: "east-asia", label: "🥢 East & SE Asia" },
  { id: "europe", label: "🇮🇹 Europe" },
  { id: "middle-east-africa", label: "🧆 Middle East & Africa" },
  { id: "americas", label: "🌎 Americas" },
  { id: "australia", label: "🇦🇺 Australia" },
  { id: "baking", label: "🍰 Baking & Desserts" },
];

export type FamousChef = {
  id: string;
  name: string;
  /** Cuisine country shown on the card, e.g. "Pakistan" */
  countryLabel: string;
  flag: string;
  emoji: string;
  regions: Exclude<ChefRegionId, "all">[];
  continent?: Exclude<ContinentId, "all">;
  /** TheMealDB `strArea` values to prefer when picking an in-app version. */
  cuisines: string[];
  specialty: string;
  /** Rough popularity, used only to order equally-relevant chefs. */
  fame: number;
  /** Official website domain (used for a site-search when no template). */
  websiteDomain?: string;
  /** Native search URL on the chef's own site; `{query}` is replaced. */
  websiteSearchTemplate?: string;
  /** Channel name used for the YouTube search. */
  youtubeSearchName: string;
  /** Dishes this chef is especially known for (relevance scoring only). */
  dishKeywords: string[];
};

export const FAMOUS_CHEFS: FamousChef[] = [
  // --- South Asia: Pakistan 🇵🇰 ---
  {
    id: "food-fusion",
    name: "Food Fusion",
    countryLabel: "Pakistan",
    flag: "🇵🇰",
    emoji: "🍳",
    regions: ["south-asia", "pakistan"],
    continent: "asia",
    cuisines: ["Pakistani"],
    specialty: "Pakistan's favourite cooking channel — everyday desi & fusion recipes",
    fame: 10,
    websiteDomain: "foodfusion.com",
    websiteSearchTemplate: "https://www.foodfusion.com/?s={query}",
    youtubeSearchName: "Food Fusion",
    dishKeywords: ["biryani", "nihari", "karahi", "haleem", "pulao", "kabab", "kebab", "samosa", "daal", "dal", "handi", "qorma", "korma", "pakistani"],
  },
  {
    id: "sooper-chef",
    name: "SooperChef",
    countryLabel: "Pakistan",
    flag: "🇵🇰",
    emoji: "👨‍🍳",
    regions: ["south-asia", "pakistan"],
    continent: "asia",
    cuisines: ["Pakistani"],
    specialty: "Pakistani recipes in Urdu & English with step-by-step videos",
    fame: 8,
    websiteDomain: "sooperchef.pk",
    websiteSearchTemplate: "https://www.sooperchef.pk/?s={query}",
    youtubeSearchName: "SooperChef",
    dishKeywords: ["biryani", "karahi", "kabab", "pulao", "daal", "pakistani"],
  },
  {
    id: "kun-foods",
    name: "Kun Foods",
    countryLabel: "Pakistan",
    flag: "🇵🇰",
    emoji: "🍖",
    regions: ["south-asia", "pakistan"],
    continent: "asia",
    cuisines: ["Pakistani"],
    specialty: "Famous for mutton, BBQ & traditional Pakistani meat dishes",
    fame: 7,
    youtubeSearchName: "Kun Foods",
    dishKeywords: ["mutton", "nihari", "pulao", "kabab", "kebab", "bbq", "karahi"],
  },
  // --- South Asia: India 🇮🇳 ---
  {
    id: "Ranveer Brar",
    name: "Ranveer Brar",
    countryLabel: "India",
    flag: "🇮🇳",
    emoji: "👨‍🍳",
    regions: ["south-asia", "india"],
    continent: "asia",
    cuisines: ["Indian"],
    specialty: "MasterChef India judge — iconic Indian recipes with the story behind them",
    fame: 10,
    websiteDomain: "ranveerbrar.com",
    websiteSearchTemplate: "https://ranveerbrar.com/?s={query}",
    youtubeSearchName: "Chef Ranveer Brar",
    dishKeywords: ["biryani", "butter chicken", "paneer", "curry", "masala", "dosa", "chole", "indian"],
  },
  {
    id: "sanjeev-kapoor",
    name: "Sanjeev Kapoor Khazana",
    countryLabel: "India",
    flag: "🇮🇳",
    emoji: "🍛",
    regions: ["south-asia", "india"],
    continent: "asia",
    cuisines: ["Indian"],
    specialty: "India's best-known chef — a huge library of classic Indian recipes",
    fame: 9,
    websiteDomain: "sanjeevkapoor.com",
    youtubeSearchName: "Sanjeev Kapoor Khazana",
    dishKeywords: ["curry", "paneer", "biryani", "masala", "indian"],
  },
  {
    id: "hebbars-kitchen",
    name: "Hebbars Kitchen",
    countryLabel: "India",
    flag: "🇮🇳",
    emoji: "🥞",
    regions: ["south-asia", "india", "baking"],
    continent: "asia",
    cuisines: ["Indian"],
    specialty: "Super-clear Indian vegetarian recipes & eggless bakes",
    fame: 9,
    websiteDomain: "hebbarskitchen.com",
    websiteSearchTemplate: "https://hebbarskitchen.com/?s={query}",
    youtubeSearchName: "Hebbars Kitchen",
    dishKeywords: ["dosa", "idli", "paneer", "eggless", "cake", "curry", "indian"],
  },
  {
    id: "your-food-lab",
    name: "Your Food Lab",
    countryLabel: "India",
    flag: "🇮🇳",
    emoji: "🧪",
    regions: ["south-asia", "india"],
    continent: "asia",
    cuisines: ["Indian"],
    specialty: "Sanjyot Keer's restaurant-style Indian recipes, tested in his food lab",
    fame: 8,
    youtubeSearchName: "Your Food Lab",
    dishKeywords: ["biryani", "butter chicken", "paneer", "street food", "indian"],
  },
  // --- Europe ---
  {
    id: "Jamie-Oliver",
    name: "Jamie Oliver",
    countryLabel: "UK",
    flag: "🇬🇧",
    emoji: "🥗",
    regions: ["europe"],
    continent: "europe",
    cuisines: ["British", "Italian"],
    specialty: "Easy, family-friendly British & Italian cooking",
    fame: 10,
    websiteDomain: "jamieoliver.com",
    youtubeSearchName: "Jamie Oliver",
    dishKeywords: ["pasta", "pizza", "roast", "pie", "salad"],
  },
  {
    id: "Gordon-Ramsay",
    name: "Gordon Ramsay",
    countryLabel: "UK",
    flag: "🇬🇧",
    emoji: "⭐",
    regions: ["europe"],
    continent: "europe",
    cuisines: ["British", "French"],
    specialty: "Michelin-star British & French classics made at home",
    fame: 10,
    websiteDomain: "gordonramsay.com",
    youtubeSearchName: "Gordon Ramsay",
    dishKeywords: ["beef wellington", "pie", "roast", "scrambled eggs", "burger"],
  },
  {
    id: "giallozafferano",
    name: "GialloZafferano",
    countryLabel: "Italy",
    flag: "🇮🇹",
    emoji: "🍝",
    regions: ["europe"],
    continent: "europe",
    cuisines: ["Italian"],
    specialty: "Italy's biggest recipe site — authentic Italian home cooking",
    fame: 8,
    websiteDomain: "giallozafferano.com",
    youtubeSearchName: "GialloZafferano",
    dishKeywords: ["pasta", "pizza", "risotto", "lasagna", "tiramisu", "italian"],
  },
  {
    id: "vincenzos-plate",
    name: "Vincenzo's Plate",
    countryLabel: "Italy",
    flag: "🇮🇹",
    emoji: "🍕",
    regions: ["europe", "australia"],
    continent: "europe",
    cuisines: ["Italian"],
    specialty: "Real Italian recipes explained step by step (based in Australia)",
    fame: 8,
    websiteDomain: "vincenzosplate.com",
    websiteSearchTemplate: "https://www.vincenzosplate.com/?s={query}",
    youtubeSearchName: "Vincenzo's Plate",
    dishKeywords: ["pasta", "pizza", "carbonara", "lasagna", "italian"],
  },
  {
    id: "spain-on-a-fork",
    name: "Spain on a Fork",
    countryLabel: "Spain",
    flag: "🇪🇸",
    emoji: "🥘",
    regions: ["europe"],
    continent: "europe",
    cuisines: ["Spanish"],
    specialty: "Authentic Spanish dishes — paella, tapas & more",
    fame: 7,
    websiteDomain: "spainonafork.com",
    websiteSearchTemplate: "https://spainonafork.com/?s={query}",
    youtubeSearchName: "Spain on a Fork",
    dishKeywords: ["paella", "tapas", "tortilla", "spanish"],
  },
  // --- East & Southeast Asia ---
  {
    id: "just-one-cookbook",
    name: "Just One Cookbook",
    countryLabel: "Japan",
    flag: "🇯🇵",
    emoji: "🍣",
    regions: ["east-asia"],
    continent: "asia",
    cuisines: ["Japanese"],
    specialty: "The go-to English site for Japanese home cooking",
    fame: 9,
    websiteDomain: "justonecookbook.com",
    websiteSearchTemplate: "https://www.justonecookbook.com/?s={query}",
    youtubeSearchName: "Just One Cookbook",
    dishKeywords: ["sushi", "ramen", "teriyaki", "miso", "japanese"],
  },
  {
    id: "Maangchi",
    name: "Maangchi",
    countryLabel: "Korea",
    flag: "🇰🇷",
    emoji: "🥘",
    regions: ["east-asia"],
    continent: "asia",
    cuisines: ["Korean"],
    specialty: "The queen of Korean cooking on YouTube",
    fame: 9,
    websiteDomain: "maangchi.com",
    websiteSearchTemplate: "https://www.maangchi.com/?s={query}",
    youtubeSearchName: "Maangchi",
    dishKeywords: ["kimchi", "bibimbap", "bulgogi", "korean", "tteokbokki"],
  },
  {
    id: "souped-up-recipes",
    name: "Souped Up Recipes",
    countryLabel: "China",
    flag: "🇨🇳",
    emoji: "🥟",
    regions: ["east-asia"],
    continent: "asia",
    cuisines: ["Chinese"],
    specialty: "Chinese home cooking & takeout favourites, explained clearly",
    fame: 8,
    websiteDomain: "soupeduprecipes.com",
    websiteSearchTemplate: "https://soupeduprecipes.com/?s={query}",
    youtubeSearchName: "Souped Up Recipes",
    dishKeywords: ["dumpling", "fried rice", "noodles", "stir fry", "chinese", "manchurian"],
  },
  {
    id: "marions-kitchen",
    name: "Marion's Kitchen",
    countryLabel: "Thai & Asian — Australia",
    flag: "🇹🇭",
    emoji: "🍜",
    regions: ["east-asia", "australia"],
    continent: "asia",
    cuisines: ["Thai", "Chinese", "Vietnamese"],
    specialty: "Marion Grasby's Thai & Asian favourites (made in Australia)",
    fame: 9,
    websiteDomain: "marionskitchen.com",
    websiteSearchTemplate: "https://www.marionskitchen.com/?s={query}",
    youtubeSearchName: "Marion's Kitchen",
    dishKeywords: ["pad thai", "curry", "noodles", "fried rice", "thai", "dumpling"],
  },
  // --- Middle East, Mediterranean & Africa ---
  {
    id: "refikas-kitchen",
    name: "Refika's Kitchen",
    countryLabel: "Türkiye",
    flag: "🇹🇷",
    emoji: "🧆",
    regions: ["middle-east-africa"],
    continent: "asia",
    cuisines: ["Turkish"],
    specialty: "Joyful Turkish & Middle Eastern home cooking",
    fame: 8,
    youtubeSearchName: "Refika's Kitchen",
    dishKeywords: ["kebab", "baklava", "turkish", "pide", "hummus"],
  },
  {
    id: "dimitras-dishes",
    name: "Dimitra's Dishes",
    countryLabel: "Greece / Mediterranean",
    flag: "🇬🇷",
    emoji: "🫒",
    regions: ["middle-east-africa", "europe"],
    continent: "europe",
    cuisines: ["Greek"],
    specialty: "Greek & Mediterranean family recipes",
    fame: 7,
    websiteDomain: "dimitrasdishes.com",
    websiteSearchTemplate: "https://www.dimitrasdishes.com/?s={query}",
    youtubeSearchName: "Dimitra's Dishes",
    dishKeywords: ["moussaka", "souvlaki", "greek", "baklava", "falafel", "shawarma", "mandi"],
  },
  {
    id: "sisi-yemmie",
    name: "Sisi Yemmie",
    countryLabel: "Nigeria",
    flag: "🇳🇬",
    emoji: "🍚",
    regions: ["middle-east-africa"],
    continent: "africa",
    cuisines: ["Nigerian"],
    specialty: "Nigerian family favourites — jollof and much more",
    fame: 7,
    websiteDomain: "sisiyemmie.com",
    websiteSearchTemplate: "https://www.sisiyemmie.com/?s={query}",
    youtubeSearchName: "Sisi Yemmie",
    dishKeywords: ["jollof", "nigerian", "fried rice", "stew"],
  },
  // --- Americas ---
  {
    id: "natashas-kitchen",
    name: "Natasha's Kitchen",
    countryLabel: "USA",
    flag: "🇺🇸",
    emoji: "🥧",
    regions: ["americas", "baking"],
    continent: "americas",
    cuisines: ["American"],
    specialty: "Family-tested American dinners & desserts that always work",
    fame: 9,
    websiteDomain: "natashaskitchen.com",
    websiteSearchTemplate: "https://natashaskitchen.com/?s={query}",
    youtubeSearchName: "Natashas Kitchen",
    dishKeywords: ["cake", "pie", "salmon", "chicken", "american"],
  },
  {
    id: "Joshua Weissman",
    name: "Joshua Weissman",
    countryLabel: "USA",
    flag: "🇺🇸",
    emoji: "🍔",
    regions: ["americas"],
    continent: "americas",
    cuisines: ["American"],
    specialty: "Famous for remaking fast-food & comfort food from scratch",
    fame: 9,
    websiteDomain: "joshuaweissman.com",
    youtubeSearchName: "Joshua Weissman",
    dishKeywords: ["burger", "fries", "pizza", "sandwich", "fast food"],
  },
  {
    id: "tasty",
    name: "Tasty",
    countryLabel: "USA",
    flag: "🇺🇸",
    emoji: "📱",
    regions: ["americas", "baking"],
    continent: "americas",
    cuisines: ["American", "Mexican"],
    specialty: "Quick, fun recipes from the world's biggest food video team",
    fame: 9,
    websiteDomain: "tasty.co",
    youtubeSearchName: "Tasty",
    dishKeywords: ["cake", "cookies", "pasta", "snack"],
  },
  {
    id: "pati-jinich",
    name: "Pati Jinich",
    countryLabel: "Mexico",
    flag: "🇲🇽",
    emoji: "🌮",
    regions: ["americas"],
    continent: "americas",
    cuisines: ["Mexican"],
    specialty: "Authentic Mexican cooking from 'Pati's Mexican Table'",
    fame: 8,
    websiteDomain: "patijinich.com",
    websiteSearchTemplate: "https://patijinich.com/?s={query}",
    youtubeSearchName: "Pati Jinich",
    dishKeywords: ["taco", "burrito", "quesadilla", "salsa", "mexican", "nachos"],
  },
  // --- Australia & global ---
  {
    id: "harris-farm",
    name: "Harris Farm Markets",
    countryLabel: "Australia",
    flag: "🇦🇺",
    emoji: "🥑",
    regions: ["australia"],
    cuisines: ["Australian", "Italian", "Mediterranean", "Asian"],
    specialty: "Fresh seasonal recipes, roast dinners, pastas, salads & baking",
    fame: 8,
    websiteDomain: "harrisfarm.com.au",
    websiteSearchTemplate: "https://www.harrisfarm.com.au/search?q={query}&type=article,page",
    youtubeSearchName: "Harris Farm Markets",
    dishKeywords: ["chicken", "roast", "salad", "pasta", "soup", "tart", "potatoes", "steak", "mango"],
  },
  {
    id: "recipetin-eats",
    name: "RecipeTin Eats",
    countryLabel: "Australia",
    flag: "🇦🇺",
    emoji: "🐨",
    regions: ["australia"],
    cuisines: ["American", "Italian", "Thai", "Japanese", "Indian"],
    specialty: "sydney Nagi's hugely popular, always-reliable recipes",
    fame: 9,
    websiteDomain: "recipetineats.com",
    websiteSearchTemplate: "https://www.recipetineats.com/?s={query}",
    youtubeSearchName: "RecipeTin Eats",
    dishKeywords: ["roast", "curry", "pasta", "fried rice", "salad", "cake"],
  },
  // --- Baking & desserts ---
  {
    id: "cakes-by-mk",
    name: "Cakes by MK",
    countryLabel: "Baking — Global",
    flag: "🍰",
    emoji: "🧁",
    regions: ["baking"],
    cuisines: ["American"],
    specialty: "Soft, moist cakes & bakes (already loved inside this app!)",
    fame: 9,
    websiteDomain: "cakesbymk.com",
    websiteSearchTemplate: "https://cakesbymk.com/?s={query}",
    youtubeSearchName: "Cakes by MK",
    dishKeywords: ["cake", "cupcake", "red velvet", "chocolate cake", "vanilla cake", "loaf"],
  },
  {
    id: "preppy-kitchen",
    name: "Preppy Kitchen",
    countryLabel: "USA — Baking",
    flag: "🇺🇸",
    emoji: "🎂",
    regions: ["baking", "americas"],
    continent: "americas",
    cuisines: ["American", "French"],
    specialty: "John Kanell's joyful cakes, cookies & patisserie",
    fame: 9,
    websiteDomain: "preppykitchen.com",
    websiteSearchTemplate: "https://preppykitchen.com/?s={query}",
    youtubeSearchName: "Preppy Kitchen",
    dishKeywords: ["cake", "cookies", "cupcake", "soufflé", "souffle", "pie", "brownie"],
  },
];

/** Search for this dish on the chef's own official website. */
export function chefWebsiteSearchUrl(chef: FamousChef, dish: string): string | null {
  const q = dish.trim();
  if (!q) return null;
  if (chef.websiteSearchTemplate) {
    return chef.websiteSearchTemplate.replace("{query}", encodeURIComponent(q));
  }
  if (chef.websiteDomain) {
    // No known native search page — use a site-restricted search so the
    // button still finds that chef's own pages instead of guessing a URL.
    return `https://www.google.com/search?q=${encodeURIComponent(`site:${chef.websiteDomain} ${q} recipe`)}`;
  }
  return null;
}

/** Search YouTube for this chef's version of the dish. */
export function chefYouTubeSearchUrl(chef: FamousChef, dish: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${chef.youtubeSearchName} ${dish.trim()} recipe`)}`;
}

const BAKING_WORDS = ["cake", "cupcake", "brownie", "cookie", "muffin", "pancake", "waffle", "pie", "pudding", "dessert", "tres leches", "red velvet", "souffle", "soufflé"];
const PAKISTANI_WORDS = ["nihari", "haleem", "karahi", "chapli", "seekh", "pulao", "rooh afza", "lahori", "quetta", "sindhi"];
const INDIAN_WORDS = ["butter chicken", "paneer", "dosa", "idli", "chole", "samosa", "masala", "tandoori"];
const SOUTH_ASIA_WORDS = ["biryani", "kabab", "kebab", "daal", "dal", "curry", "handi", "korma", "qorma", "lassi", "chai"];
const EAST_ASIA_WORDS = ["sushi", "ramen", "teriyaki", "miso", "kimchi", "bibimbap", "bulgogi", "dumpling", "pad thai", "fried rice", "noodle", "manchurian"];
const EUROPE_WORDS = ["pasta", "pizza", "lasagna", "risotto", "spaghetti", "carbonara", "paella", "tiramisu", "ratatouille", "goulash"];
const AMERICAS_WORDS = ["burger", "taco", "burrito", "quesadilla", "nacho", "mac and cheese", "sandwich", "hot dog", "bbq ribs"];
const MIDDLE_EAST_AFRICA_WORDS = ["hummus", "falafel", "shawarma", "mandi", "kunafa", "baklava", "tagine", "jollof", "couscous"];

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

/**
 * Work out the most relevant chef region for a dish, using (in order) the
 * cuisine/country named in the dish, the cuisine the user picked, dish
 * keywords, then the continent they picked.
 */
export function detectChefRegion(
  dish: string,
  opts: { cuisine?: string; continent?: ContinentId } = {},
): ChefRegionId {
  const d = dish.toLowerCase();
  if (d.includes("pakistani")) return "pakistan";
  if (d.includes("indian")) return "india";

  switch (opts.cuisine) {
    case "Pakistani":
      return "pakistan";
    case "Indian":
      return "india";
    case "Italian":
    case "Spanish":
      return "europe";
    case "Japanese":
    case "Chinese":
      return "east-asia";
    case "American":
      return "americas";
    default:
      break;
  }

  if (includesAny(d, BAKING_WORDS)) return "baking";
  // Pakistani- and Indian-leaning dishes both open "South Asia" so the list
  // shows e.g. Food Fusion 🇵🇰 AND Ranveer Brar 🇮🇳 together, ranked.
  if (includesAny(d, PAKISTANI_WORDS) || includesAny(d, INDIAN_WORDS) || includesAny(d, SOUTH_ASIA_WORDS)) {
    return "south-asia";
  }
  if (includesAny(d, EAST_ASIA_WORDS)) return "east-asia";
  if (includesAny(d, MIDDLE_EAST_AFRICA_WORDS)) return "middle-east-africa";
  if (includesAny(d, EUROPE_WORDS)) return "europe";
  if (includesAny(d, AMERICAS_WORDS)) return "americas";

  switch (opts.continent) {
    case "asia":
      return "south-asia";
    case "europe":
      return "europe";
    case "americas":
      return "americas";
    case "africa":
      return "middle-east-africa";
    default:
      return "all";
  }
}

/** TheMealDB search filters that best match a chef region. */
export function regionSearchParams(region: ChefRegionId): { continent: ContinentId; cuisine: string } {
  switch (region) {
    case "pakistan":
      return { continent: "asia", cuisine: "Pakistani" };
    case "india":
      return { continent: "asia", cuisine: "Indian" };
    case "south-asia":
    case "east-asia":
      return { continent: "asia", cuisine: "Any" };
    case "europe":
      return { continent: "europe", cuisine: "Any" };
    case "americas":
      return { continent: "americas", cuisine: "Any" };
    default:
      // middle-east-africa spans TheMealDB "asia"+"africa" areas, and
      // australia/baking/all have no single TheMealDB area — search wide.
      return { continent: "all", cuisine: "Any" };
  }
}

export function chefRegionLabel(region: ChefRegionId): string {
  return CHEF_REGIONS.find((r) => r.id === region)?.label ?? "🌍 All Top Chefs";
}

/**
 * Rank the famous chefs for this dish, most relevant first. When a region
 * filter is chosen only chefs from that region/country are returned.
 */
export function getRankedChefs(
  dish: string,
  opts: { cuisine?: string; continent?: ContinentId; regionFilter?: ChefRegionId } = {},
): FamousChef[] {
  const d = dish.toLowerCase();
  const detected = detectChefRegion(dish, opts);
  const regionFilter = opts.regionFilter ?? "all";

  return FAMOUS_CHEFS.map((chef, index) => {
    let score = chef.fame;
    if (detected !== "all" && chef.regions.includes(detected)) score += 20;
    // The sister country still ranks highly for shared South Asian dishes,
    // so a Karachi-style search can still show Ranveer Brar (and vice versa).
    if ((detected === "pakistan" || detected === "india") && chef.regions.includes("south-asia")) score += 10;
    if (opts.cuisine && opts.cuisine !== "Any" && chef.cuisines.includes(opts.cuisine)) score += 25;
    if (opts.continent && opts.continent !== "all" && chef.continent === opts.continent) score += 8;
    for (const keyword of chef.dishKeywords) {
      if (d.includes(keyword)) score += 12;
    }
    return { chef, score, index };
  })
    .filter(({ chef }) => regionFilter === "all" || chef.regions.includes(regionFilter))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ chef }) => chef);
}
