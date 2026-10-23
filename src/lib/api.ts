import type {
  BrowserPageResponse, ChefProfile, ImportJobView, OcrImportResponse, OnboardingAnswers, OnboardingResult,
  RecipeDraft, RecipeView, Role, SearchResponse, ShoppingListView,
} from "../../shared/types";

// `import.meta.env` only exists under Vite; this keeps the module importable in
// Node (render tests / SSR) without a bundler.
const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const BASE = viteEnv.VITE_API_URL ?? "/api";
const STORAGE_KEY = "chefUniverseAuth";

export type AuthState = { token: string; chef: ChefProfile };

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.token || !parsed.chef) return null;
    return { token: parsed.token, chef: parsed.chef as ChefProfile };
  } catch {
    return null;
  }
}

export function saveAuth(auth: AuthState | null): void {
  try {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(
      0,
      "The recipe kitchen server is not running. Start it with `npm run dev:api`, then try again.",
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const body = payload as { message?: string; details?: unknown } | null;
    // A non-JSON error means the request never reached our API (e.g. a static
    // deployment with no /api functions) — say so plainly instead of the old
    // mysterious "Something went wrong (404).".
    const fallback =
      response.status === 404
        ? "We couldn't reach the recipe kitchen server (404). The app's server may not be running or deployed yet — ask a grown-up to start it (`npm run dev:api`), then try again."
        : response.status >= 500
          ? "The recipe kitchen server hiccupped. Wait a few seconds and try again."
          : `Something went wrong (${response.status}). Please try again.`;
    throw new ApiClientError(response.status, body?.message ?? fallback, body?.details);
  }
  return payload as T;
}

export const api = {
  base: BASE,

  health: () => request<{ ok: boolean; driver: string; llm: boolean }>("/health"),

  roles: () => request<{ roles: Role[] }>("/roles").then((r) => r.roles),

  createChef: (body: { displayName: string; role: string; avatar?: string | null; pin?: string | null }) =>
    request<AuthState>("/chefs", { method: "POST", body }),

  signIn: (body: { displayName: string; role: string; pin?: string | null }) =>
    request<AuthState>("/chefs/sign-in", { method: "POST", body }),

  signOut: (token: string) => request<{ ok: boolean }>("/chefs/sign-out", { method: "POST", token }),

  me: (token: string) => request<{ chef: ChefProfile }>("/me", { token }).then((r) => r.chef),

  search: (token: string, query: string) =>
    request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, { token }),

  listRecipes: (token: string) =>
    request<{ recipes: RecipeView[] }>("/recipes", { token }).then((r) => r.recipes),

  getRecipe: (token: string, id: string) =>
    request<{ recipe: RecipeView }>(`/recipes/${id}`, { token }).then((r) => r.recipe),

  saveRecipe: (token: string, draft: RecipeDraft, notes?: string | null) =>
    request<{ recipe: RecipeView }>("/recipes", { method: "POST", token, body: { ...draft, notes } }).then(
      (r) => r.recipe,
    ),

  deleteRecipe: (token: string, id: string) =>
    request<{ ok: boolean }>(`/recipes/${id}`, { method: "DELETE", token }),

  claim: (token: string, catalogueId: string) =>
    request<{ recipe: RecipeView; alreadyOwned: boolean }>(`/catalogue/${catalogueId}/claim`, {
      method: "POST",
      token,
    }),

  startImport: (
    token: string,
    inputValue: string,
    options?: { allowAiFallback?: boolean; draftHint?: RecipeDraft | null },
  ) =>
    request<{ job: ImportJobView }>("/imports", {
      method: "POST",
      token,
      body: {
        inputValue,
        ...(options?.allowAiFallback ? { allowAiFallback: true } : {}),
        ...(options?.draftHint ? { draftHint: options.draftHint } : {}),
      },
    }).then((r) => r.job),

  /** 📷 Scan a recipe photo/screenshot with OCR → same AI-onboarding review flow. */
  ocrImport: (token: string, dataUrl: string, title?: string) =>
    request<OcrImportResponse>("/imports/ocr", {
      method: "POST",
      token,
      body: { dataUrl, ...(title?.trim() ? { title: title.trim() } : {}) },
    }),

  browseNavigate: (url: string) =>
    request<{ page: BrowserPageResponse }>(`/browser/navigate?url=${encodeURIComponent(url)}`).then(
      (r) => r.page,
    ),

  browseYouTube: (queryOrUrl: string) =>
    request<{ page: BrowserPageResponse }>(
      `/browser/youtube?q=${encodeURIComponent(queryOrUrl)}`,
    ).then((r) => r.page),

  confirmImport: (token: string, jobId: string, draft?: RecipeDraft) =>
    request<{ recipeId: string; catalogueId: string | null; sharedWithCatalogue: boolean }>(
      `/imports/${jobId}/confirm`,
      { method: "POST", token, body: draft ? { draft } : {} },
    ),

  onboarding: (token: string, recipeId: string, answers: OnboardingAnswers) =>
    request<OnboardingResult>(`/recipes/${recipeId}/onboarding`, {
      method: "POST",
      token,
      body: answers,
    }),

  getShoppingList: (token: string, listId: string) =>
    request<{ list: ShoppingListView }>(`/shopping-lists/${listId}`, { token }).then((r) => r.list),

  toggleShoppingItem: (token: string, listId: string, itemId: string, checked: boolean) =>
    request<{ list: ShoppingListView }>(`/shopping-lists/${listId}/items/${itemId}`, {
      method: "PATCH",
      token,
      body: { checked },
    }).then((r) => r.list),

  completeShoppingList: (token: string, listId: string) =>
    request<{ list: ShoppingListView }>(`/shopping-lists/${listId}/complete`, {
      method: "POST",
      token,
    }).then((r) => r.list),

  cookCompletion: (token: string, recipeTitle: string) =>
    request<{ awarded: boolean; points: number; pointsPerRecipe: number }>("/me/cook-completion", {
      method: "POST",
      token,
      body: { recipeTitle },
    }),

  uploadPhoto: (token: string, dataUrl: string) =>
    request<{ url: string; bytes: number }>("/uploads", { method: "POST", token, body: { dataUrl } }),
};
