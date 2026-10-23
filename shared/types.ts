/** Types shared by the API server and the React app. */

export type RoleId = "junior" | "teen" | "adult" | "master";

export const ROLE_ORDER: RoleId[] = ["junior", "teen", "adult", "master"];

export type MealOccasion = "breakfast" | "lunch" | "dinner" | "late-night-snack";

export const MEAL_OCCASIONS: Array<{ id: MealOccasion; label: string; emoji: string; hint: string }> = [
  { id: "breakfast", label: "Breakfast", emoji: "🌅", hint: "Lighter portions, quick prep" },
  { id: "lunch", label: "Lunch", emoji: "☀️", hint: "Mid-day energy" },
  { id: "dinner", label: "Dinner", emoji: "🌙", hint: "Main meal of the day" },
  { id: "late-night-snack", label: "Late-night snack", emoji: "🌜", hint: "Small, easy portions" },
];

export type Difficulty = "Super Easy" | "Easy" | "A Little Tricky" | string;

export type Role = {
  id: RoleId;
  label: string;
  ages: string;
  emoji: string;
  rank: number;
  description: string;
  canPublish: boolean;
  requiresGrownup: boolean;
  maxBatchServings: number;
};

export type ChefProfile = {
  id: string;
  displayName: string;
  role: RoleId;
  roleLabel: string;
  roleEmoji: string;
  avatar: string | null;
  points: number;
  canPublish: boolean;
  requiresGrownup: boolean;
  maxBatchServings: number;
};

export type Ingredient = {
  id?: string;
  position: number;
  quantity: number | null;
  unit: string | null;
  item: string;
  prepNote: string | null;
  groupName: string | null;
  scalable: boolean;
  rawText: string | null;
  /** Present after portion scaling. */
  quantityText?: string;
  scaled?: number | null;
  note?: string | null;
};

export type Step = {
  id?: string;
  position: number;
  instruction: string;
  durationSeconds: number | null;
  temperatureC: number | null;
  imageUrl: string | null;
  tip: string | null;
};

export type RecipeDraft = {
  title: string;
  cuisine: string | null;
  description: string | null;
  difficulty: Difficulty | null;
  baseServings: number;
  totalMinutes: number | null;
  heroImageUrl: string | null;
  sourceType: "builtin" | "web" | "youtube" | "manual" | "ai";
  sourceUrl: string | null;
  sourceVideoId: string | null;
  sourceChannel: string | null;
  sourceAuthor: string | null;
  ingredients: Ingredient[];
  steps: Step[];
};

export type RecipeView = RecipeDraft & {
  id: string;
  catalogueId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Always true for the private book — the API never returns another chef's recipe. */
  ownedByMe: boolean;
  claimedFromCatalogue: boolean;
};

export type OnboardingAnswers = {
  servings: number;
  mealOccasion: MealOccasion;
  dietary?: string[];
  pantry?: string[];
};

export type ShoppingItemView = {
  id?: string;
  aisle: string;
  aisleLabel?: string;
  item: string;
  quantityText: string;
  checked: boolean;
  alreadyAtHome: boolean;
  note: string | null;
};

export type ShoppingListView = {
  id: string;
  chefRecipeId: string;
  servings: number;
  mealOccasion: MealOccasion;
  status: "draft" | "shopping" | "complete";
  groups: Array<{ aisle: string; label: string; emoji: string; items: ShoppingItemView[] }>;
  items: ShoppingItemView[];
  totals: { toBuy: number; alreadyAtHome: number };
  createdAt: string;
};

export type OnboardingResult = {
  sessionId: string;
  recipeId: string;
  recipeTitle: string;
  servings: number;
  baseServings: number;
  scaleFactor: number;
  mealOccasion: MealOccasion;
  mealHint: string;
  portionNote: string;
  ingredients: Ingredient[];
  steps: Step[];
  shoppingList: ShoppingListView;
  reminders: string[];
};

export type InternalMatch = {
  source: "my-recipes" | "shared-catalogue";
  recipeId?: string;
  catalogueId?: string;
  title: string;
  cuisine: string | null;
  heroImageUrl: string | null;
  baseServings: number;
  totalMinutes: number | null;
  ingredientCount: number;
  stepCount: number;
};

export type SearchResponse = {
  query: string;
  normalisedQuery: string;
  /** Own recipes always come first and are marked as such. */
  myRecipes: InternalMatch[];
  /** Canonical content that any chef can claim. Never reveals who imported it. */
  sharedMatches: InternalMatch[];
  /** True when the app should offer AI onboarding instead of a search result. */
  needsOnboarding: boolean;
  message: string;
};

export type ImportJobView = {
  id: string;
  status: "pending" | "running" | "review" | "saved" | "failed";
  inputType: "url" | "youtube" | "text" | "dish";
  inputValue: string;
  method: string | null;
  confidence: number | null;
  errorMessage: string | null;
  warnings: string[];
  draft: RecipeDraft | null;
  chefRecipeId: string | null;
  createdAt: string;
};

export type BrowserRecipeCard = {
  url: string;
  title: string;
  snippet: string | null;
  imageUrl: string | null;
  siteName: string | null;
  isLikelyRecipe: boolean;
};

export type BrowserYouTubeVideo = {
  videoId: string;
  watchUrl: string;
  title: string;
  channel: string | null;
  duration: string | null;
  publishedText: string | null;
  viewCountText: string | null;
  descriptionSnippet: string | null;
  thumbnailUrl: string;
};

export type BrowserPageResponse = {
  kind: "website" | "youtube-search" | "youtube-video";
  url: string;
  title: string;
  siteName: string | null;
  description: string | null;
  heroImageUrl: string | null;
  /** Sanitized HTML ready for sandboxed srcDoc preview with link-click interception. */
  sanitizedHtml: string | null;
  /** Recipe/article cards extracted from listing or search pages. */
  links: BrowserRecipeCard[];
  /** YouTube video cards extracted from search or channel pages. */
  videos: BrowserYouTubeVideo[];
  /** Full metadata when viewing an individual YouTube video. */
  activeVideo: (BrowserYouTubeVideo & { description: string }) | null;
  /** Non-null when the loaded page or video already holds a structured recipe. */
  detectedRecipe: RecipeDraft | null;
  detectedMethod: string | null;
  detectedConfidence: number | null;
};

export type ApiErrorBody = { error: string; message: string; details?: unknown };
