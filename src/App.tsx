import { useEffect, useMemo, useRef, useState } from "react";
import { findRecipe, suggestionChips, type Recipe } from "./data/recipes";
import {
  NEW_RECIPE_COST,
  POINTS_PER_RECIPE,
  type Buddy,
  type PlayerState,
  type RoomItem,
} from "./data/rewards";
import {
  SmartRecipeFinder,
  type FoundRecipe,
  type OpenBrowserRequest,
} from "./components/SmartRecipeFinder";
import { YouTubePlayer } from "./components/YouTubePlayer";
import { RewardsHub } from "./components/RewardsHub";
import { InteractiveCookingWidget } from "./components/InteractiveWidget";
import { AvatarButton, CSSCharacter } from "./components/CSSCharacter";
import { playDing, playPop, playSuccess, speakText, stopSpeaking } from "./utils/audio";
import { api, ApiClientError, loadAuth, saveAuth, type AuthState } from "./lib/api";
import { viewToLegacy } from "./lib/adapters";
import { ChefGate } from "./components/ChefGate";
import { MyRecipes } from "./components/MyRecipes";
import { DbRecipeDetail } from "./components/DbRecipeDetail";
import { RecipeImporter } from "./components/RecipeImporter";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { InternalMatches } from "./components/InternalMatches";
import { InAppBrowser, type BrowserImportPayload } from "./components/InAppBrowser";
import { WhatsNewTab } from "./components/WhatsNewTab";
import { hasUnseenWhatsNew, type WhatsNewAction } from "./data/whatsNew";
import type {
  ChefProfile, OnboardingResult, RecipeDraft, RecipeView, RoleId, SearchResponse,
} from "../shared/types";

type Screen =
  | "welcome"
  | "kitchen"
  | "whatsNew"
  | "recipe"
  | "cooking"
  | "done"
  | "rewards"
  | "myRecipes"
  | "dbRecipe"
  | "onboarding";

type WelcomeCharacter = {
  id: string;
  name: string;
  title: string;
  image: string;
  emoji: string;
};

const CHARACTERS: WelcomeCharacter[] = [
  { id: "girl1", name: "Sunny", title: "Braided Chef", image: "/images/characters/girl1.jpg", emoji: "👧" },
  { id: "girl2", name: "Rosie", title: "Bow Chef", image: "/images/characters/girl2.jpg", emoji: "🎀" },
  { id: "girl3", name: "Coco", title: "Curly Chef", image: "/images/characters/girl3.jpg", emoji: "👩🏾‍🍳" },
  { id: "boy1", name: "Leo", title: "Spiky Chef", image: "/images/characters/boy1.jpg", emoji: "👦" },
  { id: "char1", name: "Elfy", title: "Forest Elf Chef", image: "/images/characters/char1.jpg", emoji: "🧝" },
  { id: "char4", name: "Hero", title: "Superhero Chef", image: "/images/characters/char4.jpg", emoji: "🦸" },
];

const CHEF_LEVELS = [
  { id: "little", label: "Little Chef", ages: "5–9", emoji: "🧒" },
  { id: "junior", label: "Junior Chef", ages: "10–14", emoji: "👦" },
  { id: "teen", label: "Teen Chef", ages: "15–19", emoji: "🧑" },
  { id: "home", label: "Home Chef", ages: "Adults", emoji: "👨‍🍳" },
  { id: "master", label: "Master Chef", ages: "Pro", emoji: "👩‍🍳" },
];

const PLAYER_STORAGE_KEY = "chefUniverse";
const DEFAULT_PLAYER: PlayerState = { points: 0, ownedItems: [], myCharacter: null, awardedRecipes: [] };

function loadPlayer(): PlayerState {
  try {
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYER;
    const parsed = JSON.parse(raw) as Partial<PlayerState>;
    return {
      points: typeof parsed.points === "number" ? parsed.points : 0,
      ownedItems: Array.isArray(parsed.ownedItems) ? parsed.ownedItems.filter((x): x is string => typeof x === "string") : [],
      myCharacter: parsed.myCharacter && typeof parsed.myCharacter === "object" ? (parsed.myCharacter as Buddy) : null,
      awardedRecipes: Array.isArray(parsed.awardedRecipes) ? parsed.awardedRecipes.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return DEFAULT_PLAYER;
  }
}

function difficultyColor(d: Recipe["difficulty"]) {
  if (d === "Super Easy") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (d === "Easy") return "bg-sky-100 text-sky-700 border-sky-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function mapLevelToRole(levelId: string): RoleId {
  if (levelId === "teen") return "teen";
  if (levelId === "home") return "adult";
  if (levelId === "master") return "master";
  return "junior";
}

export default function App() {
  const [history, setHistory] = useState<Screen[]>(["welcome"]);
  const screen: Screen = history[history.length - 1] ?? "welcome";

  const [characterId, setCharacterId] = useState(CHARACTERS[0].id);
  const selectedCharacter = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
  const [name, setName] = useState("");
  const [levelId, setLevelId] = useState(CHEF_LEVELS[0].id);
  const selectedLevel = CHEF_LEVELS.find((l) => l.id === levelId) ?? CHEF_LEVELS[0];
  const [shakeName, setShakeName] = useState(false);

  const [player, setPlayer] = useState<PlayerState>(loadPlayer);
  const [foodQuery, setFoodQuery] = useState("");
  const [finderQuery, setFinderQuery] = useState("");
  const [finderMode, setFinderMode] = useState<"search" | "aiChefs">("search");
  const [finderRejectedRecipe, setFinderRejectedRecipe] = useState<string | undefined>(undefined);
  const [finderRejectedMealId, setFinderRejectedMealId] = useState<string | undefined>(undefined);
  const [showSmartFinder, setShowSmartFinder] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showHonestyModal, setShowHonestyModal] = useState(false);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(false);

  // --- Private kitchen (Postgres-backed, role scoped) ---
  const [auth, setAuth] = useState<AuthState | null>(loadAuth);
  const chef: ChefProfile | null = auth?.chef ?? null;
  const [showChefGate, setShowChefGate] = useState(false);
  const [myRecipes, setMyRecipes] = useState<RecipeView[]>([]);
  const [myRecipesLoading, setMyRecipesLoading] = useState(false);
  const [myRecipesError, setMyRecipesError] = useState<string | null>(null);
  const [dbRecipe, setDbRecipe] = useState<RecipeView | null>(null);
  const [deletingRecipe, setDeletingRecipe] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [importerQuery, setImporterQuery] = useState("");
  const [importerAutoStart, setImporterAutoStart] = useState(false);
  const [importerAllowFallback, setImporterAllowFallback] = useState(false);
  const [importerDraftHint, setImporterDraftHint] = useState<RecipeDraft | null>(null);
  const [onboardingRecipe, setOnboardingRecipe] = useState<RecipeView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [browserState, setBrowserState] = useState<OpenBrowserRequest | null>(null);
  const [unseenWhatsNew, setUnseenWhatsNew] = useState<boolean>(hasUnseenWhatsNew);
  const pendingAuthActionRef = useRef<((authed: AuthState) => void) | null>(null);

  const chefName = name.trim() || chef?.displayName || "Little Chef";

  const progress = useMemo(() => {
    if (!recipe) return 0;
    return Math.round(((stepIndex + 1) / recipe.steps.length) * 100);
  }, [recipe, stepIndex]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    } catch {
      // storage unavailable — gameplay continues without persistence
    }
  }, [player]);

  useEffect(() => {
    stopSpeaking();
    setIsSpeaking(false);
  }, [screen, stepIndex]);

  // --- Navigation: history stack (Home never replaces Back) ---
  function navigate(to: Screen) {
    setHistory((h) => (h[h.length - 1] === to ? h : [...h, to]));
  }
  function goBack() {
    playPop();
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }
  function goHome() {
    playPop();
    setHistory(["kitchen"]);
  }

  async function ensureChefAuth(afterAuth?: (authed: AuthState) => void): Promise<AuthState | null> {
    if (auth) {
      afterAuth?.(auth);
      return auth;
    }

    const rawName = name.trim();
    const displayName = rawName.length >= 2 ? rawName.slice(0, 40) : rawName ? `Chef ${rawName}` : "Little Chef";
    const role = mapLevelToRole(levelId);

    try {
      let next: AuthState;
      try {
        next = await api.createChef({ displayName, role, avatar: characterId, pin: null });
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 409) {
          next = await api.signIn({ displayName, role, pin: null });
        } else {
          throw err;
        }
      }
      saveAuth(next);
      setAuth(next);
      setPlayer((p) => ({ ...p, points: Math.max(p.points, next.chef.points) }));
      try {
        setMyRecipes(await api.listRecipes(next.token));
      } catch {
        /* ignore */
      }
      afterAuth?.(next);
      return next;
    } catch {
      if (afterAuth) {
        pendingAuthActionRef.current = afterAuth;
      }
      setShowChefGate(true);
      return null;
    }
  }

  function openInternalBrowser(request: OpenBrowserRequest) {
    playPop();
    setShowSmartFinder(false);
    setSearchResult(null);
    setShowImporter(false);
    setBrowserState(request);
  }

  function openAiImporter(options?: {
    query?: string;
    autoStart?: boolean;
    allowFallback?: boolean;
    draftHint?: RecipeDraft | null;
  }) {
    playPop();
    void ensureChefAuth(() => {
      setImporterQuery(options?.query ?? "");
      setImporterAutoStart(Boolean(options?.autoStart));
      setImporterAllowFallback(Boolean(options?.allowFallback));
      setImporterDraftHint(options?.draftHint ?? null);
      setShowImporter(true);
    });
  }

  function handleBrowserImport(payload: BrowserImportPayload) {
    setBrowserState(null);
    openAiImporter({
      query: payload.inputValue,
      autoStart: true,
      allowFallback: true,
      draftHint: payload.draftHint ?? null,
    });
  }

  function handleWhatsNewAction(action: WhatsNewAction) {
    if (action === "open-browser") {
      openInternalBrowser({ query: foodQuery || "Chicken Biryani", tab: "website" });
      return;
    }
    if (action === "open-youtube-browser") {
      openInternalBrowser({ query: foodQuery || "Chicken Biryani", tab: "youtube" });
      return;
    }
    if (action === "open-importer") {
      openAiImporter({ query: foodQuery });
      return;
    }
    if (action === "open-my-recipes") {
      void ensureChefAuth((authed) => {
        void api.listRecipes(authed.token).then(setMyRecipes).catch(() => {});
        navigate("myRecipes");
      });
      return;
    }
    if (action === "open-smart-finder") {
      void openFinder(foodQuery);
      return;
    }
    if (action === "open-rewards") {
      navigate("rewards");
    }
  }

  function handleStart() {
    if (!name.trim()) {
      setShakeName(true);
      playDing();
      window.setTimeout(() => setShakeName(false), 500);
      return;
    }
    playPop();
    navigate("kitchen");
    if (!auth) {
      void ensureChefAuth();
    }
  }

  // --- Internal-first search, then AI ---
  async function openFinder(prefill: string) {
    playPop();
    setFinderQuery(prefill);
    setFinderMode("search");
    setFinderRejectedRecipe(undefined);
    setFinderRejectedMealId(undefined);

    if (chef && prefill.trim().length > 1) {
      try {
        const result = await api.search(auth!.token, prefill.trim());
        setSearchResult(result);
        return;
      } catch {
        // API unreachable — fall back to the online finder below
      }
    }
    setShowSmartFinder(true);
  }

  function openOnlineFinder() {
    setSearchResult(null);
    setFinderMode("search");
    setShowSmartFinder(true);
  }

  async function refreshMyRecipes() {
    if (!auth) return;
    setMyRecipesLoading(true);
    setMyRecipesError(null);
    try {
      setMyRecipes(await api.listRecipes(auth.token));
    } catch (error) {
      setMyRecipesError(
        error instanceof ApiClientError ? error.message : "Could not open your recipe book.",
      );
    } finally {
      setMyRecipesLoading(false);
    }
  }

  async function handleAuthed(next: AuthState) {
    saveAuth(next);
    setAuth(next);
    setShowChefGate(false);
    setPlayer((p) => ({ ...p, points: next.chef.points }));
    setNotice(`Welcome back, ${next.chef.roleEmoji} ${next.chef.displayName}! Your private kitchen is open.`);
    window.setTimeout(() => setNotice(null), 5000);
    try {
      setMyRecipes(await api.listRecipes(next.token));
    } catch {
      /* the book loads again when opened */
    }
    const pending = pendingAuthActionRef.current;
    pendingAuthActionRef.current = null;
    if (pending) {
      pending(next);
    }
  }

  async function signOut() {
    if (auth) {
      try {
        await api.signOut(auth.token);
      } catch {
        /* ignore */
      }
    }
    saveAuth(null);
    setAuth(null);
    setMyRecipes([]);
    setDbRecipe(null);
    setShowChefGate(false);
    setNotice("Signed out. Your recipes stay safely in your own kitchen.");
    window.setTimeout(() => setNotice(null), 5000);
  }

  async function openDbRecipe(id: string) {
    if (!auth) return;
    try {
      const found = await api.getRecipe(auth.token, id);
      setDbRecipe(found);
      setSearchResult(null);
      playSuccess();
      navigate("dbRecipe");
    } catch (error) {
      setMyRecipesError(error instanceof ApiClientError ? error.message : "Could not open that recipe.");
    }
  }

  async function claimShared(catalogueId: string) {
    if (!auth) return;
    setClaimingId(catalogueId);
    try {
      const { recipe } = await api.claim(auth.token, catalogueId);
      setSearchResult(null);
      setDbRecipe(recipe);
      playSuccess();
      navigate("dbRecipe");
      void refreshMyRecipes();
    } catch (error) {
      setMyRecipesError(error instanceof ApiClientError ? error.message : "Could not copy that recipe.");
    } finally {
      setClaimingId(null);
    }
  }

  async function deleteDbRecipe() {
    if (!auth || !dbRecipe) return;
    setDeletingRecipe(true);
    try {
      await api.deleteRecipe(auth.token, dbRecipe.id);
      setDbRecipe(null);
      goBack();
      void refreshMyRecipes();
    } catch (error) {
      setMyRecipesError(error instanceof ApiClientError ? error.message : "Could not delete that recipe.");
    } finally {
      setDeletingRecipe(false);
    }
  }

  function startPrep() {
    if (!dbRecipe) return;
    playPop();
    setOnboardingRecipe(dbRecipe);
    navigate("onboarding");
  }

  function startCookingFromOnboarding(result: OnboardingResult) {
    if (!dbRecipe) return;
    const legacy = viewToLegacy(dbRecipe, result);
    setRecipe(legacy);
    setCheckedIngredients({});
    setStepIndex(0);
    setLastEarnedPoints(false);
    setNotice(`Shopping list saved — ${result.shoppingList.items.filter((i) => !i.alreadyAtHome).length} items to buy for ${result.servings} people.`);
    window.setTimeout(() => setNotice(null), 6000);
    playSuccess();
    navigate("cooking");
  }

  // Wrong recipe on the recipe page? Jump straight into AI Top-Chef mode,
  // remembering the rejected recipe so it is never offered again.
  function openAiChefFinder(dish: string, rejectedRecipeName: string, rejectedMealId?: string) {
    playPop();
    setFinderQuery(dish);
    setFinderMode("aiChefs");
    setFinderRejectedRecipe(rejectedRecipeName);
    setFinderRejectedMealId(rejectedMealId);
    setShowSmartFinder(true);
  }

  function loadRecipe(found: Recipe) {
    setRecipe(found);
    setCheckedIngredients({});
    setStepIndex(0);
    setLastEarnedPoints(false);
    navigate("recipe");
  }

  function handleRecipeFound(found: FoundRecipe) {
    setShowSmartFinder(false);
    playSuccess();
    loadRecipe(found);
  }

  function toggleIngredient(i: number) {
    playPop();
    setCheckedIngredients((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function startCooking() {
    playSuccess();
    setStepIndex(0);
    navigate("cooking");
  }

  function nextStep() {
    if (!recipe) return;
    playDing();
    setStepIndex((s) => Math.min(s + 1, recipe.steps.length - 1));
  }

  function prevStep() {
    playPop();
    setStepIndex((s) => Math.max(0, s - 1));
  }

  function handleSpeak(text: string) {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speakText(text, () => setIsSpeaking(false));
    }
  }

  // --- Fair-play points: honest confirmation + once per unique recipe ---
  async function confirmActuallyMade() {
    if (!recipe) return;
    setShowHonestyModal(false);

    if (auth) {
      try {
        const outcome = await api.cookCompletion(auth.token, recipe.name);
        setPlayer((p) => ({
          ...p,
          points: outcome.points,
          awardedRecipes: outcome.awarded ? [...p.awardedRecipes, recipe.name] : p.awardedRecipes,
        }));
        setAuth((current) =>
          current ? { ...current, chef: { ...current.chef, points: outcome.points } } : current,
        );
        setLastEarnedPoints(outcome.awarded);
        playSuccess();
        navigate("done");
        return;
      } catch {
        // offline — fall back to local scoring below
      }
    }

    const alreadyAwarded = player.awardedRecipes.includes(recipe.name);
    if (alreadyAwarded) {
      setLastEarnedPoints(false);
    } else {
      setPlayer((p) => ({
        ...p,
        points: p.points + POINTS_PER_RECIPE,
        awardedRecipes: [...p.awardedRecipes, recipe.name],
      }));
      setLastEarnedPoints(true);
    }
    playSuccess();
    navigate("done");
  }

  // --- Rewards callbacks ---
  function buyItem(item: RoomItem) {
    setPlayer((p) => {
      if (p.ownedItems.includes(item.id) || p.points < item.price) return p;
      return { ...p, points: p.points - item.price, ownedItems: [...p.ownedItems, item.id] };
    });
  }

  function saveBuddy(buddy: Buddy, cost: number) {
    setPlayer((p) => {
      if (p.points < cost) return p;
      return { ...p, points: p.points - cost, myCharacter: buddy };
    });
  }

  function unlockSurprise(recipeName: string) {
    if (player.points < NEW_RECIPE_COST) return;
    setPlayer((p) => (p.points >= NEW_RECIPE_COST ? { ...p, points: p.points - NEW_RECIPE_COST } : p));
    loadRecipe(findRecipe(recipeName));
  }

  function restartPlayer() {
    // Keep awardedRecipes so points can't be re-farmed for the same dishes.
    setPlayer((p) => ({ points: 0, ownedItems: [], myCharacter: null, awardedRecipes: p.awardedRecipes }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-100 via-yellow-50 to-rose-100 text-slate-800">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-10 top-20 h-40 w-40 rounded-full bg-yellow-200/40 blur-3xl" />
        <div className="absolute right-0 top-40 h-56 w-56 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-48 w-48 rounded-full bg-orange-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6 sm:px-6">
        {screen !== "welcome" && (
          <nav className="sticky top-0 z-40 -mx-1 mb-4 flex flex-wrap items-center gap-1.5 rounded-2xl bg-white/85 px-2 py-2 shadow ring-1 ring-orange-100 backdrop-blur" aria-label="App navigation">
            <button
              type="button"
              onClick={goHome}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-3 py-2 text-sm font-black text-white shadow transition active:scale-95"
            >
              🏠 Home
            </button>
            <button
              type="button"
              onClick={goBack}
              disabled={history.length <= 1}
              className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => {
                playPop();
                navigate("whatsNew");
              }}
              aria-current={screen === "whatsNew" ? "page" : undefined}
              className={`relative rounded-xl px-3 py-2 text-sm font-black transition active:scale-95 ${
                screen === "whatsNew"
                  ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow"
                  : "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 hover:bg-fuchsia-100"
              }`}
            >
              ✨ What&apos;s New
              {unseenWhatsNew && (
                <span className="ml-1 inline-block rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                  New
                </span>
              )}
            </button>
            {chef ? (
              <button
                type="button"
                onClick={() => { playPop(); void refreshMyRecipes(); navigate("myRecipes"); }}
                className="ml-auto rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
                aria-label="Open my private recipe book"
              >
                📖 <span className="hidden sm:inline">My Recipes</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { playPop(); setShowChefGate(true); }}
                className="ml-auto rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
              >
                🔐 <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => { playPop(); navigate("rewards"); }}
              className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-amber-900 shadow transition hover:bg-amber-300 active:scale-95"
              aria-label="Open rewards shop"
            >
              ⭐ {player.points}
            </button>
          </nav>
        )}

        {screen === "welcome" && (
          <WelcomeScreen
            characterId={characterId}
            onSelectCharacter={(id) => { playPop(); setCharacterId(id); }}
            name={name}
            setName={setName}
            shakeName={shakeName}
            levelId={levelId}
            onSelectLevel={(id) => { playPop(); setLevelId(id); }}
            onStart={handleStart}
            unseenWhatsNew={unseenWhatsNew}
            onOpenWhatsNew={() => { playPop(); navigate("whatsNew"); }}
          />
        )}

        {screen === "whatsNew" && (
          <WhatsNewTab
            chefName={chefName}
            onAction={handleWhatsNewAction}
            onSeen={() => setUnseenWhatsNew(false)}
            onBack={history.length > 1 ? goBack : undefined}
          />
        )}

        {screen === "kitchen" && (
          <KitchenScreen
            character={selectedCharacter}
            buddy={player.myCharacter}
            chefName={chefName}
            levelLabel={chef ? `${chef.roleEmoji} ${chef.roleLabel}` : `${selectedLevel.emoji} ${selectedLevel.label}`}
            points={player.points}
            foodQuery={foodQuery}
            setFoodQuery={setFoodQuery}
            onOpenFinder={(query) => void openFinder(query)}
            onRewards={() => navigate("rewards")}
            chef={chef}
            onSignIn={() => { playPop(); setShowChefGate(true); }}
            onMyRecipes={() => {
              if (chef) {
                playPop();
                void refreshMyRecipes();
                navigate("myRecipes");
              } else {
                void ensureChefAuth((authed) => {
                  void api.listRecipes(authed.token).then(setMyRecipes).catch(() => {});
                  navigate("myRecipes");
                });
              }
            }}
            onImport={() => openAiImporter({ query: foodQuery })}
            onOpenBrowser={(tab) => openInternalBrowser({ query: foodQuery, tab })}
            onOpenWhatsNew={() => { playPop(); navigate("whatsNew"); }}
            unseenWhatsNew={unseenWhatsNew}
            onSignOut={() => void signOut()}
          />
        )}

        {screen === "myRecipes" && (
          <MyRecipes
            recipes={myRecipes}
            loading={myRecipesLoading}
            error={myRecipesError}
            onOpen={(entry) => void openDbRecipe(entry.id)}
            onImport={() => openAiImporter()}
            onBrowse={() => openInternalBrowser({ query: foodQuery, tab: "website" })}
            onDelete={(entry) => {
              if (!auth) return;
              void api
                .deleteRecipe(auth.token, entry.id)
                .then(() => refreshMyRecipes())
                .catch((error: unknown) =>
                  setMyRecipesError(error instanceof ApiClientError ? error.message : "Could not delete."),
                );
            }}
            onRefresh={() => void refreshMyRecipes()}
            onBack={goBack}
          />
        )}

        {screen === "dbRecipe" && dbRecipe && (
          <DbRecipeDetail
            recipe={dbRecipe}
            onBack={goBack}
            onStartPrep={startPrep}
            onDelete={() => void deleteDbRecipe()}
            deleting={deletingRecipe}
            onOpenSource={(url) => openInternalBrowser({ url, query: dbRecipe.title })}
          />
        )}

        {screen === "onboarding" && onboardingRecipe && auth && (
          <OnboardingFlow
            recipe={onboardingRecipe}
            token={auth.token}
            onCancel={goBack}
            onStartCooking={startCookingFromOnboarding}
          />
        )}

        {screen === "recipe" && recipe && (
          <RecipeScreen
            recipe={recipe}
            checkedIngredients={checkedIngredients}
            onToggleIngredient={toggleIngredient}
            onStartCooking={startCooking}
            onNotThis={() => openAiChefFinder(recipe.name, recipe.name, (recipe as FoundRecipe).mealId)}
            onOpenBrowser={openInternalBrowser}
          />
        )}

        {screen === "cooking" && recipe && (
          <CookingScreen
            character={selectedCharacter}
            chefName={chefName}
            recipe={recipe}
            stepIndex={stepIndex}
            progress={progress}
            isSpeaking={isSpeaking}
            onSpeak={handleSpeak}
            onNext={nextStep}
            onPrev={prevStep}
            onFinish={() => setShowHonestyModal(true)}
          />
        )}

        {screen === "done" && recipe && (
          <DoneScreen
            character={selectedCharacter}
            chefName={chefName}
            recipe={recipe}
            earnedPoints={lastEarnedPoints}
            points={player.points}
            onCookAgain={() => { playPop(); setStepIndex(0); navigate("cooking"); }}
            onNewRecipe={goHome}
            onRewards={() => navigate("rewards")}
          />
        )}

        {screen === "rewards" && (
          <section className="rounded-3xl bg-white/90 p-5 shadow-xl ring-1 ring-orange-100">
            <RewardsHub
              points={player.points}
              ownedItems={player.ownedItems}
              myCharacter={player.myCharacter}
              onBuyItem={buyItem}
              onSaveBuddy={saveBuddy}
              onSurpriseRecipe={unlockSurprise}
              onRestart={restartPlayer}
            />
          </section>
        )}
      </div>

      {showChefGate && (
        <ChefGate
          characters={CHARACTERS}
          onAuthed={(next) => void handleAuthed(next)}
          onClose={() => setShowChefGate(false)}
        />
      )}

      {searchResult && (
        <InternalMatches
          result={searchResult}
          busyId={claimingId}
          onOpenOwn={(id) => void openDbRecipe(id)}
          onClaim={(catalogueId) => void claimShared(catalogueId)}
          onSearchOnline={openOnlineFinder}
          onBrowse={() => openInternalBrowser({ query: searchResult.query, tab: "website" })}
          onImport={() => {
            const q = searchResult.query;
            setSearchResult(null);
            openAiImporter({ query: q });
          }}
          onClose={() => setSearchResult(null)}
        />
      )}

      {showImporter && auth && (
        <RecipeImporter
          token={auth.token}
          canPublish={chef?.canPublish ?? false}
          initialQuery={importerQuery}
          autoStart={importerAutoStart}
          allowAiFallback={importerAllowFallback}
          draftHint={importerDraftHint}
          onClose={() => {
            setShowImporter(false);
            setImporterAutoStart(false);
            setImporterAllowFallback(false);
            setImporterDraftHint(null);
          }}
          onOpenBrowser={(q, tab) => openInternalBrowser({ query: q || foodQuery, tab: tab ?? "website" })}
          onSaved={(saved) => {
            setShowImporter(false);
            setImporterAutoStart(false);
            setImporterAllowFallback(false);
            setImporterDraftHint(null);
            setDbRecipe(saved);
            navigate("dbRecipe");
            void refreshMyRecipes();
          }}
          onSavedAndOnboard={(saved) => {
            setShowImporter(false);
            setImporterAutoStart(false);
            setImporterAllowFallback(false);
            setImporterDraftHint(null);
            setDbRecipe(saved);
            setOnboardingRecipe(saved);
            navigate("onboarding");
            void refreshMyRecipes();
          }}
        />
      )}

      {browserState && (
        <InAppBrowser
          initialUrl={browserState.url}
          initialQuery={browserState.query ?? foodQuery}
          initialTab={browserState.tab}
          chefContext={browserState.chef}
          onClose={() => setBrowserState(null)}
          onImportWithAi={handleBrowserImport}
        />
      )}

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="status">
          <p className="max-w-md rounded-2xl bg-slate-900/90 px-4 py-3 text-center text-sm font-bold text-white shadow-xl">
            {notice}
          </p>
        </div>
      )}

      {showSmartFinder && (
        <SmartRecipeFinder
          initialQuery={finderQuery}
          initialMode={finderMode}
          rejectedRecipeName={finderRejectedRecipe}
          rejectedMealId={finderRejectedMealId}
          onClose={() => setShowSmartFinder(false)}
          onRecipeFound={handleRecipeFound}
          onOpenBrowser={openInternalBrowser}
        />
      )}

      {showHonestyModal && recipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-label="Did you actually make this recipe?">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="text-5xl" aria-hidden="true">👨‍🍳</div>
            <h3 className="mt-2 text-xl font-black text-slate-800">Did you ACTUALLY make this recipe?</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Be a true chef — only say yes if you really cooked <span className="font-black text-orange-600">{recipe.name}</span> in real life!
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={confirmActuallyMade}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 py-3 font-black text-white shadow-lg transition active:scale-95"
              >
                ✓ Yes! I Really Made It!
              </button>
              <button
                type="button"
                onClick={() => { playPop(); setShowHonestyModal(false); }}
                className="w-full rounded-2xl bg-white py-3 font-black text-slate-600 ring-2 ring-slate-200 transition active:scale-95"
              >
                ⏳ Not yet…
              </button>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-400">“Not yet” keeps you on this step with NO points — keep cooking!</p>
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({
  characterId,
  onSelectCharacter,
  name,
  setName,
  shakeName,
  levelId,
  onSelectLevel,
  onStart,
  unseenWhatsNew,
  onOpenWhatsNew,
}: {
  characterId: string;
  onSelectCharacter: (id: string) => void;
  name: string;
  setName: (name: string) => void;
  shakeName: boolean;
  levelId: string;
  onSelectLevel: (id: string) => void;
  onStart: () => void;
  unseenWhatsNew: boolean;
  onOpenWhatsNew: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.45s ease-in-out; }
      `}</style>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={onOpenWhatsNew}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-black text-fuchsia-700 shadow ring-1 ring-fuchsia-200 transition hover:bg-fuchsia-50 active:scale-95"
        >
          <span>✨ What&apos;s New</span>
          {unseenWhatsNew && (
            <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
              New
            </span>
          )}
        </button>
      </div>
      <div className="text-center">
        <p className="text-5xl" aria-hidden="true">🍳</p>
        <h1 className="mt-1 bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-500 bg-clip-text text-4xl font-black text-transparent">
          Chef Universe
        </h1>
        <p className="mt-1 font-bold text-slate-500">Search ANY recipe in the world &amp; cook it for real!</p>
      </div>

      <h2 className="mt-6 mb-2 font-black text-slate-700">1️⃣ Pick your chef buddy</h2>
      <div className="grid grid-cols-3 gap-2">
        {CHARACTERS.map((c) => (
          <AvatarButton
            key={c.id}
            image={c.image}
            name={`${c.name} • ${c.title}`}
            isSelected={characterId === c.id}
            onClick={() => onSelectCharacter(c.id)}
            badge={c.emoji}
          />
        ))}
      </div>

      <h2 className="mt-6 mb-2 font-black text-slate-700">2️⃣ What&apos;s your name, chef?</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onStart(); }}
        placeholder="Type your chef name…"
        aria-label="Your name"
        className={`w-full rounded-2xl border-2 bg-white px-4 py-3 text-lg font-bold shadow-inner outline-none focus:border-orange-400 ${
          shakeName ? "animate-shake border-rose-400" : "border-pink-200"
        }`}
      />
      {shakeName && <p className="mt-1 text-sm font-bold text-rose-500">Oops! Tell us your name first, chef! 👨‍🍳</p>}

      <h2 className="mt-6 mb-2 font-black text-slate-700">3️⃣ Choose your chef level</h2>
      <div className="grid grid-cols-2 gap-2">
        {CHEF_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onSelectLevel(level.id)}
            aria-pressed={levelId === level.id}
            className={`rounded-2xl px-3 py-3 text-left transition active:scale-95 ${
              levelId === level.id
                ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg"
                : "bg-white text-slate-700 ring-1 ring-orange-100 hover:ring-orange-300"
            }`}
          >
            <span className="block font-black">{level.emoji} {level.label}</span>
            <span className={`text-xs font-bold ${levelId === level.id ? "text-white/85" : "text-slate-400"}`}>Ages {level.ages}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-8 w-full rounded-3xl bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-500 py-4 text-xl font-black text-white shadow-2xl transition hover:brightness-110 active:scale-95"
      >
        START COOKING! 🚀
      </button>
    </main>
  );
}

function KitchenScreen({
  character,
  buddy,
  chefName,
  levelLabel,
  points,
  foodQuery,
  setFoodQuery,
  onOpenFinder,
  onRewards,
  chef,
  onSignIn,
  onMyRecipes,
  onImport,
  onOpenBrowser,
  onOpenWhatsNew,
  unseenWhatsNew,
  onSignOut,
}: {
  character: WelcomeCharacter;
  buddy: Buddy | null;
  chefName: string;
  levelLabel: string;
  points: number;
  foodQuery: string;
  setFoodQuery: (q: string) => void;
  onOpenFinder: (prefill: string) => void;
  onRewards: () => void;
  chef: ChefProfile | null;
  onSignIn: () => void;
  onMyRecipes: () => void;
  onImport: () => void;
  onOpenBrowser: (tab: "website" | "youtube") => void;
  onOpenWhatsNew: () => void;
  unseenWhatsNew: boolean;
  onSignOut: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col gap-5">
      <header className="flex items-center gap-3 rounded-3xl bg-white/90 p-4 shadow ring-1 ring-orange-100">
        <img src={character.image} alt={character.name} className="h-16 w-16 rounded-2xl object-cover shadow" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-black text-slate-800">Hi, Chef {chefName}! 👋</h2>
          <p className="truncate text-sm font-bold text-slate-500">{levelLabel} • with {character.name}</p>
        </div>
        <button
          type="button"
          onClick={onRewards}
          className="shrink-0 rounded-2xl bg-amber-400 px-4 py-2.5 font-black text-amber-900 shadow transition active:scale-95"
          aria-label={`${points} points — open rewards shop`}
        >
          ⭐ {points}
        </button>
      </header>

      <button
        type="button"
        onClick={onOpenWhatsNew}
        className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-fuchsia-50 via-pink-50 to-orange-50 p-3.5 text-left shadow-sm ring-1 ring-fuchsia-200 transition hover:brightness-98 active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-lg text-white shadow">
          ✨
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-black text-slate-800">
            What&apos;s New in Chef Universe
            {unseenWhatsNew && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                New
              </span>
            )}
          </span>
          <span className="block truncate text-xs font-bold text-slate-500">
            In-App Website &amp; YouTube Browser + 1-Tap AI Recipe Onboarding!
          </span>
        </span>
        <span className="shrink-0 font-black text-fuchsia-600">→</span>
      </button>

      <section className="rounded-3xl bg-white/95 p-4 shadow ring-1 ring-sky-100" aria-label="In-app browser and AI recipe onboarding">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-800">
              🌐📺 In-App Recipe Browser &amp; AI Onboarding
            </h3>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              Browse chef websites or YouTube channels right inside the app — pick the right recipe &amp; import everything!
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenBrowser("website")}
            className="rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2.5 text-xs font-black text-white shadow transition active:scale-95"
          >
            🌐 Browse Websites
          </button>
          <button
            type="button"
            onClick={() => onOpenBrowser("youtube")}
            className="rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 px-3 py-2.5 text-xs font-black text-white shadow transition active:scale-95"
          >
            📺 Browse YouTube
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onImport}
            className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-3 py-2.5 text-xs font-black text-white shadow transition active:scale-95"
          >
            🤖 AI Recipe Onboarding
          </button>
          <button
            type="button"
            onClick={onMyRecipes}
            className="rounded-2xl bg-slate-900 px-3 py-2.5 text-xs font-black text-white shadow transition active:scale-95"
          >
            📖 My Recipe Book
          </button>
        </div>
      </section>

      {chef ? (
        <section className="rounded-3xl bg-white/90 p-4 shadow ring-1 ring-emerald-100" aria-label="My private kitchen">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">{chef.roleEmoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-slate-800">Chef {chef.displayName}&apos;s private kitchen</p>
              <p className="truncate text-xs font-bold text-slate-500">
                🔒 Only you can open your recipes · {chef.roleLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-500 transition active:scale-95"
            >
              Sign out
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          className="flex w-full items-center gap-3 rounded-3xl bg-white/90 p-4 text-left shadow ring-1 ring-orange-100 transition active:scale-[0.99]"
        >
          <span className="text-3xl" aria-hidden="true">🔐</span>
          <span className="min-w-0 flex-1">
            <span className="block font-black text-slate-800">Switch chef profile or add a secret PIN</span>
            <span className="block text-xs font-bold text-slate-500">
              Junior, Teen, Adult or Master Chef — your recipes stay yours alone.
            </span>
          </span>
          <span className="shrink-0 font-black text-orange-500">→</span>
        </button>
      )}

      <section className="rounded-3xl bg-gradient-to-br from-orange-400 via-pink-500 to-fuchsia-500 p-5 text-white shadow-xl" aria-label="AI recipe search">
        <h3 className="text-lg font-black">🔮 AI Smart Chef Search</h3>
        <p className="mt-0.5 text-sm font-semibold text-white/85">Type ANY dish in the world — or paste a recipe website link!</p>
        <div className="mt-3 flex gap-2">
          <input
            value={foodQuery}
            onChange={(e) => setFoodQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onOpenFinder(foodQuery); }}
            placeholder="What are you craving today?"
            aria-label="Search for any recipe"
            className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 shadow-inner outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => onOpenFinder(foodQuery)}
            className="shrink-0 rounded-2xl bg-slate-900/85 px-4 py-3 font-black text-white shadow transition active:scale-95"
          >
            🔍 Find
          </button>
        </div>
      </section>

      <section aria-label="Recipe ideas">
        <h3 className="mb-2 font-black text-slate-700">💡 Yummy ideas — tap one!</h3>
        <div className="flex flex-wrap gap-2">
          {suggestionChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onOpenFinder(chip.label)}
              className="rounded-full bg-white px-3.5 py-2 font-extrabold text-slate-700 shadow ring-1 ring-orange-100 transition hover:ring-orange-300 active:scale-95"
            >
              {chip.emoji} {chip.label}
            </button>
          ))}
        </div>
      </section>

      {buddy && (
        <button
          type="button"
          onClick={onRewards}
          className="flex items-center gap-3 rounded-3xl bg-white/90 p-3 text-left shadow ring-1 ring-pink-100 transition active:scale-[0.99]"
        >
          <CSSCharacter baseImage={buddy.baseImage} name="My custom buddy" className="h-16 w-16 shrink-0" />
          <span>
            <span className="block font-black text-slate-800">✨ Your AI Buddy is cheering for you!</span>
            <span className="text-sm font-bold text-slate-500">Visit the Buddy Studio &amp; living room →</span>
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onRewards}
        className="mt-auto w-full rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 font-black text-white shadow-lg transition active:scale-95"
      >
        🎁 Spend My Points! (⭐ {points})
      </button>
    </main>
  );
}

function RecipeScreen({
  recipe,
  checkedIngredients,
  onToggleIngredient,
  onStartCooking,
  onNotThis,
  onOpenBrowser,
}: {
  recipe: Recipe;
  checkedIngredients: Record<number, boolean>;
  onToggleIngredient: (i: number) => void;
  onStartCooking: () => void;
  onNotThis: () => void;
  onOpenBrowser: (request: OpenBrowserRequest) => void;
}) {
  const q = encodeURIComponent(recipe.name);
  const checkedCount = recipe.ingredients.filter((_, i) => checkedIngredients[i]).length;
  return (
    <main className="flex flex-1 flex-col gap-4">
      {recipe.image ? (
        <img src={recipe.image} alt={recipe.name} className="max-h-60 w-full rounded-3xl object-cover shadow-lg" loading="lazy" />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-200 to-pink-200 text-7xl shadow-inner" aria-hidden="true">
          {recipe.emoji}
        </div>
      )}

      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-800">{recipe.emoji} {recipe.name}</h2>
        {recipe.source && <p className="mt-1 text-sm font-bold text-slate-500">{recipe.source}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm font-extrabold">
          <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-700 ring-1 ring-orange-200">⏱️ {recipe.time}</span>
          <span className={`rounded-full border px-3 py-1.5 ${difficultyColor(recipe.difficulty)}`}>📊 {recipe.difficulty}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200">🍽️ {recipe.servings}</span>
        </div>
      </div>

      {recipe.youtubeVideo && <YouTubePlayer youtubeIdOrUrl={recipe.youtubeVideo} title={recipe.name} />}

      {recipe.chefName && (
        <section className="rounded-3xl bg-fuchsia-50 p-4 ring-1 ring-fuchsia-200" aria-label={`Recipe inspired by ${recipe.chefName}`}>
          <h3 className="font-black text-fuchsia-800">⭐ {recipe.chefName} style {recipe.chefCountry ? `• ${recipe.chefCountry}` : ""}</h3>
          <p className="mt-1 text-sm font-semibold text-fuchsia-700">
            This in-app recipe is inspired by {recipe.chefName}&apos;s cooking. Want their exact original version? Browse inside the app &amp; import with AI Onboarding:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recipe.chefWebsiteSearchUrl && (
              <button
                type="button"
                onClick={() =>
                  onOpenBrowser({
                    url: recipe.chefWebsiteSearchUrl,
                    query: recipe.name,
                    tab: "website",
                    chef: {
                      name: recipe.chefName!,
                      country: recipe.chefCountry,
                      websiteUrl: recipe.chefWebsiteSearchUrl,
                      youtubeUrl: recipe.chefYouTubeSearchUrl ?? null,
                    },
                  })
                }
                className="flex-1 rounded-full bg-white px-3 py-2 text-center text-sm font-extrabold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-50 active:scale-95"
              >
                🌐 Browse {recipe.chefName}&apos;s Website
              </button>
            )}
            {recipe.chefYouTubeSearchUrl && (
              <button
                type="button"
                onClick={() =>
                  onOpenBrowser({
                    url: recipe.chefYouTubeSearchUrl,
                    query: recipe.name,
                    tab: "youtube",
                    chef: {
                      name: recipe.chefName!,
                      country: recipe.chefCountry,
                      websiteUrl: recipe.chefWebsiteSearchUrl ?? null,
                      youtubeUrl: recipe.chefYouTubeSearchUrl,
                    },
                  })
                }
                className="flex-1 rounded-full bg-white px-3 py-2 text-center text-sm font-extrabold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-95"
              >
                📺 {recipe.chefName} on YouTube
              </button>
            )}
          </div>
        </section>
      )}

      {recipe.isGeneric && (
        <section className="rounded-3xl bg-sky-50 p-4 ring-1 ring-sky-200" aria-label="About this universal recipe">
          <h3 className="font-black text-sky-800">✨ Universal Chef Recipe ready!</h3>
          <p className="mt-1 text-sm font-semibold text-sky-700">
            We don&apos;t have an exact built-in recipe for this dish yet, so our Universal Chef built you a safe, step-by-step version.
            Want to browse &amp; import the exact original right inside the app with AI Onboarding?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenBrowser({ url: `https://cakesbymk.com/?s=${q}`, query: recipe.name, tab: "website" })}
              className="rounded-full bg-white px-3 py-2 text-sm font-extrabold text-pink-600 ring-1 ring-pink-200 transition hover:bg-pink-50 active:scale-95"
            >
              🍰 Cakes by MK
            </button>
            <button
              type="button"
              onClick={() => onOpenBrowser({ url: `https://html.duckduckgo.com/html/?q=${q}+recipe`, query: recipe.name, tab: "website" })}
              className="rounded-full bg-white px-3 py-2 text-sm font-extrabold text-sky-600 ring-1 ring-sky-200 transition hover:bg-sky-50 active:scale-95"
            >
              🔎 Web Recipe Search
            </button>
            <button
              type="button"
              onClick={() => onOpenBrowser({ url: `https://www.foodfusion.com/?s=${q}`, query: recipe.name, tab: "website" })}
              className="rounded-full bg-white px-3 py-2 text-sm font-extrabold text-emerald-600 ring-1 ring-emerald-200 transition hover:bg-emerald-50 active:scale-95"
            >
              🍳 Food Fusion
            </button>
            <button
              type="button"
              onClick={() => onOpenBrowser({ url: `https://www.youtube.com/results?search_query=cakes+by+mk+${q}`, query: recipe.name, tab: "youtube" })}
              className="rounded-full bg-white px-3 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-95"
            >
              📺 MK Video Tutorial
            </button>
            <button
              type="button"
              onClick={() => onOpenBrowser({ url: `https://www.youtube.com/results?search_query=${q}+recipe`, query: recipe.name, tab: "youtube" })}
              className="rounded-full bg-white px-3 py-2 text-sm font-extrabold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-95"
            >
              📺 YouTube Recipes
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-white/90 p-5 shadow ring-1 ring-orange-100" aria-label="Ingredients checklist">
        <h3 className="font-black text-slate-800">🛒 Ingredients Checklist <span className="text-sm font-bold text-slate-400">({checkedCount}/{recipe.ingredients.length})</span></h3>
        <p className="mb-3 text-xs font-bold text-slate-400">Tap each one as you put it on the counter!</p>
        <div className="space-y-2">
          {recipe.ingredients.map((ingredient, i) => {
            const done = Boolean(checkedIngredients[i]);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onToggleIngredient(i)}
                aria-pressed={done}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-semibold transition active:scale-[0.99] ${
                  done ? "bg-emerald-50 text-slate-400 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-700 ring-1 ring-slate-100"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-black text-white ${done ? "bg-emerald-500" : "bg-slate-300"}`}>
                  {done ? "✓" : ""}
                </span>
                <span className={done ? "line-through" : ""}>{ingredient}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200" role="note">
        <p className="font-semibold text-amber-800"><span className="font-black">💡 Chef Tip:</span> {recipe.tip}</p>
      </div>

      <button
        type="button"
        onClick={onStartCooking}
        className="w-full rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 py-4 text-lg font-black text-white shadow-xl transition active:scale-95"
      >
        Start Cooking! 👨‍🍳
      </button>

      <button
        type="button"
        onClick={onNotThis}
        className="w-full rounded-3xl bg-white py-3 font-black text-red-500 ring-2 ring-red-200 transition hover:bg-red-50 active:scale-95"
      >
        ❌ Not This Recipe? Ask AI Top Chefs 🤖
      </button>
      <p className="-mt-2 text-center text-xs font-bold text-slate-400">
        We&apos;ll search famous chefs from the right region &amp; country — like Food Fusion 🇵🇰 and Ranveer Brar 🇮🇳 — and show you lots of options to choose from!
      </p>
    </main>
  );
}

function CookingScreen({
  character,
  chefName,
  recipe,
  stepIndex,
  progress,
  isSpeaking,
  onSpeak,
  onNext,
  onPrev,
  onFinish,
}: {
  character: WelcomeCharacter;
  chefName: string;
  recipe: Recipe;
  stepIndex: number;
  progress: number;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
}) {
  // Fair play: every step locks the Next button behind a mandatory 6-second read countdown.
  const [readSeconds, setReadSeconds] = useState(6);
  useEffect(() => {
    setReadSeconds(6);
    const interval = window.setInterval(() => {
      setReadSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stepIndex]);

  const stepText = recipe.steps[stepIndex] ?? "";
  const isLastStep = stepIndex === recipe.steps.length - 1;
  const locked = readSeconds > 0;

  return (
    <main className="flex flex-1 flex-col gap-4">
      <header className="flex items-center gap-3">
        <img src={character.image} alt="" className="h-12 w-12 rounded-xl object-cover shadow" />
        <div>
          <h2 className="font-black text-slate-800">{recipe.emoji} {recipe.name}</h2>
          <p className="text-sm font-bold text-slate-500">Chef {chefName}, let&apos;s cook — for real! 🔥</p>
        </div>
      </header>

      <div aria-label={`Progress ${progress}%`}>
        <div className="flex justify-between text-xs font-black text-slate-500">
          <span>Step {stepIndex + 1} of {recipe.steps.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-orange-100">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section className="rounded-3xl bg-white/95 p-6 shadow-xl ring-1 ring-orange-100" aria-live="polite">
        <p className="text-xs font-black uppercase tracking-widest text-orange-500">Step {stepIndex + 1}</p>
        <p className="mt-2 text-xl font-bold leading-relaxed text-slate-800">{stepText}</p>
        <button
          type="button"
          onClick={() => onSpeak(stepText)}
          className="mt-4 rounded-full bg-sky-100 px-4 py-2 font-extrabold text-sky-700 ring-1 ring-sky-200 transition active:scale-95"
        >
          {isSpeaking ? "🔇 Stop Reading" : "🔊 Read It To Me!"}
        </button>
        <InteractiveCookingWidget stepText={stepText} />
      </section>

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="rounded-2xl bg-white px-5 py-3.5 font-black text-slate-600 shadow ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => (isLastStep ? onFinish() : onNext())}
          disabled={locked}
          className={`flex-1 rounded-2xl py-3.5 font-black text-white shadow-xl transition active:scale-95 ${
            locked ? "bg-slate-300" : "bg-gradient-to-r from-orange-500 to-pink-500"
          }`}
        >
          {locked ? `Read step… (${readSeconds}s)` : isLastStep ? "I Finished! 🎉" : "Next Step →"}
        </button>
      </div>
      <p className="text-center text-xs font-bold text-slate-400">⏳ The 6-second timer makes sure you really read &amp; cook each step!</p>
    </main>
  );
}

function DoneScreen({
  character,
  chefName,
  recipe,
  earnedPoints,
  points,
  onCookAgain,
  onNewRecipe,
  onRewards,
}: {
  character: WelcomeCharacter;
  chefName: string;
  recipe: Recipe;
  earnedPoints: boolean;
  points: number;
  onCookAgain: () => void;
  onNewRecipe: () => void;
  onRewards: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center gap-4 text-center">
      <div className="animate-bounce text-7xl" aria-hidden="true">🎉</div>
      <img src={character.image} alt="" className="h-24 w-24 rounded-3xl object-cover shadow-xl ring-4 ring-white" />
      <div>
        <h2 className="text-3xl font-black text-slate-800">You did it, Chef {chefName}!</h2>
        <p className="mt-1 font-bold text-slate-500">Your {recipe.emoji} {recipe.name} is complete. Amazing cooking!</p>
      </div>

      {earnedPoints ? (
        <div className="w-full rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 p-5 font-black text-white shadow-xl" style={{ animation: "pop 0.5s ease-out" }}>
          <p className="text-3xl">+{POINTS_PER_RECIPE} ⭐ Points!</p>
          <p className="mt-1 text-sm font-bold text-white/90">First time cooking this recipe — points earned honestly! Total: ⭐ {points}</p>
        </div>
      ) : (
        <div className="w-full rounded-3xl bg-slate-200 p-5 font-black text-slate-600 ring-1 ring-slate-300">
          <p>✓ Already Earned Points for This Recipe! cook something NEW.</p>
          <p className="mt-1 text-sm font-bold text-slate-500">Points are earned once per recipe. Total: ⭐ {points}</p>
        </div>
      )}

      <div className="w-full space-y-2">
        <button type="button" onClick={onRewards} className="w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3.5 font-black text-white shadow-xl transition active:scale-95">
          🎁 Spend My Points! (⭐ {points})
        </button>
        <button type="button" onClick={onNewRecipe} className="w-full rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 py-3.5 font-black text-white shadow-xl transition active:scale-95">
          Cook Something New! 🚀
        </button>
        <button type="button" onClick={onCookAgain} className="w-full rounded-3xl bg-white py-3 font-black text-slate-600 shadow ring-1 ring-slate-200 transition active:scale-95">
          🔁 Cook This Again
        </button>
      </div>
    </main>
  );
}
