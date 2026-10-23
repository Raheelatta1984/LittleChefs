import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BrowserPageResponse,
  BrowserRecipeCard,
  BrowserYouTubeVideo,
  Ingredient,
  RecipeDraft,
  Step,
} from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { FAMOUS_CHEFS, chefWebsiteSearchUrl, chefYouTubeSearchUrl } from "../data/famousChefs";
import { findRecipe } from "../data/recipes";
import { parseDishQuery } from "./SmartRecipeFinder";
import { YouTubePlayer, extractYouTubeId } from "./YouTubePlayer";
import { playPop, playSuccess } from "../utils/audio";

export type BrowserChefContext = {
  name: string;
  emoji?: string;
  country?: string;
  websiteUrl?: string | null;
  youtubeUrl?: string | null;
};

export type BrowserImportPayload = {
  inputValue: string;
  draftHint?: RecipeDraft | null;
  startOnboardingAfterSave?: boolean;
};

type BrowserTab = "website" | "youtube";

type HistoryEntry = {
  tab: BrowserTab;
  target: string;
};

type MealDbEntry = Record<string, string | null | undefined>;

const MEALDB = "https://www.themealdb.com/api/json/v1/1";

function isYouTubeTarget(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (extractYouTubeId(trimmed)) return true;
  return /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\b/i.test(trimmed);
}

function parseSimpleIngredient(raw: string, position: number): Ingredient {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const qtyMatch = cleaned.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[½¼¾⅓⅔])\s*(.*)$/);
  let quantity: number | null = null;
  let rest = cleaned;
  if (qtyMatch) {
    const token = qtyMatch[1];
    if (token === "½") quantity = 0.5;
    else if (token === "¼") quantity = 0.25;
    else if (token === "¾") quantity = 0.75;
    else if (token === "⅓") quantity = 0.33;
    else if (token === "⅔") quantity = 0.67;
    else if (token.includes("/")) {
      const parts = token.split(/\s+/);
      if (parts.length === 2) {
        const [num, den] = parts[1].split("/").map(Number);
        quantity = Number(parts[0]) + (den ? num / den : 0);
      } else {
        const [num, den] = parts[0].split("/").map(Number);
        quantity = den ? num / den : null;
      }
    } else {
      const parsed = Number(token);
      quantity = Number.isFinite(parsed) ? parsed : null;
    }
    rest = qtyMatch[2] || cleaned;
  }

  const unitMatch = rest.match(
    /^(cups?|tbsp|tablespoons?|tsp|teaspoons?|g|grams?|kg|ml|l|oz|lbs?|pounds?|cloves?|slices?|cans?|pieces?|pinch(?:es)?)\b\.?\s+(.*)$/i,
  );
  let unit: string | null = null;
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    rest = unitMatch[2];
  }
  const unscalable = /to taste|as needed|optional|garnish/i.test(cleaned);
  return {
    position,
    quantity: unscalable ? null : quantity,
    unit,
    item: rest.trim() || cleaned,
    prepNote: null,
    groupName: null,
    scalable: !unscalable && quantity !== null,
    rawText: cleaned,
  };
}

function mealDbToDraft(meal: MealDbEntry): RecipeDraft {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const item = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (!item) continue;
    const combined = measure ? `${measure} ${item}` : item;
    ingredients.push(parseSimpleIngredient(combined, ingredients.length));
  }

  let stepTexts = (meal.strInstructions || "")
    .split(/\r?\n+/)
    .map((line) => line.replace(/^step\s*\d+\s*[:.-]?\s*/i, "").trim())
    .filter((line) => line.length > 3);
  if (stepTexts.length <= 1 && stepTexts[0]) {
    stepTexts = stepTexts[0]
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 3);
  }
  const steps: Step[] = stepTexts.map((instruction, position) => ({
    position,
    instruction,
    durationSeconds: null,
    temperatureC: null,
    imageUrl: null,
    tip: null,
  }));

  const videoId = extractYouTubeId(meal.strYoutube);
  const sourceUrl =
    (meal.strSource && meal.strSource.trim()) ||
    (meal.strYoutube && meal.strYoutube.trim()) ||
    `https://www.themealdb.com/meal/${meal.idMeal ?? ""}`;

  return {
    title: (meal.strMeal || "Chef Recipe").trim(),
    cuisine: (meal.strArea || "").trim() || null,
    description: meal.strCategory ? `${meal.strCategory} recipe` : null,
    difficulty: "Easy",
    baseServings: 4,
    totalMinutes: 35,
    heroImageUrl: (meal.strMealThumb || "").trim() || null,
    sourceType: videoId ? "youtube" : "web",
    sourceUrl,
    sourceVideoId: videoId,
    sourceChannel: videoId ? "Recipe Kitchen Video" : null,
    sourceAuthor: meal.strArea ? `${meal.strArea} Kitchen` : null,
    ingredients,
    steps,
  };
}

function inferDishFromInput(raw: string, fallbackDish: string): string {
  if (!raw.trim()) return fallbackDish;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      const q =
        parsed.searchParams.get("s") ??
        parsed.searchParams.get("search_query") ??
        parsed.searchParams.get("q");
      if (q) {
        return q
          .replace(/\brecipe\b/gi, "")
          .replace(/\+/g, " ")
          .trim();
      }
    }
  } catch {
    // ignore
  }
  return parseDishQuery(raw) || fallbackDish;
}

export function InAppBrowser({
  initialUrl,
  initialQuery = "",
  initialTab,
  chefContext,
  onClose,
  onImportWithAi,
}: {
  initialUrl?: string;
  initialQuery?: string;
  initialTab?: BrowserTab;
  chefContext?: BrowserChefContext | null;
  onClose: () => void;
  onImportWithAi: (payload: BrowserImportPayload) => void;
}) {
  const resolvedStartTab: BrowserTab =
    initialTab ?? (initialUrl && isYouTubeTarget(initialUrl) ? "youtube" : "website");

  const resolvedStartTarget = useMemo(() => {
    if (initialUrl?.trim()) return initialUrl.trim();
    if (resolvedStartTab === "youtube") {
      if (chefContext?.youtubeUrl) return chefContext.youtubeUrl;
      if (initialQuery.trim()) return `${chefContext?.name ? `${chefContext.name} ` : ""}${initialQuery.trim()} recipe`;
      return "";
    }
    if (chefContext?.websiteUrl) return chefContext.websiteUrl;
    if (initialQuery.trim()) return initialQuery.trim();
    return "";
  }, [initialUrl, resolvedStartTab, chefContext, initialQuery]);

  const [history, setHistory] = useState<HistoryEntry[]>(
    resolvedStartTarget ? [{ tab: resolvedStartTab, target: resolvedStartTarget }] : [],
  );
  const [historyIndex, setHistoryIndex] = useState(resolvedStartTarget ? 0 : -1);
  const currentEntry = historyIndex >= 0 ? history[historyIndex] : null;

  const [tab, setTab] = useState<BrowserTab>(resolvedStartTab);
  const [addressInput, setAddressInput] = useState(resolvedStartTarget);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<BrowserPageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [websiteViewMode, setWebsiteViewMode] = useState<"cards" | "live">("cards");
  const [companionDrafts, setCompanionDrafts] = useState<RecipeDraft[]>([]);
  const [selectedCompanion, setSelectedCompanion] = useState<RecipeDraft | null>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const reqSeqRef = useRef(0);

  const featuredChefs = useMemo(() => FAMOUS_CHEFS.slice(0, 6), []);
  const dishHint = useMemo(
    () => inferDishFromInput(currentEntry?.target ?? addressInput, initialQuery || "Chicken Biryani"),
    [currentEntry, addressInput, initialQuery],
  );

  async function loadCompanionMatches(dish: string) {
    const clean = dish
      .replace(/\b(?:food fusion|ranveer brar|cakes by mk|sooperchef|hebbars kitchen|kun foods|sanjeev kapoor|chef)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const searchDish = clean || dish.trim();
    if (!searchDish) return;

    const results: RecipeDraft[] = [];
    const builtin = findRecipe(searchDish);
    if (!builtin.isGeneric) {
      const videoId = extractYouTubeId(builtin.youtubeVideo);
      results.push({
        title: builtin.name,
        cuisine: null,
        description: builtin.tip,
        difficulty: builtin.difficulty,
        baseServings: 4,
        totalMinutes: Number.parseInt(builtin.time, 10) || 25,
        heroImageUrl: builtin.image ?? null,
        sourceType: videoId ? "youtube" : "web",
        sourceUrl: builtin.sourceUrl ?? builtin.youtubeVideo ?? null,
        sourceVideoId: videoId,
        sourceChannel: builtin.source ?? "Chef Universe Kitchen",
        sourceAuthor: builtin.source ?? "Chef Universe",
        ingredients: builtin.ingredients.map((line, i) => parseSimpleIngredient(line, i)),
        steps: builtin.steps.map((instruction, i) => ({
          position: i,
          instruction,
          durationSeconds: null,
          temperatureC: null,
          imageUrl: null,
          tip: null,
        })),
      });
    }

    if (typeof fetch === "function") {
      try {
        const res = await fetch(`${MEALDB}/search.php?s=${encodeURIComponent(searchDish)}`);
        if (res.ok) {
          const payload = (await res.json()) as { meals?: MealDbEntry[] | null };
          const meals = Array.isArray(payload.meals) ? payload.meals.slice(0, 6) : [];
          for (const meal of meals) {
            const draft = mealDbToDraft(meal);
            if (!results.some((r) => r.title.toLowerCase() === draft.title.toLowerCase())) {
              results.push(draft);
            }
          }
        }
      } catch {
        // Offline or blocked — built-in match still works
      }
    }

    setCompanionDrafts(results);
  }

  async function executeLoad(entry: HistoryEntry) {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    setError(null);
    setSelectedCompanion(null);
    setTab(entry.tab);
    setAddressInput(entry.target);

    const dish = inferDishFromInput(entry.target, initialQuery);
    void loadCompanionMatches(dish);

    try {
      const loaded =
        entry.tab === "youtube"
          ? await api.browseYouTube(entry.target)
          : await api.browseNavigate(entry.target);
      if (seq !== reqSeqRef.current) return;
      setPage(loaded);
      setAddressInput(loaded.url || entry.target);
      if (loaded.kind === "website") {
        setWebsiteViewMode(loaded.detectedRecipe || loaded.links.length === 0 ? "live" : "cards");
      }
    } catch (caught) {
      if (seq !== reqSeqRef.current) return;
      setPage(null);
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Could not load that page directly, so we loaded verified in-app recipes & videos below!",
      );
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
      }
    }
  }

  function pushNavigation(nextTab: BrowserTab, rawTarget: string) {
    const trimmed = rawTarget.trim();
    if (!trimmed) return;
    const autoTab: BrowserTab = isYouTubeTarget(trimmed) ? "youtube" : nextTab;
    const nextEntry: HistoryEntry = { tab: autoTab, target: trimmed };
    const sliced = history.slice(0, historyIndex + 1);
    const updated = [...sliced, nextEntry];
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
    void executeLoad(nextEntry);
  }

  function goBackInBrowser() {
    if (selectedCompanion) {
      playPop();
      setSelectedCompanion(null);
      return;
    }
    if (historyIndex <= 0) return;
    playPop();
    const prevIndex = historyIndex - 1;
    setHistoryIndex(prevIndex);
    void executeLoad(history[prevIndex]);
  }

  function goForwardInBrowser() {
    if (historyIndex >= history.length - 1) return;
    playPop();
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    void executeLoad(history[nextIndex]);
  }

  function reloadCurrent() {
    if (!currentEntry) return;
    playPop();
    void executeLoad(currentEntry);
  }

  function switchTab(nextTab: BrowserTab) {
    playPop();
    setTab(nextTab);
    setSelectedCompanion(null);
    if (nextTab === "youtube") {
      const ytTarget =
        chefContext?.youtubeUrl ||
        (page?.kind === "youtube-search" || page?.kind === "youtube-video" ? page.url : "") ||
        `${chefContext?.name ? `${chefContext.name} ` : ""}${dishHint} recipe`;
      if (ytTarget) pushNavigation("youtube", ytTarget);
    } else {
      const webTarget =
        chefContext?.websiteUrl ||
        (page?.kind === "website" ? page.url : "") ||
        dishHint;
      if (webTarget) pushNavigation("website", webTarget);
    }
  }

  // Load initial target on mount
  useEffect(() => {
    if (currentEntry) {
      void executeLoad(currentEntry);
    } else {
      void loadCompanionMatches(initialQuery || "Chicken Biryani");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intercept link & form clicks inside the sandboxed Live Website Preview iframe!
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (
        data &&
        data.type === "chef-browser:navigate" &&
        typeof data.url === "string" &&
        /^https?:\/\//i.test(data.url)
      ) {
        playPop();
        pushNavigation(isYouTubeTarget(data.url) ? "youtube" : "website", data.url);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, historyIndex]);

  function importCurrentSelection(overrideUrl?: string, overrideDraft?: RecipeDraft | null) {
    playSuccess();
    const inputValue =
      overrideUrl ??
      (selectedCompanion
        ? selectedCompanion.sourceUrl || selectedCompanion.title
        : page?.activeVideo?.watchUrl ?? page?.url ?? addressInput.trim());
    const draftHint = overrideDraft !== undefined ? overrideDraft : selectedCompanion ?? page?.detectedRecipe ?? null;
    if (!inputValue) return;
    onImportWithAi({
      inputValue,
      draftHint,
      startOnboardingAfterSave: true,
    });
  }

  const readyToImportCurrent = Boolean(
    selectedCompanion ||
      page?.detectedRecipe ||
      page?.kind === "youtube-video" ||
      (page?.kind === "website" && page.url && page.links.length === 0),
  );

  const activeSummaryTitle =
    selectedCompanion?.title ??
    page?.detectedRecipe?.title ??
    page?.activeVideo?.title ??
    page?.title ??
    null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-1.5 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="In-App Recipe & YouTube Browser"
    >
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-orange-200">
        {/* Browser Top Header */}
        <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 via-pink-50 to-fuchsia-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  🔒 In-App Browser
                </span>
                {chefContext?.name && (
                  <span className="truncate text-xs font-black text-fuchsia-700">
                    {chefContext.emoji ?? "👨‍🍳"} {chefContext.name} {chefContext.country ?? ""}
                  </span>
                )}
              </div>
              <h2 className="mt-0.5 truncate text-base font-black text-slate-800">
                Browse Recipes &amp; YouTube Without Leaving Chef Universe
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                playPop();
                onClose();
              }}
              aria-label="Close internal browser"
              className="shrink-0 rounded-full bg-white px-3 py-1.5 font-black text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95"
            >
              ✕
            </button>
          </div>

          {/* Mode Tabs: Website vs YouTube Channel */}
          <div className="mt-2.5 grid grid-cols-2 gap-2" role="tablist" aria-label="Browser source mode">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "website"}
              onClick={() => switchTab("website")}
              className={`rounded-2xl py-2 text-xs font-black transition active:scale-95 ${
                tab === "website"
                  ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              🌐 Chef Website &amp; Web Search
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "youtube"}
              onClick={() => switchTab("youtube")}
              className={`rounded-2xl py-2 text-xs font-black transition active:scale-95 ${
                tab === "youtube"
                  ? "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              📺 YouTube Channel &amp; Videos
            </button>
          </div>

          {/* Navigation Controls + Address/Search Bar */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={goBackInBrowser}
              disabled={historyIndex <= 0 && !selectedCompanion}
              aria-label="Browser back"
              className="rounded-xl bg-white px-2.5 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-35"
            >
              ←
            </button>
            <button
              type="button"
              onClick={goForwardInBrowser}
              disabled={historyIndex >= history.length - 1}
              aria-label="Browser forward"
              className="rounded-xl bg-white px-2.5 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-35"
            >
              →
            </button>
            <button
              type="button"
              onClick={reloadCurrent}
              disabled={!currentEntry || loading}
              aria-label="Reload page"
              className="rounded-xl bg-white px-2.5 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-35"
            >
              ↻
            </button>
            <input
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  playPop();
                  pushNavigation(tab, addressInput);
                }
              }}
              placeholder={
                tab === "youtube"
                  ? "Search a YouTube channel + dish, or paste a video link…"
                  : "Paste a chef website URL or type any dish to browse…"
              }
              aria-label="Internal browser address or search bar"
              className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={() => {
                playPop();
                pushNavigation(tab, addressInput);
              }}
              disabled={!addressInput.trim() || loading}
              className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white shadow transition active:scale-95 disabled:opacity-40"
            >
              Go
            </button>
          </div>
        </div>

        {/* Scrollable Viewport */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Quick Chef Channel / Site Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="shrink-0 text-[11px] font-black uppercase tracking-wide text-slate-400">
              Quick Chefs:
            </span>
            {featuredChefs.map((fc) => {
              const target =
                tab === "youtube"
                  ? chefYouTubeSearchUrl(fc, dishHint)
                  : chefWebsiteSearchUrl(fc, dishHint) ?? chefYouTubeSearchUrl(fc, dishHint);
              return (
                <button
                  key={fc.id}
                  type="button"
                  onClick={() => {
                    playPop();
                    pushNavigation(tab, target);
                  }}
                  className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-700 ring-1 ring-orange-200 transition hover:bg-orange-100 active:scale-95"
                >
                  {fc.emoji} {fc.name} {fc.flag}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                playPop();
                setShowPasteBox((v) => !v);
              }}
              className="shrink-0 rounded-full bg-fuchsia-50 px-2.5 py-1 text-[11px] font-extrabold text-fuchsia-700 ring-1 ring-fuchsia-200 transition hover:bg-fuchsia-100 active:scale-95"
            >
              📋 Paste Text / Link
            </button>
          </div>

          {showPasteBox && (
            <section className="rounded-2xl bg-fuchsia-50 p-3 ring-1 ring-fuchsia-200">
              <p className="text-xs font-black text-fuchsia-800">
                📋 Have a recipe URL, YouTube video link, or copied description?
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={3}
                placeholder="Paste a website URL, YouTube watch link, or recipe ingredients & steps…"
                className="mt-2 w-full rounded-xl border border-fuchsia-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-fuchsia-400"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!pastedText.trim()}
                  onClick={() => {
                    onImportWithAi({
                      inputValue: pastedText.trim(),
                      startOnboardingAfterSave: true,
                    });
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-xs font-black text-white shadow transition active:scale-95 disabled:opacity-40"
                >
                  🤖 Import &amp; Start AI Onboarding
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteBox(false)}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-500 ring-1 ring-slate-200"
                >
                  Close
                </button>
              </div>
            </section>
          )}

          {/* Loading State */}
          {loading && (
            <div className="rounded-3xl bg-orange-50/70 py-10 text-center ring-1 ring-orange-100">
              <div className="animate-bounce text-4xl" aria-hidden="true">
                {tab === "youtube" ? "📺" : "🌐"}
              </div>
              <p className="mt-2 text-sm font-black text-slate-700">
                Loading inside Chef Universe…
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Scanning for recipes, videos &amp; ingredients so you never leave the app!
              </p>
            </div>
          )}

          {/* Companion Recipe Preview (when user clicks one of the verified in-browser cards) */}
          {!loading && selectedCompanion && (
            <section className="space-y-3 rounded-3xl bg-emerald-50/70 p-4 ring-2 ring-emerald-300">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                    ✅ Selected Recipe Preview
                  </span>
                  <h3 className="mt-1 text-xl font-black text-slate-800">
                    {selectedCompanion.title}
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    {selectedCompanion.ingredients.length} ingredients •{" "}
                    {selectedCompanion.steps.length} steps • {selectedCompanion.baseServings} servings
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCompanion(null)}
                  className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-200"
                >
                  ← Results
                </button>
              </div>

              {selectedCompanion.sourceVideoId ? (
                <YouTubePlayer
                  youtubeIdOrUrl={selectedCompanion.sourceVideoId}
                  title={selectedCompanion.title}
                />
              ) : selectedCompanion.heroImageUrl ? (
                <img
                  src={selectedCompanion.heroImageUrl}
                  alt={selectedCompanion.title}
                  className="max-h-52 w-full rounded-2xl object-cover shadow"
                />
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-3 ring-1 ring-emerald-100">
                  <p className="text-xs font-black uppercase text-slate-400">Ingredients</p>
                  <ul className="mt-1.5 space-y-1 text-xs font-semibold text-slate-700">
                    {selectedCompanion.ingredients.slice(0, 8).map((ing, idx) => (
                      <li key={idx}>
                        • {ing.rawText ?? `${ing.quantity ?? ""} ${ing.unit ?? ""} ${ing.item}`.trim()}
                      </li>
                    ))}
                  </ul>
                  {selectedCompanion.ingredients.length > 8 && (
                    <p className="mt-1 text-[11px] font-bold text-slate-400">
                      +{selectedCompanion.ingredients.length - 8} more ingredients
                    </p>
                  )}
                </div>
                <div className="rounded-2xl bg-white p-3 ring-1 ring-emerald-100">
                  <p className="text-xs font-black uppercase text-slate-400">Steps Preview</p>
                  <ol className="mt-1.5 space-y-1 text-xs font-semibold text-slate-700">
                    {selectedCompanion.steps.slice(0, 4).map((st, idx) => (
                      <li key={idx} className="line-clamp-2">
                        <span className="font-black text-orange-500">{idx + 1}.</span>{" "}
                        {st.instruction}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  importCurrentSelection(
                    selectedCompanion.sourceUrl || selectedCompanion.title,
                    selectedCompanion,
                  )
                }
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-black text-white shadow-lg transition active:scale-95"
              >
                🤖 Import Complete Recipe with AI Onboarding
              </button>
            </section>
          )}

          {/* Detected Recipe Banner on Loaded Website / YouTube Video */}
          {!loading && !selectedCompanion && page?.detectedRecipe && (
            <section className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 ring-2 ring-emerald-300">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                  ✅ Complete Recipe Ready
                </span>
                <span className="text-xs font-bold text-emerald-800">
                  {page.detectedRecipe.ingredients.length} ingredients •{" "}
                  {page.detectedRecipe.steps.length} steps
                  {page.detectedConfidence
                    ? ` • ${Math.round(page.detectedConfidence * 100)}% match`
                    : ""}
                </span>
              </div>
              <h3 className="mt-1.5 text-lg font-black text-slate-800">
                {page.detectedRecipe.title}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">
                We mapped the ingredients, steps &amp; photos from this {page.kind === "youtube-video" ? "video" : "page"}.
                Import it now to scale portions &amp; generate your shopping list!
              </p>
              <button
                type="button"
                onClick={() => importCurrentSelection(page.url, page.detectedRecipe)}
                className="mt-3 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-black text-white shadow-lg transition active:scale-95"
              >
                🤖 Import Complete Recipe with AI Onboarding
              </button>
            </section>
          )}

          {/* YouTube Video Detail View */}
          {!loading && !selectedCompanion && page?.kind === "youtube-video" && page.activeVideo && (
            <section className="space-y-3 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <YouTubePlayer
                youtubeIdOrUrl={page.activeVideo.videoId}
                title={page.activeVideo.title}
              />
              <div>
                <h3 className="text-lg font-black text-slate-800">{page.activeVideo.title}</h3>
                {page.activeVideo.channel && (
                  <p className="text-xs font-extrabold text-red-600">
                    📺 {page.activeVideo.channel}
                  </p>
                )}
              </div>
              {page.activeVideo.description && (
                <details className="rounded-2xl bg-white p-3 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  <summary className="cursor-pointer font-black text-slate-700">
                    📄 View Video Recipe Description
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-600">
                    {page.activeVideo.description}
                  </pre>
                </details>
              )}
              {!page.detectedRecipe && (
                <button
                  type="button"
                  onClick={() => importCurrentSelection(page.activeVideo!.watchUrl, null)}
                  className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3.5 text-sm font-black text-white shadow-lg transition active:scale-95"
                >
                  🤖 Import Complete Recipe with AI Onboarding
                </button>
              )}
            </section>
          )}

          {/* YouTube Search / Channel Video List */}
          {!loading && !selectedCompanion && page?.kind === "youtube-search" && (
            <section className="space-y-2.5" aria-label="YouTube channel and search videos">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800">
                  📺 {page.title} ({page.videos.length} videos)
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  Tap Watch to preview in-app!
                </span>
              </div>
              {page.videos.length === 0 ? (
                <p className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                  No direct YouTube cards came back for that query — check the verified recipe videos below or paste a direct video link!
                </p>
              ) : (
                <div className="space-y-2.5">
                  {page.videos.map((video: BrowserYouTubeVideo) => (
                    <div
                      key={video.videoId}
                      className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"
                    >
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            playPop();
                            pushNavigation("youtube", video.watchUrl);
                          }}
                          className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-900"
                        >
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-lg text-white transition group-hover:scale-110">
                            ▶
                          </span>
                          {video.duration && (
                            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-black text-white">
                              {video.duration}
                            </span>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-black text-slate-800">
                            {video.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-bold text-red-600">
                            {video.channel ?? "YouTube Chef"}
                            {video.viewCountText ? ` • ${video.viewCountText}` : ""}
                          </p>
                          {video.descriptionSnippet && (
                            <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-500">
                              {video.descriptionSnippet}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            playPop();
                            pushNavigation("youtube", video.watchUrl);
                          }}
                          className="rounded-xl bg-slate-100 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 active:scale-95"
                        >
                          ▶ Watch &amp; Check In-App
                        </button>
                        <button
                          type="button"
                          onClick={() => importCurrentSelection(video.watchUrl, null)}
                          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-xs font-black text-white shadow transition active:scale-95"
                        >
                          🤖 AI Import Recipe
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Website Mode: Cards Picker + Sandboxed Live Page View */}
          {!loading && !selectedCompanion && page?.kind === "website" && (
            <section className="space-y-3" aria-label="Loaded website inside app">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-slate-800">{page.title}</p>
                  <p className="truncate text-[11px] font-semibold text-slate-400">
                    {page.siteName ?? page.url}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playPop();
                      setWebsiteViewMode("cards");
                    }}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                      websiteViewMode === "cards"
                        ? "bg-orange-500 text-white shadow"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    🃏 Recipes ({page.links.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playPop();
                      setWebsiteViewMode("live");
                    }}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-black transition ${
                      websiteViewMode === "live"
                        ? "bg-sky-500 text-white shadow"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    🖥️ Live Page
                  </button>
                </div>
              </div>

              {websiteViewMode === "cards" ? (
                page.links.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500">
                      Choose the right recipe below — open it inside the browser to inspect, or import straight into AI Onboarding:
                    </p>
                    {page.links.map((card: BrowserRecipeCard) => (
                      <div
                        key={card.url}
                        className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-orange-100"
                      >
                        <div className="flex items-center gap-3">
                          {card.imageUrl ? (
                            <img
                              src={card.imageUrl}
                              alt=""
                              className="h-16 w-16 shrink-0 rounded-xl object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-2xl">
                              🍽️
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-black text-slate-800">
                              {card.title}
                            </p>
                            {card.siteName && (
                              <p className="text-[11px] font-bold text-sky-600">
                                🌐 {card.siteName}
                              </p>
                            )}
                            {card.snippet && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-slate-500">
                                {card.snippet}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              playPop();
                              pushNavigation("website", card.url);
                            }}
                            className="rounded-xl bg-sky-50 py-2 text-xs font-black text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 active:scale-95"
                          >
                            👁️ Open Recipe Page
                          </button>
                          <button
                            type="button"
                            onClick={() => importCurrentSelection(card.url, null)}
                            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-xs font-black text-white shadow transition active:scale-95"
                          >
                            🤖 AI Import Recipe
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-500">
                    No separate recipe links were listed on this page. Switch to{" "}
                    <button
                      type="button"
                      onClick={() => setWebsiteViewMode("live")}
                      className="font-black text-sky-600 underline"
                    >
                      🖥️ Live Page
                    </button>{" "}
                    or import this page directly below!
                  </p>
                )
              ) : page.sanitizedHtml ? (
                <div className="overflow-hidden rounded-2xl ring-2 ring-slate-200">
                  <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500">
                    💡 Tip: Clicking any recipe link inside this page stays inside Chef Universe!
                  </div>
                  <iframe
                    title={page.title || "In-app recipe website view"}
                    sandbox="allow-scripts"
                    srcDoc={page.sanitizedHtml}
                    className="h-96 w-full bg-white"
                  />
                </div>
              ) : null}
            </section>
          )}

          {/* Friendly Status Banner if Direct Scrape Was Blocked / Offline */}
          {!loading && error && (
            <div className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
              <p>ℹ️ {error}</p>
              <p className="mt-1 font-semibold text-amber-800">
                You can pick any verified in-app recipe &amp; video match below, try another search above, or paste recipe text with{" "}
                <button
                  type="button"
                  onClick={() => setShowPasteBox(true)}
                  className="font-black underline"
                >
                  📋 Paste Text / Link
                </button>
                .
              </p>
            </div>
          )}

          {/* Verified Companion Recipes & Videos (Always Available In-App!) */}
          {!loading && !selectedCompanion && companionDrafts.length > 0 && (
            <section className="space-y-2.5" aria-label="Verified in-app recipe matches">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800">
                  ✨ Ready-to-Import Recipes &amp; Videos for “{dishHint}”
                </h3>
                <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-black text-fuchsia-700">
                  1-Tap AI Onboarding
                </span>
              </div>
              <div className="space-y-2">
                {companionDrafts.map((item) => (
                  <div
                    key={`${item.title}-${item.sourceUrl ?? ""}`}
                    className="rounded-2xl bg-gradient-to-br from-orange-50/80 to-pink-50/80 p-3 ring-1 ring-orange-100"
                  >
                    <div className="flex items-center gap-3">
                      {item.heroImageUrl ? (
                        <img
                          src={item.heroImageUrl}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-sm"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                          🍲
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-800">{item.title}</p>
                        <p className="text-xs font-bold text-slate-500">
                          {item.ingredients.length} ingredients • {item.steps.length} steps
                          {item.sourceVideoId ? " • 🎬 In-app video" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playPop();
                          setSelectedCompanion(item);
                        }}
                        className="rounded-xl bg-white py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
                      >
                        👁️ Preview Recipe {item.sourceVideoId ? "& Video" : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          importCurrentSelection(item.sourceUrl || item.title, item)
                        }
                        className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2 text-xs font-black text-white shadow transition active:scale-95"
                      >
                        🤖 AI Import &amp; Onboard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sticky Bottom AI Onboarding Bar */}
        <div className="border-t border-orange-100 bg-white px-4 py-3">
          {readyToImportCurrent ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-slate-800">
                  🎯 {activeSummaryTitle || "Selected Recipe"}
                </p>
                <p className="text-[11px] font-bold text-slate-500">
                  Maps ingredients, steps &amp; photos → scales portions → builds shopping list
                </p>
              </div>
              <button
                type="button"
                onClick={() => importCurrentSelection()}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 px-4 py-3 text-xs font-black text-white shadow-lg transition active:scale-95"
              >
                🤖 Import Complete Recipe with AI Onboarding
              </button>
            </div>
          ) : (
            <p className="text-center text-xs font-bold text-slate-500">
              👆 Choose any recipe page or video above to preview it right here, then tap{" "}
              <span className="font-black text-fuchsia-600">🤖 AI Import</span> to start AI-Powered Onboarding!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
