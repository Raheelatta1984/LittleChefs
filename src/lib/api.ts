import type {
  BrowserPageResponse, ChefProfile, ImportJobView, OcrImportResponse, OnboardingAnswers, OnboardingResult,
  RecipeDraft, RecipeView, Role, SearchResponse, ShoppingListView,
} from "../../shared/types";

// `import.meta.env` only exists under Vite; this keeps the module importable in
// Node (render tests / SSR) without a bundler.
const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const BASE = viteEnv.VITE_API_URL ?? "/api";
const STORAGE_KEY = "chefUniverseAuth";

export type AuthState = { chef: ChefProfile };

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
  // One-time migration: destroy bearer tokens left by older releases. The
  // HttpOnly session cookie is restored asynchronously through /me.
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function saveAuth(_auth: AuthState | null): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

type RequestOptions = { method?: string; body?: unknown };

/**
 * Identical GETs already on the wire are shared instead of fired twice.
 * React strict mode, a double-tapped button or two components mounting at once
 * all produce the same URL — they should cost one request, not three.
 */
const inFlightGets = new Map<string, Promise<unknown>>();

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET") return perform<T>(path, { ...options, method });

  const key = `${method} ${path}`;
  const existing = inFlightGets.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = perform<T>(path, { ...options, method }).finally(() => {
    inFlightGets.delete(key);
  });
  inFlightGets.set(key, promise as Promise<unknown>);
  return promise;
}

async function perform<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
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
        ? "The recipe kitchen isn't responding (404). On a computer, run `npm run dev` to start the app and kitchen together. If you're using the online app, its owner needs to deploy the API too."
        : response.status === 429
          ? "Whoa, that was a lot of tapping! Wait a few seconds and try again."
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

  signOut: () => request<{ ok: boolean }>("/chefs/sign-out", { method: "POST" }),

  me: () => request<{ chef: ChefProfile }>("/me").then((r) => r.chef),

  search: (query: string) =>
    request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`),

  listRecipes: () =>
    request<{ recipes: RecipeView[] }>("/recipes").then((r) => r.recipes),

  getRecipe: (id: string) =>
    request<{ recipe: RecipeView }>(`/recipes/${id}`).then((r) => r.recipe),

  saveRecipe: (draft: RecipeDraft, notes?: string | null) =>
    request<{ recipe: RecipeView }>("/recipes", { method: "POST", body: { ...draft, notes } }).then(
      (r) => r.recipe,
    ),

  deleteRecipe: (id: string) =>
    request<{ ok: boolean }>(`/recipes/${id}`, { method: "DELETE" }),

  claim: (catalogueId: string) =>
    request<{ recipe: RecipeView; alreadyOwned: boolean }>(`/catalogue/${catalogueId}/claim`, {
      method: "POST",
    }),

  startImport: (
    inputValue: string,
    options?: { allowAiFallback?: boolean; draftHint?: RecipeDraft | null },
  ) =>
    request<{ job: ImportJobView }>("/imports", {
      method: "POST",
      body: {
        inputValue,
        ...(options?.allowAiFallback ? { allowAiFallback: true } : {}),
        ...(options?.draftHint ? { draftHint: options.draftHint } : {}),
      },
    }).then((r) => r.job),

  /** 📷 Scan a recipe photo/screenshot with OCR → same AI-onboarding review flow. */
  ocrImport: (dataUrl: string, title?: string) =>
    request<OcrImportResponse>("/imports/ocr", {
      method: "POST",
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

  confirmImport: (jobId: string, draft?: RecipeDraft) =>
    request<{ recipeId: string; catalogueId: string | null; sharedWithCatalogue: boolean }>(
      `/imports/${jobId}/confirm`,
      { method: "POST", body: draft ? { draft } : {} },
    ),

  onboarding: (recipeId: string, answers: OnboardingAnswers) =>
    request<OnboardingResult>(`/recipes/${recipeId}/onboarding`, {
      method: "POST",
      body: answers,
    }),

  getShoppingList: (listId: string) =>
    request<{ list: ShoppingListView }>(`/shopping-lists/${listId}`, {}).then((r) => r.list),

  toggleShoppingItem: (listId: string, itemId: string, checked: boolean) =>
    request<{ list: ShoppingListView }>(`/shopping-lists/${listId}/items/${itemId}`, {
      method: "PATCH",
      body: { checked },
    }).then((r) => r.list),

  completeShoppingList: (listId: string) =>
    request<{ list: ShoppingListView }>(`/shopping-lists/${listId}/complete`, {
      method: "POST",
    }).then((r) => r.list),

  cookCompletion: (recipeTitle: string) =>
    request<{ awarded: boolean; points: number; pointsPerRecipe: number }>("/me/cook-completion", {
      method: "POST",
      body: { recipeTitle },
    }),

  uploadPhoto: (dataUrl: string) =>
    request<{ url: string; bytes: number }>("/uploads", { method: "POST", body: { dataUrl } }),
};
