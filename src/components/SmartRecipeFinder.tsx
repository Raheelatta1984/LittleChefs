import { useState } from "react";
import { findRecipe, type Recipe } from "../data/recipes";
import { AREA_TO_CONTINENT, CONTINENTS, getTopRecipesByContinent, type ContinentId } from "../data/topChefs";
import { YouTubePlayer } from "./YouTubePlayer";
import { playDing, playPop } from "../utils/audio";

export type FoundRecipe = Recipe & {
  confidence?: number;
  isOnline?: boolean;
};

type Stage = "search" | "clarify" | "top10" | "confirm" | "loading";

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
  };
}

type SmartRecipeFinderProps = {
  initialQuery: string;
  onClose: () => void;
  onRecipeFound: (recipe: FoundRecipe) => void;
};

// THE ONLY search in the app.
// NUMBER ONE RULE: never load a recipe until the user taps "✓ Yes, That's Exactly It!"
export function SmartRecipeFinder({ initialQuery, onClose, onRecipeFound }: SmartRecipeFinderProps) {
  const [stage, setStage] = useState<Stage>("search");
  const [query, setQuery] = useState(initialQuery);
  const [parsedQuery, setParsedQuery] = useState("");
  const [continent, setContinent] = useState<ContinentId>("all");
  const [cuisine, setCuisine] = useState("Any");
  const [items, setItems] = useState<Top10Item[]>([]);
  const [candidate, setCandidate] = useState<FoundRecipe | null>(null);
  const [confirmFrom, setConfirmFrom] = useState<"search" | "top10">("search");
  const [fetching, setFetching] = useState(false);
  const [loadingMealId, setLoadingMealId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(readSavedCount);
  const [error, setError] = useState("");

  function handleFind() {
    const parsed = parseDishQuery(query);
    if (!parsed) return;
    playPop();
    setError("");
    setParsedQuery(parsed);
    if (parsed !== query.trim()) setQuery(parsed);
    const found = findRecipe(parsed);
    if (!found.isGeneric) {
      setCandidate({
        ...found,
        confidence: 100,
        isOnline: false,
        source: found.source ?? "Built-in Chef Universe Recipe",
      });
      setConfirmFrom("search");
      setStage("confirm");
    } else {
      setStage("clarify");
    }
  }

  async function fetchTop10() {
    const dish = parsedQuery || parseDishQuery(query);
    if (!dish) return;
    playPop();
    setFetching(true);
    setError("");
    try {
      const dishWords = dish.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      // (a) Curated Top-10 chef recipes, filtered by continent + name-matching, resolved live.
      const curated = getTopRecipesByContinent(continent).filter((entry) => {
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
          .filter((meal) => continent === "all" || AREA_TO_CONTINENT[meal.strArea || ""] === continent)
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

      const seen = new Set<string>();
      const merged = [...curatedItems, ...onlineItems].filter((item) => {
        if (seen.has(item.mealId)) return false;
        seen.add(item.mealId);
        return true;
      });
      const rank = (item: Top10Item) =>
        (cuisine !== "Any" && item.area === cuisine ? 2 : 0) + (item.isTopChef ? 1 : 0);
      merged.sort((a, b) => rank(b) - rank(a));
      setItems(merged.slice(0, 10));
      setStage("top10");
    } catch {
      setItems([]);
      setError("Online search couldn't be reached. You can still confirm our Universal recipe below.");
      setStage("top10");
    } finally {
      setFetching(false);
    }
  }

  async function loadRecipe(item: Top10Item) {
    playPop();
    setLoadingMealId(item.mealId);
    setError("");
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
        });
      }
      setConfirmFrom("top10");
      setStage("confirm");
    } catch {
      const fallback = findRecipe(item.name);
      setCandidate({
        ...fallback,
        image: item.thumb || fallback.image,
        source: item.inspiredBy ? `Inspired by ${item.inspiredBy}` : fallback.source ?? "Chef Universe",
        confidence: 60,
        isOnline: false,
      });
      setConfirmFrom("top10");
      setStage("confirm");
    } finally {
      setLoadingMealId(null);
    }
  }

  function useUniversal() {
    const dish = parsedQuery || parseDishQuery(query);
    const generic = findRecipe(dish || "something yummy");
    setCandidate({ ...generic, confidence: 50, isOnline: false, source: "Universal Chef Template" });
    setConfirmFrom("top10");
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

  function notThis() {
    playPop();
    setStage(confirmFrom === "top10" && items.length > 0 ? "top10" : "search");
  }

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
            {items.length === 0 ? (
              <p className="py-4 text-center text-sm font-bold text-slate-500">No online matches this time. Our Universal Chef can still build a step-by-step recipe for you!</p>
            ) : (
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
            )}
            <button type="button" onClick={useUniversal} className="w-full rounded-2xl bg-sky-50 py-2.5 text-sm font-extrabold text-sky-700 ring-1 ring-sky-200 transition active:scale-95">
              ✨ Use Universal Chef Recipe Instead
            </button>
            <button type="button" onClick={() => setStage("clarify")} className="w-full rounded-2xl bg-white py-2 font-bold text-slate-500 ring-1 ring-slate-200 transition active:scale-95">
              ← Back
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
            {candidate.youtubeVideo && <YouTubePlayer youtubeIdOrUrl={candidate.youtubeVideo} title={candidate.name} />}
            <p className="text-center text-lg font-black text-slate-800">Is this the recipe you&apos;re looking for?</p>
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
