export type WhatsNewCategory = "all" | "browser" | "onboarding" | "kitchen";

export type WhatsNewAction =
  | "open-browser"
  | "open-youtube-browser"
  | "open-importer"
  | "open-my-recipes"
  | "open-smart-finder"
  | "open-rewards";

export type WhatsNewItem = {
  id: string;
  version: string;
  date: string;
  badge: "NEW" | "UPDATED" | "CORE";
  category: Exclude<WhatsNewCategory, "all">;
  emoji: string;
  title: string;
  summary: string;
  highlights: string[];
  ctaLabel: string;
  action: WhatsNewAction;
};

export const LATEST_WHATS_NEW_VERSION = "3.2";
export const WHATS_NEW_STORAGE_KEY = "chefUniverseWhatsNewSeen";

export function hasUnseenWhatsNew(): boolean {
  try {
    return localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== LATEST_WHATS_NEW_VERSION;
  } catch {
    return false;
  }
}

export function markWhatsNewSeen(): void {
  try {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, LATEST_WHATS_NEW_VERSION);
  } catch {
    // storage unavailable
  }
}

export const WHATS_NEW_CATEGORIES: Array<{ id: WhatsNewCategory; label: string; emoji: string }> = [
  { id: "all", label: "All Updates", emoji: "✨" },
  { id: "browser", label: "In-App Browser", emoji: "🌐" },
  { id: "onboarding", label: "AI Onboarding", emoji: "🤖" },
  { id: "kitchen", label: "Kitchen & Rewards", emoji: "🔐" },
];

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    id: "in-app-website-browser",
    version: "v3.2",
    date: "Oct 2026",
    badge: "NEW",
    category: "browser",
    emoji: "🌐",
    title: "In-App Chef Website Browser — Never Leave the App!",
    summary:
      "Search and browse famous chef websites (Food Fusion, Ranveer Brar, Cakes by MK & more) right inside Chef Universe without opening an external browser.",
    highlights: [
      "Every chef website & search link now opens inside our safe Internal Browser instead of redirecting you out of the app.",
      "Switch between clean Recipe Picker Cards and a sandboxed Live Website View where clicking any link stays inside the app.",
      "Once you pick the exact recipe you want, tap one button to import the complete recipe with AI-Powered Onboarding.",
    ],
    ctaLabel: "🌐 Browse Chef Websites Inside App",
    action: "open-browser",
  },
  {
    id: "in-app-youtube-explorer",
    version: "v3.2",
    date: "Oct 2026",
    badge: "NEW",
    category: "browser",
    emoji: "📺",
    title: "In-App YouTube Channel & Video Recipe Onboarding",
    summary:
      "Explore cooking channels and YouTube recipe searches inside the app, watch videos to verify the right dish, and import the full recipe in one tap.",
    highlights: [
      "Search any dish or famous YouTube chef channel directly inside the YouTube tab of the Internal Browser.",
      "Watch cooking tutorials in-app via privacy-enhanced embeds before committing to cook.",
      "Reads video descriptions, captions & AI recipe mapping so your chosen video becomes a step-by-step recipe with ingredients & photos.",
    ],
    ctaLabel: "📺 Explore YouTube Recipes In-App",
    action: "open-youtube-browser",
  },
  {
    id: "ai-powered-onboarding",
    version: "v3.2",
    date: "Oct 2026",
    badge: "UPDATED",
    category: "onboarding",
    emoji: "🤖",
    title: "1-Tap Complete Recipe Import → AI Prep & Shopping List",
    summary:
      "Available for every chef! Import any recipe from the Internal Browser, paste a link, or paste recipe notes — then scale portions & generate your shopping list.",
    highlights: [
      "Maps ingredients (quantities, kitchen units, prep notes), ordered steps (timers, oven temperatures, photos) and source credit.",
      "AI Onboarding Interview asks how many people are eating, the meal occasion (Breakfast, Lunch, Dinner, Late-night snack), allergies & pantry items.",
      "Automatically rescales every ingredient with kitchen-friendly fractions and builds an aisle-grouped, tickable shopping list.",
    ],
    ctaLabel: "🤖 Start AI Recipe Onboarding",
    action: "open-importer",
  },
  {
    id: "private-role-kitchens",
    version: "v3.1",
    date: "Oct 2026",
    badge: "CORE",
    category: "kitchen",
    emoji: "🔐",
    title: "Private Role-Scoped Recipe Books & Instant Shared Catalogue",
    summary:
      "Every Junior, Teen, Adult and Master Chef gets a private PostgreSQL recipe book protected by Row-Level Security.",
    highlights: [
      "Only you can view, edit, cook or delete recipes in your private recipe book — enforced in the database.",
      "Internal-first search checks your own book and the shared canonical catalogue before importing from the web.",
      "Optional 4-digit secret PIN keeps siblings' and parents' recipe books separate on shared family devices.",
    ],
    ctaLabel: "📖 Open My Recipe Book",
    action: "open-my-recipes",
  },
  {
    id: "ai-top-chefs-and-rewards",
    version: "v3.0",
    date: "Oct 2026",
    badge: "CORE",
    category: "kitchen",
    emoji: "🔮",
    title: "AI Top-Chef Finder, Fair-Play Cooking & Rewards Studio",
    summary:
      "Tap 'Not This' on any recipe to discover famous regional chefs, cook step-by-step with voice readout, and earn points honestly.",
    highlights: [
      "Regional Top-Chef suggestions across Pakistan, India, Europe, East Asia, Middle East, Americas & Australia.",
      "Interactive cooking timers, Read-It-To-Me voice assistant, 6-second fair-play step timer & honesty pledge.",
      "Spend earned ⭐ points in the Rewards Shop to decorate your Living Room and customize your AI Chef Buddy.",
    ],
    ctaLabel: "🔮 Try AI Smart Recipe Search",
    action: "open-smart-finder",
  },
];
