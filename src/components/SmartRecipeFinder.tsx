import { useEffect, useMemo, useRef, useState } from "react";
import { findRecipe, generateGenericRecipe, type Recipe } from "../data/recipes";
import { AREA_TO_CONTINENT, CONTINENTS, getTopRecipesByContinent, type ContinentId } from "../data/topChefs";
import {
  CHEF_REGIONS,
  chefRegionLabel,
  chefWebsiteSearchUrl,
  chefYouTubeSearchUrl,
  detectChefRegion,
  getRankedChefs,
  regionSearchParams,
  type ChefRegionId,
  type FamousChef,
} from "../data/famousChefs";
import { YouTubePlayer } from "./YouTubePlayer";
import { playDing, playPop } from "../utils/audio";

export type FoundRecipe = Recipe & {
  confidence?: number;
  isOnline?: boolean;
  chefId?: string;
  /** TheMealDB id of the exact online recipe, so "Not This" can exclude IT (not the whole dish). */
  mealId?: string;
};

type Stage = "search" | "clarify" | "top10" | "aiChefs" | "confirm" | "loading";

type Top10Item = {
  mealId: string;
  name: string;
  category: string;
  area: string;
  thumb: string;
  emoji: string;
  isTopChef: boolean;
  inspiredBy?: string;
};

type MealDbMeal = Record<string, string | null | undefined>;

const CUISINES: { id: string; label: string }[] = [
  { id: "Any", label: "🌍 Any Style" },
  { id: "American", label: "🇺🇸 American" },
  { id: "Pakistani", label: "🇵🇰 Pakistani" },
  { id: "Indian", label: "🇮🇳 Indian" },
  { id: "Spanish", label: "🇪🇸 Spanish" },
  { id: "Italian", label: "🇮🇹 Italian" },
  { id: "Japanese", label: "🇯🇵 Japanese" },
  { id: "Chinese", label: "🇨🇳 Chinese" },
];

const STORAGE_KEY = "chefUniverseCustomRecipes";
const MEALDB = "https://www.themealdb.com/api/json/v1/1";

function isUrlLike(text: string): boolean {
  const t = text.trim();
  return /^https?:\/\//i.test(t) || /^www\./i.test(t) || /^[a-z0-9-]+\.[a-z]{2,}([/?#]|$)/i.test(t);
}

/** Turn a pasted recipe-site URL into a dish name (strip protocol/www/path/extensions). */
export function parseDishQuery(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  if (!isUrlLike(text)) return text;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const searchParam = url.searchParams.get("s") || url.searchParams.get("q") || url.searchParams.get("query");
    if (searchParam) return decodeURIComponent(searchParam).replace(/\+/g, " ").trim();
    const segments = url.pathname.split("/").map((sg) => sg.trim()).filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      const decoded = decodeURIComponent(segments[i])
        .replace(/\.(html?|php|aspx?|jsp)$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\d+\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (decoded.length >= 3 && !/^(index|recipe|recipes|watch|search)$/i.test(decoded)) return decoded;
    }
    return url.hostname.replace(/^www\./i, "").split(".")[0].replace(/[-_]+/g, " ");
  } catch {
    return text
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/\.(html?|php|aspx?|jsp)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim() || text;
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * True only for an EXACT name match with a rejected recipe. A different
 * chef's version of the same dish (or a variant like "Lamb Biryani" after
 * rejecting "Chicken Biryani") is a legitimate new option, so online
 * results are excluded by their TheMealDB meal ID — not by dish name.
 */
function isRejectedName(name: string, rejectedNames: string[]): boolean {
  const n = normalizeName(name);
  if (!n) return false;
  return rejectedNames.some((rejected) => normalizeName(rejected) === n);
}

function readSavedCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function saveRecipeToStorage(recipe: FoundRecipe): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list: FoundRecipe[] = Array.isArray(parsed) ? (parsed as FoundRecipe[]) : [];
    if (!list.some((r) => r.name.trim().toLowerCase() === recipe.name.trim().toLowerCase())) {
      list.push(recipe);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    return list.length;
  } catch {
    return 0;
  }
}

async function fetchMeals(url: string): Promise<MealDbMeal[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MealDB ${res.status}`);
  const data: unknown = await res.json();
  const meals = (data as { meals?: MealDbMeal[] | null }).meals;
  return Array.isArray(meals) ? meals : [];
}

function buildRecipeFromMeal(meal: MealDbMeal, item: Top10Item): FoundRecipe {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (ingredient) ingredients.push(measure ? `${measure} ${ingredient}` : ingredient);
  }
  let steps = (meal.strInstructions || "")
    .split(/\r?\n+/)
    .map((s) => s.replace(/^step\s*\d+\s*[:.-]?\s*/i, "").trim())
    .filter((s) => s.length > 2);
  if (steps.length <= 1 && steps[0]) {
    steps = steps[0].split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 2);
  }
  const isTopChef = item.isTopChef;
  return {
    name: isTopChef ? item.name : (meal.strMeal || item.name),
    emoji: item.emoji || "🍽️",
    time: "30 minutes",
    difficulty: "Easy",
    servings: "2–4 people",
    ingredients: ingredients.length ? ingredients : ["see the video and steps for the full ingredient list"],
    steps: steps.length ? steps : ["Follow along with the in-app video, asking a grown-up to help with heat and sharp tools."],
    tip: "Read every step once before you start — chefs call this 'mise en place'!",
    image: meal.strMealThumb || item.thumb || undefined,
    // Video ALWAYS comes from the recipe's own official TheMealDB strYoutube.
    youtubeVideo: meal.strYoutube || undefined,
    source: isTopChef && item.inspiredBy ? `Inspired by ${item.inspiredBy} • Video: TheMealDB Kitchen` : "TheMealDB",
    sourceUrl: meal.strSource || undefined,
    confidence: isTopChef ? 95 : 90,
    isOnline: true,
    mealId: meal.idMeal || item.mealId,
  };
}

type SmartRecipeFinderProps = {
  initialQuery: string;
  /** Open straight into AI Top-Chef mode (e.g. "Not this" on the recipe page). */
  initialMode?: "search" | "aiChefs";
  /** Recipe the user already said was wrong, so AI mode never offers it again. */
  rejectedRecipeName?: string;
  /** TheMealDB id of that rejected online recipe, if it had one. */
  rejectedMealId?: string;
  onClose: () => void;
  onRecipeFound: (recipe: FoundRecipe) => void;
};

// THE ONLY search in the app.
// NUMBER ONE RULE: never load a recipe until the user taps "✓ Yes, That's Exactly It!"
// NOT-THIS RULE: "❌ Not This" never dead-ends. It opens AI Top-Chef mode —
// famous chefs/YouTubers for the dish's region & country (Food Fusion 🇵🇰,
// Ranveer Brar 🇮🇳, …) plus fresh online recipes, minus everything rejected.
export function SmartRecipeFinder({ initialQuery, initialMode, rejectedRecipeName, rejectedMealId, onClose, onRecipeFound }: SmartRecipeFinderProps) {
  const initialParsed = parseDishQuery(initialQuery);
  const startInAi = initialMode === "aiChefs" && Boolean(initialParsed);

  const [stage, setStage] = useState<Stage>(startInAi ? "aiChefs" : "search");
  const [query, setQuery] = useState(initialQuery);
  const [parsedQuery, setParsedQuery] = useState(startInAi ? initialParsed : "");
  const [continent, setContinent] = useState<ContinentId>("all");
  const [cuisine, setCuisine] = useState("Any");
  const [chefRegion, setChefRegion] = useState<ChefRegionId>(() => detectChefRegion(initialParsed || initialQuery));
  const [items, setItems] = useState<Top10Item[]>([]);
  const [candidate, setCandidate] = useState<FoundRecipe | null>(null);
  const [confirmFrom, setConfirmFrom] = useState<"search" | "top10" | "aiChefs">("search");
  const [fetching, setFetching] = useState(false);
  const [loadingMealId, setLoadingMealId] = useState<string | null>(null);
  const [loadingChefId, setLoadingChefId] = useState<string | null>(null);
  const [rejectedNames, setRejectedNames] = useState<string[]>(rejectedRecipeName ? [rejectedRecipeName] : []);
  const [rejectedMealIds, setRejectedMealIds] = useState<string[]>(rejectedMealId ? [rejectedMealId] : []);
  const [triedChefIds, setTriedChefIds] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(readSavedCount);
  const [error, setError] = useState("");
  const searchSeqRef = useRef(0);
  const autoSearchedRef = useRef(false);

  const dishForChefs = parsedQuery || parseDishQuery(query);
  const rankedChefs = useMemo(() => {
    const ranked = getRankedChefs(dishForChefs || "recipe", { cuisine, continent, regionFilter: chefRegion });
    // Chefs the user already tried (and rejected) sink to the bottom, but
    // stay visible so their website / YouTube searches are still reachable.
    return [
      ...ranked.filter((chef) => !triedChefIds.includes(chef.id)),
      ...ranked.filter((chef) => triedChefIds.includes(chef.id)),
    ];
  }, [dishForChefs, cuisine, continent, chefRegion, triedChefIds]);

  function handleFind() {
    const parsed = parseDishQuery(query);
    if (!parsed) return;
    playPop();
    setError("");
    setParsedQuery(parsed);
    if (parsed !== query.trim()) setQuery(parsed);
    const found = findRecipe(parsed);
    if (!found.isGeneric && !isRejectedName(found.name, rejectedNames)) {
      setCandidate({
        ...found,
        confidence: 100,
        isOnline: false,
        source: found.source ?? "Built-in Chef Universe Recipe",
      });
      setConfirmFrom("search");
      setStage("confirm");
    } else if (!found.isGeneric) {
      // We already showed this one and the user said "Not This" — go
      // straight to the AI Top Chefs instead of offering it again.
      const region = detectChefRegion(parsed, { cuisine, continent });
      setChefRegion(region);
      setStage("aiChefs");
      startAiChefSearch(parsed, region, rejectedMealIds);
    } else {
      setStage("clarify");
    }
  }

  async function runOnlineSearch(params: {
    dish: string;
    continentFilter: ContinentId;
    cuisineFilter: string;
    excludeMealIds: string[];
    destination: "top10" | "aiChefs";
  }) {
    const { dish, continentFilter, cuisineFilter, excludeMealIds, destination } = params;
    if (!dish) return;
    const seq = ++searchSeqRef.current;
    setFetching(true);
    setError("");
    try {
      const dishWords = dish.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      // (a) Curated Top-10 chef recipes, filtered by continent + name-matching, resolved live.
      const curated = getTopRecipesByContinent(continentFilter).filter((entry) => {
        const haystack = `${entry.name} ${entry.searchTerm} ${entry.cuisine}`.toLowerCase();
        return dishWords.some((w) => haystack.includes(w));
      });
      const curatedItems = await Promise.all(
        curated.map(async (entry): Promise<Top10Item> => {
          try {
            const meals = await fetchMeals(`${MEALDB}/search.php?s=${encodeURIComponent(entry.searchTerm)}`);
            const meal = meals[0];
            return {
              mealId: meal?.idMeal || entry.id,
              name: entry.name,
              category: meal?.strCategory || "Chef Special",
              area: meal?.strArea || entry.cuisine,
              thumb: meal?.strMealThumb || entry.thumb,
              emoji: entry.emoji,
              isTopChef: true,
              inspiredBy: entry.inspiredBy,
            };
          } catch {
            return {
              mealId: entry.id,
              name: entry.name,
              category: "Chef Special",
              area: entry.cuisine,
              thumb: entry.thumb,
              emoji: entry.emoji,
              isTopChef: true,
              inspiredBy: entry.inspiredBy,
            };
          }
        })
      );

      // (b) Live TheMealDB search.
      let onlineItems: Top10Item[] = [];
      try {
        const meals = (await fetchMeals(`${MEALDB}/search.php?s=${encodeURIComponent(dish)}`)).slice(0, 8);
        onlineItems = meals
          .filter((meal) => continentFilter === "all" || AREA_TO_CONTINENT[meal.strArea || ""] === continentFilter)
          .map((meal) => ({
            mealId: meal.idMeal || meal.strMeal || "meal",
            name: meal.strMeal || "Online Recipe",
            category: meal.strCategory || "Recipe",
            area: meal.strArea || "World",
            thumb: meal.strMealThumb || "",
            emoji: "🍽️",
            isTopChef: false,
          }));
      } catch {
        onlineItems = [];
      }

      if (seq !== searchSeqRef.current) return; // a newer search superseded this one

      const seen = new Set<string>();
      const merged = [...curatedItems, ...onlineItems].filter((item) => {
        if (seen.has(item.mealId)) return false;
        seen.add(item.mealId);
        // Never offer the exact online recipe the user already rejected
        // with "Not This" — a different chef's version stays available.
        return !excludeMealIds.includes(item.mealId);
      });
      const rank = (item: Top10Item) =>
        (cuisineFilter !== "Any" && item.area === cuisineFilter ? 2 : 0) + (item.isTopChef ? 1 : 0);
      merged.sort((a, b) => rank(b) - rank(a));
      setItems(merged.slice(0, 10));
      setStage(destination);
    } catch {
      if (seq !== searchSeqRef.current) return;
      setItems([]);
      setError("Online search couldn't be reached. You can still pick a Top Chef above or confirm our Universal recipe below.");
      setStage(destination);
    } finally {
      if (seq === searchSeqRef.current) setFetching(false);
    }
  }

  function fetchTop10() {
    const dish = parsedQuery || parseDishQuery(query);
    if (!dish) return;
    playPop();
    void runOnlineSearch({
      dish,
      continentFilter: continent,
      cuisineFilter: cuisine,
      excludeMealIds: rejectedMealIds,
      destination: "top10",
    });
  }

  /** AI Top-Chef mode: re-search online recipes tuned to the chef region. */
  function startAiChefSearch(dish: string, region: ChefRegionId, excludeMealIds: string[]) {
    const params = regionSearchParams(region);
    void runOnlineSearch({
      dish,
      continentFilter: params.continent,
      // Honour a cuisine the user explicitly picked in "clarify" for ranking.
      cuisineFilter: params.cuisine !== "Any" ? params.cuisine : cuisine,
      excludeMealIds,
      destination: "aiChefs",
    });
  }

  function changeChefRegion(region: ChefRegionId) {
    playPop();
    setChefRegion(region);
    const dish = parsedQuery || parseDishQuery(query);
    if (dish) startAiChefSearch(dish, region, rejectedMealIds);
  }

  function handleAiDishSearch() {
    const parsed = parseDishQuery(query);
    if (!parsed) return;
    playPop();
    setParsedQuery(parsed);
    if (parsed !== query.trim()) setQuery(parsed);
    const region = detectChefRegion(parsed, { cuisine, continent });
    setChefRegion(region);
    startAiChefSearch(parsed, region, rejectedMealIds);
  }

  async function loadRecipe(item: Top10Item) {
    playPop();
    setLoadingMealId(item.mealId);
    setError("");
    const from = stage === "aiChefs" ? "aiChefs" : "top10";
    try {
      let meal: MealDbMeal | undefined;
      if (/^\d+$/.test(item.mealId)) {
        meal = (await fetchMeals(`${MEALDB}/lookup.php?i=${encodeURIComponent(item.mealId)}`))[0];
      }
      if (!meal) {
        meal = (await fetchMeals(`${MEALDB}/search.php?s=${encodeURIComponent(item.name)}`))[0];
      }
      if (meal) {
        setCandidate(buildRecipeFromMeal(meal, item));
      } else {
        const fallback = findRecipe(item.name);
        setCandidate({
          ...fallback,
          image: item.thumb || fallback.image,
          source: item.inspiredBy ? `Inspired by ${item.inspiredBy}` : fallback.source ?? "Chef Universe",
          confidence: 60,
          isOnline: Boolean(item.thumb),
          mealId: item.mealId,
        });
      }
      setConfirmFrom(from);
      setStage("confirm");
    } catch {
      const fallback = findRecipe(item.name);
      setCandidate({
        ...fallback,
        image: item.thumb || fallback.image,
        source: item.inspiredBy ? `Inspired by ${item.inspiredBy}` : fallback.source ?? "Chef Universe",
        confidence: 60,
        isOnline: false,
        mealId: item.mealId,
      });
      setConfirmFrom(from);
      setStage("confirm");
    } finally {
      setLoadingMealId(null);
    }
  }

  function chefStyleFallback(chef: FamousChef, dish: string, chefFields: Partial<FoundRecipe>): FoundRecipe {
    const base = findRecipe(dish);
    // If the built-in version is the very recipe the user rejected, don't
    // dress it up as a "new" chef recipe — offer the honest Universal one.
    const usable = isRejectedName(base.name, rejectedNames) ? generateGenericRecipe(dish) : base;
    return {
      ...usable,
      ...chefFields,
      source: `${chef.name} style (${chef.flag} ${chef.countryLabel}) — in-app version inspired by ${chef.name}`,
      confidence: 60,
      isOnline: false,
    };
  }

  /**
   * The user picked one of the famous-chef options. Find the best in-app
   * version in that chef's regional style (TheMealDB, preferring the chef's
   * cuisine and skipping rejected dishes), then show the SAME confirmation
   * gate as every other recipe — nothing loads without "✓ Yes".
   */
  async function chooseChef(chef: FamousChef) {
    const dish = parsedQuery || parseDishQuery(query);
    if (!dish) return;
    playPop();
    setLoadingChefId(chef.id);
    setError("");
    const chefFields: Partial<FoundRecipe> = {
      chefId: chef.id,
      chefName: chef.name,
      chefCountry: `${chef.flag} ${chef.countryLabel}`,
      chefWebsiteSearchUrl: chefWebsiteSearchUrl(chef, dish) ?? undefined,
      chefYouTubeSearchUrl: chefYouTubeSearchUrl(chef, dish),
    };
    try {
      const meals = await fetchMeals(`${MEALDB}/search.php?s=${encodeURIComponent(dish)}`);
      const usable = meals.filter((meal) => !rejectedMealIds.includes(meal.idMeal || ""));
      const meal = usable.find((m) => chef.cuisines.includes(m.strArea || "")) ?? usable[0];
      if (meal) {
        const item: Top10Item = {
          mealId: meal.idMeal || meal.strMeal || "meal",
          name: meal.strMeal || dish,
          category: meal.strCategory || "Recipe",
          area: meal.strArea || chef.countryLabel,
          thumb: meal.strMealThumb || "",
          emoji: chef.emoji,
          isTopChef: true,
          inspiredBy: `${chef.name}'s ${chef.countryLabel} style`,
        };
        const built = buildRecipeFromMeal(meal, item);
        setCandidate({
          ...built,
          ...chefFields,
          source: `${chef.name} style (${chef.flag} ${chef.countryLabel}) — in-app version inspired by ${chef.name} • Video: TheMealDB Kitchen`,
          confidence: 85,
        });
      } else {
        setCandidate(chefStyleFallback(chef, dish, chefFields));
      }
    } catch {
      setCandidate(chefStyleFallback(chef, dish, chefFields));
    } finally {
      setLoadingChefId(null);
    }
    setConfirmFrom("aiChefs");
    setStage("confirm");
  }

  function useUniversal() {
    const dish = parsedQuery || parseDishQuery(query);
    const generic = findRecipe(dish || "something yummy");
    setCandidate({ ...generic, confidence: 50, isOnline: false, source: "Universal Chef Template" });
    setConfirmFrom(stage === "aiChefs" ? "aiChefs" : "top10");
    setStage("confirm");
  }

  function confirmYes() {
    if (!candidate) return;
    playDing();
    setStage("loading");
    window.setTimeout(() => {
      setSavedCount(saveRecipeToStorage(candidate));
      onRecipeFound(candidate);
    }, 900);
  }

  /**
   * "❌ Not This" → AI Top-Chef mode. Remember what was rejected (never show
   * it again), work out the dish's region/country, then display the famous
   * chefs for that region (1. Food Fusion, 2. Ranveer Brar, …) alongside
   * fresh online recipes for the user to choose from.
   */
  function notThis() {
    playPop();
    const dish = parsedQuery || parseDishQuery(query) || candidate?.name || "";
    const updatedRejected = candidate
      ? Array.from(new Set([...rejectedNames, candidate.name].map((n) => n.trim()).filter(Boolean)))
      : rejectedNames;
    setRejectedNames(updatedRejected);
    const updatedMealIds = candidate?.mealId
      ? Array.from(new Set([...rejectedMealIds, candidate.mealId]))
      : rejectedMealIds;
    setRejectedMealIds(updatedMealIds);
    if (candidate?.chefId) {
      setTriedChefIds((prev) => (prev.includes(candidate.chefId!) ? prev : [...prev, candidate.chefId!]));
    }
    setCandidate(null);
    // If we're already coming from AI mode, keep the region the user chose.
    const region = confirmFrom === "aiChefs" ? chefRegion : detectChefRegion(dish, { cuisine, continent });
    setChefRegion(region);
    setItems([]);
    setStage("aiChefs");
    if (dish) startAiChefSearch(dish, region, updatedMealIds);
  }

  // Opened straight into AI mode (e.g. from the recipe page): kick off the
  // same AI Top-Chef search the "Not This" button runs.
  useEffect(() => {
    if (!startInAi || autoSearchedRef.current) return;
    autoSearchedRef.current = true;
    const region = detectChefRegion(initialParsed);
    setChefRegion(region);
    startAiChefSearch(initialParsed, region, rejectedMealId ? [rejectedMealId] : []);
    // Run once on mount only — later searches are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderMealItems() {
    if (items.length === 0) {
      return (
        <p className="py-4 text-center text-sm font-bold text-slate-500">
          {fetching
            ? "🤖 AI Chef is searching online recipes for you…"
            : "No online matches this time. Our Universal Chef can still build a step-by-step recipe for you!"}
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((item, index) => (
          <button
            key={`${item.mealId}-${item.name}`}
            type="button"
            disabled={loadingMealId !== null}
            onClick={() => { void loadRecipe(item); }}
            className="flex w-full items-center gap-3 rounded-2xl bg-orange-50 p-2.5 text-left ring-1 ring-orange-100 transition hover:bg-orange-100 active:scale-[0.99] disabled:opacity-50"
          >
            {item.thumb ? (
              <img src={item.thumb} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-2xl" aria-hidden="true">{item.emoji}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-black text-slate-800">#{index + 1}. {item.name}</span>
              <span className="block truncate text-xs font-bold text-slate-500">
                {item.category} • {item.area}{item.isTopChef ? " ⭐ Top Chef" : ""}
              </span>
            </span>
            <span className="shrink-0 font-black text-orange-500">{loadingMealId === item.mealId ? "⏳" : "→"}</span>
          </button>
        ))}
      </div>
    );
  }

  const lastRejected = rejectedNames[rejectedNames.length - 1];
  const visibleChefs = rankedChefs.slice(0, chefRegion === "all" ? 8 : 6);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="AI Smart Chef Search">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-800">🔮 AI Smart Chef Search</h3>
            <p className="text-xs font-bold text-slate-500">Type any dish — or paste a recipe website link!</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1.5 font-black text-slate-600 transition hover:bg-slate-200 active:scale-95" aria-label="Close search">
            ✕
          </button>
        </div>

        {stage === "search" && (
          <div className="space-y-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleFind(); }}
              placeholder="e.g. tres leches cake — or paste a recipe URL"
              className="w-full rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 py-3 text-base font-bold outline-none focus:border-orange-400"
              aria-label="What would you like to cook?"
            />
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Where in the world?</p>
              <div className="flex flex-wrap gap-2">
                {CONTINENTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { playPop(); setContinent(c.id); }}
                    className={`rounded-full px-3 py-2 text-sm font-extrabold transition active:scale-95 ${continent === c.id ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleFind}
              disabled={!query.trim()}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 py-3 text-base font-black text-white shadow-lg transition active:scale-95 disabled:opacity-40"
            >
              Find My Recipe 🔍
            </button>
            <p className="text-center text-xs font-bold text-slate-400">💾 {savedCount} custom recipe{savedCount === 1 ? "" : "s"} saved</p>
          </div>
        )}

        {stage === "clarify" && (
          <div className="space-y-4">
            <p className="text-center font-bold text-slate-700">
              Let&apos;s find <span className="text-orange-600">“{parsedQuery || query}”</span> online with our Top Chefs! Which cuisine style sounds yummy?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CUISINES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { playPop(); setCuisine(c.id); }}
                  className={`rounded-2xl px-3 py-3 text-sm font-extrabold transition active:scale-95 ${cuisine === c.id ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { void fetchTop10(); }}
              disabled={fetching}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 py-3 font-black text-white shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              {fetching ? "Searching Top Chefs… ⏳" : "Show Top 10 Chef Results →"}
            </button>
            <button type="button" onClick={() => setStage("search")} className="w-full rounded-2xl bg-white py-2 font-bold text-slate-500 ring-1 ring-slate-200 transition active:scale-95">
              ← Back to Search
            </button>
          </div>
        )}

        {stage === "top10" && (
          <div className="space-y-3">
            <p className="text-center font-black text-slate-700">🏆 Top {items.length || 10} Chef Results — tap ONE!</p>
            {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-700">{error}</p>}
            {renderMealItems()}
            <button type="button" onClick={useUniversal} className="w-full rounded-2xl bg-sky-50 py-2.5 text-sm font-extrabold text-sky-700 ring-1 ring-sky-200 transition active:scale-95">
              ✨ Use Universal Chef Recipe Instead
            </button>
            <button type="button" onClick={() => setStage("clarify")} className="w-full rounded-2xl bg-white py-2 font-bold text-slate-500 ring-1 ring-slate-200 transition active:scale-95">
              ← Back
            </button>
          </div>
        )}

        {stage === "aiChefs" && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 p-4 text-center text-white shadow-lg">
              <p className="text-lg font-black">🤖 AI Top-Chef Mode</p>
              <p className="mt-1 text-sm font-semibold text-white/90">
                {lastRejected ? (
                  <>No worries — <span className="font-black">“{lastRejected}”</span> wasn&apos;t right, so we won&apos;t show it again. </>
                ) : null}
                Here are the famous chefs for <span className="font-black">“{dishForChefs || "your dish"}”</span> from{" "}
                <span className="font-black">{chefRegionLabel(chefRegion)}</span> — pick your favourite!
              </p>
            </div>

            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAiDishSearch(); }}
                placeholder="Dish name — fix it here if we got it wrong!"
                className="min-w-0 flex-1 rounded-2xl border-2 border-fuchsia-200 bg-fuchsia-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-fuchsia-400"
                aria-label="Dish to search Top Chefs for"
              />
              <button
                type="button"
                onClick={handleAiDishSearch}
                disabled={!query.trim()}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2.5 text-sm font-black text-white shadow transition active:scale-95 disabled:opacity-40"
              >
                🤖 Search
              </button>
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Region &amp; country</p>
              <div className="flex flex-wrap gap-1.5">
                {CHEF_REGIONS.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => changeChefRegion(region.id)}
                    aria-pressed={chefRegion === region.id}
                    className={`rounded-full px-2.5 py-1.5 text-xs font-extrabold transition active:scale-95 ${chefRegion === region.id ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {region.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-700">{error}</p>}

            <section aria-label="Famous top chefs for this dish">
              <h4 className="font-black text-slate-800">⭐ Famous Top Chefs — choose one!</h4>
              <p className="mb-3 mt-0.5 text-xs font-bold text-slate-400">
                “Cook in the App” makes an in-app version inspired by that chef&apos;s style. For their exact original
                recipe, use their official website / YouTube search — with a grown-up! 🧑‍🤝‍🧑
              </p>
              {visibleChefs.length === 0 ? (
                <p className="py-3 text-center text-sm font-bold text-slate-500">No famous chefs listed for this region yet — try 🌍 All Top Chefs!</p>
              ) : (
                <div className="space-y-2.5">
                  {visibleChefs.map((chef, index) => {
                    const websiteUrl = chefWebsiteSearchUrl(chef, dishForChefs);
                    const tried = triedChefIds.includes(chef.id);
                    return (
                      <div key={chef.id} className="rounded-3xl bg-gradient-to-br from-orange-50 to-pink-50 p-3 ring-1 ring-orange-100">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-sm font-black text-white shadow" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm" aria-hidden="true">{chef.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-black text-slate-800">
                              {chef.name} <span className="font-bold text-slate-500">{chef.flag} {chef.countryLabel}</span>
                            </span>
                            <span className="block text-xs font-semibold leading-snug text-slate-500">{chef.specialty}</span>
                          </span>
                          {tried && (
                            <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-[10px] font-black text-slate-500">↩️ Tried</span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={loadingChefId !== null}
                          onClick={() => { void chooseChef(chef); }}
                          className="mt-2.5 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 py-2.5 text-sm font-black text-white shadow transition active:scale-95 disabled:opacity-50"
                        >
                          {loadingChefId === chef.id ? `⏳ Asking ${chef.name}…` : `👩‍🍳 Cook ${chef.name} Style in the App`}
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {websiteUrl && (
                            <a
                              href={websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 rounded-xl bg-white px-3 py-2 text-center text-xs font-extrabold text-sky-700 ring-1 ring-sky-200 transition active:scale-95"
                            >
                              🌐 Search {chef.name}&apos;s Website
                            </a>
                          )}
                          <a
                            href={chefYouTubeSearchUrl(chef, dishForChefs)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 rounded-xl bg-white px-3 py-2 text-center text-xs font-extrabold text-red-600 ring-1 ring-red-200 transition active:scale-95"
                          >
                            📺 Search on YouTube
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section aria-label="More online recipes">
              <h4 className="mb-2 font-black text-slate-800">
                🍽️ More Recipes We Found Online {fetching ? <span className="text-xs font-bold text-fuchsia-500">(🤖 searching…)</span> : null}
              </h4>
              {renderMealItems()}
            </section>

            <button type="button" onClick={useUniversal} className="w-full rounded-2xl bg-sky-50 py-2.5 text-sm font-extrabold text-sky-700 ring-1 ring-sky-200 transition active:scale-95">
              ✨ Use Universal Chef Recipe Instead
            </button>
            <button type="button" onClick={() => setStage("search")} className="w-full rounded-2xl bg-white py-2 font-bold text-slate-500 ring-1 ring-slate-200 transition active:scale-95">
              🔍 Try a Different Dish
            </button>
          </div>
        )}

        {stage === "confirm" && candidate && (
          <div className="space-y-4">
            <div className="text-center">
              <span className={`inline-block rounded-full px-3 py-1.5 text-sm font-black text-white shadow ${candidate.isOnline ? "bg-sky-500" : "bg-emerald-500"}`}>
                {candidate.isOnline ? "Recipe Found Online!" : "Recipe Found Inside App!"}
              </span>
              <p className="mt-1.5 text-xs font-bold text-slate-500">
                {candidate.source ?? "Chef Universe"}{typeof candidate.confidence === "number" ? ` • ${Math.round(candidate.confidence)}% confidence` : ""}
              </p>
            </div>
            {candidate.image ? (
              <img src={candidate.image} alt={candidate.name} className="max-h-56 w-full rounded-2xl object-cover shadow" loading="lazy" />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-pink-100 text-6xl shadow-inner" aria-hidden="true">{candidate.emoji}</div>
            )}
            <h4 className="text-center text-2xl font-black text-slate-800">{candidate.name}</h4>
            <div className="flex flex-wrap justify-center gap-2 text-xs font-extrabold">
              <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-700">⏱️ {candidate.time}</span>
              <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-700">📊 {candidate.difficulty}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">🍽️ {candidate.servings}</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">You&apos;ll need…</p>
              <ul className="space-y-1 text-sm font-semibold text-slate-700">
                {candidate.ingredients.slice(0, 4).map((ing, i) => (
                  <li key={i}>• {ing}</li>
                ))}
              </ul>
              {candidate.ingredients.length > 4 && (
                <p className="mt-1 text-xs font-bold text-slate-400">+{candidate.ingredients.length - 4} more…</p>
              )}
            </div>
            {candidate.chefName && (
              <div className="rounded-2xl bg-fuchsia-50 p-3 ring-1 ring-fuchsia-200">
                <p className="text-sm font-black text-fuchsia-800">⭐ {candidate.chefName} style {candidate.chefCountry ? `• ${candidate.chefCountry}` : ""}</p>
                <p className="mt-0.5 text-xs font-semibold text-fuchsia-700">
                  This in-app version is inspired by {candidate.chefName}&apos;s cooking. Want their exact original? Search with a grown-up:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {candidate.chefWebsiteSearchUrl && (
                    <a href={candidate.chefWebsiteSearchUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-white px-3 py-2 text-center text-xs font-extrabold text-sky-700 ring-1 ring-sky-200 transition active:scale-95">
                      🌐 {candidate.chefName}&apos;s Website
                    </a>
                  )}
                  {candidate.chefYouTubeSearchUrl && (
                    <a href={candidate.chefYouTubeSearchUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-white px-3 py-2 text-center text-xs font-extrabold text-red-600 ring-1 ring-red-200 transition active:scale-95">
                      📺 {candidate.chefName} on YouTube
                    </a>
                  )}
                </div>
              </div>
            )}
            {candidate.youtubeVideo && <YouTubePlayer youtubeIdOrUrl={candidate.youtubeVideo} title={candidate.name} />}
            <p className="text-center text-lg font-black text-slate-800">Is this the recipe you&apos;re looking for?</p>
            <p className="-mt-2 text-center text-xs font-bold text-slate-400">
              Wrong one? Tap <span className="font-black text-red-500">❌ Not This</span> and our 🤖 AI will search famous Top Chefs
              (Food Fusion 🇵🇰, Ranveer Brar 🇮🇳 &amp; more) from the right region &amp; country!
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={notThis} className="rounded-2xl bg-white py-3 font-black text-red-500 ring-2 ring-red-200 transition hover:bg-red-50 active:scale-95">
                ❌ Not This
              </button>
              <button type="button" onClick={confirmYes} className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 py-3 font-black text-white shadow-lg transition active:scale-95">
                ✓ Yes, That&apos;s Exactly It!
              </button>
            </div>
          </div>
        )}

        {stage === "loading" && (
          <div className="space-y-3 py-10 text-center">
            <div className="animate-bounce text-6xl" aria-hidden="true">👨‍🍳</div>
            <p className="text-lg font-black text-slate-700">Saving your recipe… ✨</p>
            <p className="text-sm font-bold text-slate-400">Getting your kitchen ready!</p>
          </div>
        )}
      </div>
    </div>
  );
}
