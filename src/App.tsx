import { useMemo, useState, useEffect } from "react";
import { findRecipe, suggestionChips, type Recipe } from "./data/recipes";
import { playPop, playDing, playSuccess, speakText, stopSpeaking } from "./utils/audio";
import { InteractiveCookingWidget } from "./components/InteractiveWidget";

type Screen = "welcome" | "kitchen" | "recipe" | "cooking" | "done";

type Character = {
  id: string;
  emoji: string;
  image?: string;
  name: string;
  title: string;
  gender: "girl" | "boy" | "magic";
  gradient: string;
  sparkle: string;
  accent: string;
};

const CHARACTERS: Character[] = [
  // ✨ GIRL CHARACTERS ✨
  {
    id: "princess",
    emoji: "👸",
    image: "/characters/princess.png",
    name: "Princess",
    title: "Royal Chef",
    gender: "girl",
    gradient: "from-pink-400 via-rose-400 to-fuchsia-500",
    sparkle: "💖",
    accent: "bg-pink-200 text-pink-900",
  },
  {
    id: "fairy",
    emoji: "🧚‍♀️",
    image: "/characters/fairy.png",
    name: "Fairy",
    title: "Magic Whisk",
    gender: "girl",
    gradient: "from-purple-400 via-fuchsia-400 to-pink-400",
    sparkle: "🌸",
    accent: "bg-purple-200 text-purple-900",
  },
  {
    id: "mermaid",
    emoji: "🧜‍♀️",
    image: "/characters/mermaid.png",
    name: "Mermaid",
    title: "Ocean Chef",
    gender: "girl",
    gradient: "from-cyan-400 via-teal-400 to-emerald-400",
    sparkle: "🌊",
    accent: "bg-cyan-200 text-cyan-900",
  },
  {
    id: "supergirl",
    emoji: "🦸‍♀️",
    image: "/characters/supergirl.png",
    name: "Super Girl",
    title: "Hero Chef",
    gender: "girl",
    gradient: "from-red-400 via-rose-500 to-pink-500",
    sparkle: "💫",
    accent: "bg-red-200 text-red-900",
  },
  {
    id: "elf",
    emoji: "🧝‍♀️",
    image: "/characters/elf.png",
    name: "Elf",
    title: "Forest Cook",
    gender: "girl",
    gradient: "from-emerald-400 via-green-400 to-lime-400",
    sparkle: "🌿",
    accent: "bg-emerald-200 text-emerald-900",
  },

  // ⭐ BOY CHARACTERS ⭐
  {
    id: "prince",
    emoji: "🤴",
    image: "/characters/prince.png",
    name: "Prince",
    title: "Golden Chef",
    gender: "boy",
    gradient: "from-amber-400 via-orange-400 to-red-500",
    sparkle: "👑",
    accent: "bg-amber-200 text-amber-900",
  },
  {
    id: "superboy",
    emoji: "🦸‍♂️",
    image: "/characters/superboy.png",
    name: "Super Hero",
    title: "Power Cook",
    gender: "boy",
    gradient: "from-blue-500 via-cyan-400 to-teal-400",
    sparkle: "⚡",
    accent: "bg-blue-200 text-blue-900",
  },
  {
    id: "wizard",
    emoji: "🧙‍♂️",
    image: "/characters/wizard.png",
    name: "Wizard",
    title: "Spell Cooker",
    gender: "boy",
    gradient: "from-indigo-500 via-purple-500 to-violet-600",
    sparkle: "🔮",
    accent: "bg-indigo-200 text-indigo-900",
  },
  {
    id: "astronaut",
    emoji: "🧑‍🚀",
    image: "/characters/astronaut.png",
    name: "Astronaut",
    title: "Space Chef",
    gender: "boy",
    gradient: "from-slate-600 via-indigo-600 to-blue-700",
    sparkle: "🚀",
    accent: "bg-slate-200 text-slate-900",
  },
  {
    id: "cowboy",
    emoji: "🤠",
    image: "/characters/cowboy.png",
    name: "Cowboy",
    title: "Wild West Cook",
    gender: "boy",
    gradient: "from-orange-500 via-amber-600 to-yellow-600",
    sparkle: "🌵",
    accent: "bg-orange-200 text-orange-900",
  },

  // 🌈 MAGICAL CHARACTERS 🌈
  {
    id: "unicorn",
    emoji: "🦄",
    name: "Unicorn",
    title: "Rainbow Chef",
    gender: "magic",
    gradient: "from-pink-300 via-purple-300 to-sky-400",
    sparkle: "🌈",
    accent: "bg-pink-200 text-pink-900",
  },
  {
    id: "angel",
    emoji: "👼",
    name: "Angel",
    title: "Sweet Chef",
    gender: "magic",
    gradient: "from-yellow-300 via-amber-300 to-orange-300",
    sparkle: "☁️",
    accent: "bg-yellow-200 text-yellow-900",
  },
];

const AGE_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12];

const CATEGORIES = [
  { id: "all", label: "All Foods 🍽️" },
  { id: "breakfast", label: "Breakfast 🥞", items: ["Pancakes", "Waffles", "Oatmeal", "Eggs", "Toast"] },
  { id: "snacks", label: "Snacks & Treats 🍪", items: ["Cookies", "Brownies", "Cupcakes", "Popcorn", "Apples", "Fruit Kabobs"] },
  { id: "meals", label: "Yummy Meals 🍕", items: ["Pizza", "Tacos", "Mac & Cheese", "Quesadilla", "Burrito", "Fried Rice", "Pasta"] },
  { id: "drinks", label: "Drinks & Coolers 🥤", items: ["Smoothie", "Hot Chocolate", "Lemonade", "Ice Cream"] },
];

function difficultyColor(d: Recipe["difficulty"]) {
  if (d === "Super Easy") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (d === "Easy") return "bg-sky-100 text-sky-700 border-sky-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [character, setCharacter] = useState(CHARACTERS[0].id);
  const selectedCharacter = CHARACTERS.find((c) => c.id === character) || CHARACTERS[0];
  const [name, setName] = useState("");
  const [age, setAge] = useState(7);
  const [foodQuery, setFoodQuery] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [shakeName, setShakeName] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const chefName = name.trim() || "Little Chef";

  const progress = useMemo(() => {
    if (!recipe) return 0;
    return Math.round(((stepIndex + 1) / recipe.steps.length) * 100);
  }, [recipe, stepIndex]);

  // Clean speaking status when moving screens
  useEffect(() => {
    stopSpeaking();
    setIsSpeaking(false);
  }, [screen, stepIndex]);

  function handleStart() {
    if (!name.trim()) {
      setShakeName(true);
      playDing(); // alert sound
      setTimeout(() => setShakeName(false), 500);
      return;
    }
    playPop();
    setScreen("kitchen");
  }

  function handleFindRecipe(query?: string) {
    const q = (query ?? foodQuery).trim();
    if (!q) return;
    playPop();
    setFoodQuery(q);
    const found = findRecipe(q);
    setRecipe(found);
    setCheckedIngredients({});
    setStepIndex(0);
    setScreen("recipe");
  }

  function toggleIngredient(i: number) {
    playPop();
    setCheckedIngredients((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function startCooking() {
    playSuccess();
    setStepIndex(0);
    setScreen("cooking");
  }

  function nextStep() {
    if (!recipe) return;
    playDing();
    if (stepIndex < recipe.steps.length - 1) {
      setStepIndex((s) => s + 1);
    } else {
      playSuccess();
      setScreen("done");
    }
  }

  function prevStep() {
    playPop();
    setStepIndex((s) => Math.max(0, s - 1));
  }

  function resetToKitchen() {
    playPop();
    setFoodQuery("");
    setRecipe(null);
    setStepIndex(0);
    setCheckedIngredients({});
    setScreen("kitchen");
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

  // Filtered chips based on category
  const filteredChips = useMemo(() => {
    if (selectedCategory === "all") return suggestionChips;
    const cat = CATEGORIES.find((c) => c.id === selectedCategory);
    if (!cat || !cat.items) return suggestionChips;
    return suggestionChips.filter((chip) =>
      cat.items!.some((item) => chip.label.toLowerCase().includes(item.toLowerCase()))
    );
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-100 via-yellow-50 to-rose-100 text-slate-800">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-10 top-20 h-40 w-40 rounded-full bg-yellow-200/40 blur-3xl" />
        <div className="absolute right-0 top-40 h-56 w-56 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute bottom-20 left-1/3 h-48 w-48 rounded-full bg-orange-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6 sm:px-6">
        {screen === "welcome" && (
          <WelcomeScreen
            characterId={character}
            setCharacterId={(c) => {
              playPop();
              setCharacter(c);
            }}
            name={name}
            setName={setName}
            age={age}
            setAge={(a) => {
              playPop();
              setAge(a);
            }}
            shakeName={shakeName}
            onStart={handleStart}
          />
        )}

        {screen === "kitchen" && (
          <KitchenScreen
            character={selectedCharacter}
            chefName={chefName}
            age={age}
            foodQuery={foodQuery}
            setFoodQuery={setFoodQuery}
            onFind={() => handleFindRecipe()}
            onSuggestion={(label) => handleFindRecipe(label)}
            onBack={() => {
              playPop();
              setScreen("welcome");
            }}
            selectedCategory={selectedCategory}
            setSelectedCategory={(cat) => {
              playPop();
              setSelectedCategory(cat);
            }}
            filteredChips={filteredChips}
          />
        )}

        {screen === "recipe" && recipe && (
          <RecipeScreen
            character={selectedCharacter}
            chefName={chefName}
            recipe={recipe}
            checkedIngredients={checkedIngredients}
            toggleIngredient={toggleIngredient}
            onStartCooking={startCooking}
            onBack={resetToKitchen}
          />
        )}

        {screen === "cooking" && recipe && (
          <CookingScreen
            character={selectedCharacter}
            chefName={chefName}
            recipe={recipe}
            stepIndex={stepIndex}
            progress={progress}
            onNext={nextStep}
            onPrev={prevStep}
            onBack={() => {
              playPop();
              setScreen("recipe");
            }}
            isSpeaking={isSpeaking}
            onSpeak={handleSpeak}
          />
        )}

        {screen === "done" && recipe && (
          <DoneScreen
            character={selectedCharacter}
            chefName={chefName}
            recipe={recipe}
            onCookAgain={() => {
              playPop();
              setStepIndex(0);
              setScreen("cooking");
            }}
            onNewRecipe={resetToKitchen}
          />
        )}
      </div>
    </div>
  );
}

function CharacterCard({
  character,
  isSelected,
  onClick,
}: {
  character: Character;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Choose ${character.name}`}
      className={`group relative flex flex-col items-center justify-center rounded-2xl p-2 transition-all duration-300 active:scale-95 ${
        isSelected
          ? "scale-105 ring-4 ring-offset-1 ring-amber-400 shadow-2xl"
          : "hover:scale-105 hover:-translate-y-1"
      }`}
    >
      {/* Card background with gradient */}
      <div
        className={`relative flex h-20 w-full items-center justify-center rounded-xl bg-gradient-to-br ${character.gradient} shadow-lg overflow-hidden sm:h-24`}
      >
        {/* Sparkle effect */}
        <div className="absolute top-1 right-1 text-base opacity-80 animate-pulse sm:text-lg z-10">
          {character.sparkle}
        </div>

        {/* Character image or emoji */}
        {character.image ? (
          <img
            src={character.image}
            alt={character.name}
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          <div className="text-4xl drop-shadow-lg filter sm:text-5xl">
            {character.emoji}
          </div>
        )}

        {/* Selected crown overlay */}
        {isSelected && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xl animate-bounce sm:text-2xl z-10">
            👑
          </div>
        )}
      </div>

      {/* Empty space at bottom for balance */}
      <div className="mt-1.5 h-1" />
    </button>
  );
}

function WelcomeScreen({
  characterId,
  setCharacterId,
  name,
  setName,
  age,
  setAge,
  shakeName,
  onStart,
}: {
  characterId: string;
  setCharacterId: (c: string) => void;
  name: string;
  setName: (n: string) => void;
  age: number;
  setAge: (a: number) => void;
  shakeName: boolean;
  onStart: () => void;
}) {
  const selected = CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-6 text-center">
        <div className="mb-3 text-5xl drop-shadow-sm">👨‍🍳✨</div>
        <h1 className="bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          Little Chefs
        </h1>
        <p className="mt-2 text-base font-medium text-orange-700/80">
          Learn how to cook anything in the world! 🥞🌎
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-5">
        <section className="rounded-3xl border-2 border-orange-200/80 bg-white/80 p-5 shadow-lg shadow-orange-100 backdrop-blur">
          <h2 className="mb-4 text-center text-lg font-bold text-orange-800">
            1. Pick your chef character!
          </h2>

          {/* GIRLS SECTION */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent to-pink-300" />
              <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-pink-700 border border-pink-200">
                ✨ Girl Characters ✨
              </span>
              <div className="h-0.5 flex-1 bg-gradient-to-l from-transparent to-pink-300" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CHARACTERS.filter((c) => c.gender === "girl").map((c) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  isSelected={characterId === c.id}
                  onClick={() => setCharacterId(c.id)}
                />
              ))}
            </div>
          </div>

          {/* BOYS SECTION */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent to-sky-300" />
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-sky-700 border border-sky-200">
                ⭐ Boy Characters ⭐
              </span>
              <div className="h-0.5 flex-1 bg-gradient-to-l from-transparent to-sky-300" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CHARACTERS.filter((c) => c.gender === "boy").map((c) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  isSelected={characterId === c.id}
                  onClick={() => setCharacterId(c.id)}
                />
              ))}
            </div>
          </div>

          {/* MAGICAL SECTION */}
          <div>
            <div className="mb-2 flex items-center justify-center gap-2">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent to-purple-300" />
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-purple-700 border border-purple-200">
                🌈 Magical Characters 🌈
              </span>
              <div className="h-0.5 flex-1 bg-gradient-to-l from-transparent to-purple-300" />
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
              {CHARACTERS.filter((c) => c.gender === "magic").map((c) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  isSelected={characterId === c.id}
                  onClick={() => setCharacterId(c.id)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 p-3 border border-amber-200">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${selected.gradient} shadow-md overflow-hidden`}>
              {selected.image ? (
                <img src={selected.image} alt={selected.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-2xl">{selected.emoji}</span>
              )}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                ✨ Your Chef Buddy ✨
              </p>
              <p className="text-sm font-black text-slate-800">
                You can name them anything!
              </p>
            </div>
            <div className="text-2xl animate-pulse">{selected.sparkle}</div>
          </div>
        </section>

        <section className="rounded-3xl border-2 border-pink-200/80 bg-white/80 p-5 shadow-lg shadow-pink-100 backdrop-blur">
          <h2 className="mb-3 text-center text-lg font-bold text-pink-800">
            2. What&apos;s your name?
          </h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name here..."
            maxLength={20}
            className={`w-full rounded-2xl border-2 bg-pink-50 px-4 py-3.5 text-center text-lg font-semibold text-slate-800 outline-none transition placeholder:text-pink-300 focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-200 ${
              shakeName ? "animate-shake border-rose-400" : "border-pink-200"
            }`}
          />
        </section>

        <section className="rounded-3xl border-2 border-amber-200/80 bg-white/80 p-5 shadow-lg shadow-amber-100 backdrop-blur">
          <h2 className="mb-3 text-center text-lg font-bold text-amber-800">
            3. How old are you? (5 to 12)
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {AGE_OPTIONS.map((a) => {
              const selected = age === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAge(a)}
                  className={`h-12 w-12 rounded-2xl text-lg font-bold transition-all active:scale-95 ${
                    selected
                      ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-200 scale-110"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-sm font-medium text-slate-500">
            Ages 5 to 12 welcome in this kitchen!
          </p>
        </section>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-3xl bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 px-6 py-4 text-xl font-black uppercase tracking-wide text-white shadow-xl shadow-rose-200 transition hover:brightness-105 active:scale-[0.98]"
      >
        Start Cooking! 🚀
      </button>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.45s ease-in-out; }
      `}</style>
    </div>
  );
}

function KitchenScreen({
  character,
  chefName,
  age,
  foodQuery,
  setFoodQuery,
  onFind,
  onSuggestion,
  onBack,
  selectedCategory,
  setSelectedCategory,
  filteredChips,
}: {
  character: Character;
  chefName: string;
  age: number;
  foodQuery: string;
  setFoodQuery: (q: string) => void;
  onFind: () => void;
  onSuggestion: (label: string) => void;
  onBack: () => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  filteredChips: typeof suggestionChips;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl bg-white/85 px-3.5 py-2 text-sm font-bold text-orange-700 shadow-md border border-orange-100 transition hover:bg-orange-50"
        >
          ← Change Profile
        </button>
        <div className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${character.gradient} px-3 py-1.5 shadow-lg`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md overflow-hidden">
            {character.image ? (
              <img src={character.image} alt={character.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-2xl">{character.emoji}</span>
            )}
          </div>
          <div className="text-left leading-tight pr-2">
            <p className="text-sm font-black text-white drop-shadow">{chefName}</p>
            <p className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
              Super Chef • Age {age}
            </p>
          </div>
          <div className="text-xl animate-pulse">{character.sparkle}</div>
        </div>
      </div>

      <div className="mb-6 rounded-3xl bg-gradient-to-br from-orange-400 via-rose-400 to-pink-500 p-6 text-white shadow-xl shadow-rose-200">
        <p className="text-xs font-black uppercase tracking-widest text-white/80">
          Your Digital Kitchen
        </p>
        <h2 className="mt-1 text-3xl font-black">
          What are we cooking, {chefName}?
        </h2>
        <p className="mt-2 text-sm font-medium text-white/90">
          Search for absolutely anything in the world! If we don&apos;t have it, we will make up a recipe just for you.
        </p>
      </div>

      <section className="rounded-3xl border-2 border-orange-200 bg-white/95 p-5 shadow-lg backdrop-blur">
        <label className="mb-2 block text-center text-lg font-black text-orange-800">
          Enter any recipe name! 🥘
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={foodQuery}
            onChange={(e) => setFoodQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onFind()}
            placeholder="e.g. delicious waffles..."
            className="flex-1 rounded-2xl border-2 border-orange-200 bg-orange-50/50 px-4 py-3.5 text-lg font-bold outline-none transition placeholder:text-orange-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-200"
          />
          <button
            type="button"
            onClick={onFind}
            disabled={!foodQuery.trim()}
            className="rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3.5 text-lg font-black text-white shadow-md transition enabled:hover:brightness-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Let&apos;s Cook! 🍳
          </button>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-center text-xs font-black uppercase tracking-wider text-slate-500">
          Browse Categories
        </h3>
        <div className="mb-4 flex flex-wrap justify-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                selectedCategory === cat.id
                  ? "bg-rose-500 text-white shadow-md scale-105"
                  : "bg-white text-slate-600 hover:bg-rose-50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {filteredChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onSuggestion(chip.label)}
              className="rounded-2xl border-2 border-white bg-white/90 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:scale-105 hover:border-orange-200 hover:bg-orange-50 active:scale-95"
            >
              {chip.emoji} {chip.label}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-auto pt-8 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          🛡️ Helper Alert: Remember to ask a grown-up for heat or cutting!
        </p>
      </div>
    </div>
  );
}

function RecipeScreen({
  character,
  chefName,
  recipe,
  checkedIngredients,
  toggleIngredient,
  onStartCooking,
  onBack,
}: {
  character: Character;
  chefName: string;
  recipe: Recipe;
  checkedIngredients: Record<number, boolean>;
  toggleIngredient: (i: number) => void;
  onStartCooking: () => void;
  onBack: () => void;
}) {
  const allChecked =
    recipe.ingredients.length > 0 &&
    recipe.ingredients.every((_, i) => checkedIngredients[i]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold text-orange-700 shadow border border-orange-100"
        >
          ← Kitchen
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow border border-orange-100">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${character.gradient}`}>
            <span className="text-sm">{character.emoji}</span>
          </div>
          <span className="text-sm font-bold text-slate-700">{chefName}</span>
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-xl">
        <div className="bg-gradient-to-r from-orange-400 via-rose-400 to-pink-500 px-5 py-6 text-center text-white">
          <div className="text-6xl drop-shadow">{recipe.emoji}</div>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">{recipe.name}</h2>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
              ⏱️ {recipe.time}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
              🍽️ {recipe.servings}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${difficultyColor(recipe.difficulty)}`}
            >
              {recipe.difficulty}
            </span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-orange-800">
            <span>🛒</span> Check your ingredients!
            <span className="ml-auto text-xs font-bold text-slate-400">
              Tap to check
            </span>
          </h3>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => {
              const checked = !!checkedIngredients[i];
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggleIngredient(i)}
                    className={`flex w-full items-start gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition ${
                      checked
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-orange-100 bg-orange-50/50 hover:border-orange-200"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                        checked
                          ? "bg-emerald-400 text-white"
                          : "bg-white text-orange-300 border border-orange-200"
                      }`}
                    >
                      {checked ? "✓" : i + 1}
                    </span>
                    <span
                      className={`text-sm font-bold sm:text-base ${
                        checked ? "text-emerald-700 line-through opacity-70" : "text-slate-700"
                      }`}
                    >
                      {ing}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-bold text-amber-900">
              💡 Chef Tip: {recipe.tip}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartCooking}
        className="mt-auto w-full rounded-3xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-4 text-xl font-black text-white shadow-xl shadow-emerald-200 transition hover:brightness-105 active:scale-[0.98]"
      >
        {allChecked ? "All ready — Start Cooking! 🎉" : "Start Step by Step! 👨‍🍳"}
      </button>
      <p className="mt-2 text-center text-xs font-medium text-slate-500">
        You can start cooking anytime, even without checking everything!
      </p>
    </div>
  );
}

function CookingScreen({
  character,
  chefName,
  recipe,
  stepIndex,
  progress,
  onNext,
  onPrev,
  onBack,
  isSpeaking,
  onSpeak,
}: {
  character: Character;
  chefName: string;
  recipe: Recipe;
  stepIndex: number;
  progress: number;
  onNext: () => void;
  onPrev: () => void;
  onBack: () => void;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
}) {
  const step = recipe.steps[stepIndex];
  const isLast = stepIndex === recipe.steps.length - 1;
  const stepEmoji = ["👋", "🧼", "🥣", "🥄", "🔥", "✨", "🎯", "😋", "🏆", "💛"][
    stepIndex % 10
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold text-orange-700 shadow border border-orange-100"
        >
          ← Recipe details
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow border border-orange-100">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${character.gradient}`}>
            <span className="text-sm">{character.emoji}</span>
          </div>
          <span className="text-sm font-bold text-slate-700">{chefName}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm font-bold">
          <span className="text-orange-700">
            {recipe.emoji} {recipe.name}
          </span>
          <span className="text-slate-500">
            Step {stepIndex + 1} of {recipe.steps.length}
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-white shadow-inner border border-orange-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 via-rose-400 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full rounded-3xl border-2 border-orange-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-pink-100 text-3xl shadow-inner">
              {stepEmoji}
            </div>
            {/* Playful voice speaker button */}
            <button
              onClick={() => onSpeak(step)}
              className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-all active:scale-95 ${
                isSpeaking
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-rose-100 text-rose-700 hover:bg-rose-200"
              }`}
              title="Hear Step Aloud"
            >
              <span className="text-xl">{isSpeaking ? "🔇" : "🔊"}</span>
            </button>
          </div>
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-orange-400">
            Step {stepIndex + 1}
          </p>
          <p className="text-xl font-bold leading-relaxed text-slate-800 sm:text-2xl">
            {step}
          </p>

          {step.toLowerCase().includes("grown-up") && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-center">
              <p className="text-xs font-black text-rose-700">
                ⚠️ Grown-up helper needed for this step!
              </p>
            </div>
          )}

          {/* Interactive timer or sensory mini-game */}
          <InteractiveCookingWidget stepText={step} />
        </div>

        <div className="mt-4 flex gap-1.5">
          {recipe.steps.map((_, i) => (
            <div
              key={i}
              className={`h-2.5 rounded-full transition-all ${
                i === stepIndex
                  ? "w-6 bg-rose-400"
                  : i < stepIndex
                    ? "w-2.5 bg-emerald-400"
                    : "w-2.5 bg-orange-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="flex-1 rounded-2xl border-2 border-orange-200 bg-white px-4 py-3.5 text-lg font-bold text-orange-700 shadow transition enabled:hover:bg-orange-50 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-[2] rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3.5 text-lg font-black text-white shadow-lg shadow-rose-200 transition hover:brightness-105 active:scale-95"
        >
          {isLast ? "I Finished! 🎉" : "Next Step →"}
        </button>
      </div>
    </div>
  );
}

function DoneScreen({
  character,
  chefName,
  recipe,
  onCookAgain,
  onNewRecipe,
}: {
  character: Character;
  chefName: string;
  recipe: Recipe;
  onCookAgain: () => void;
  onNewRecipe: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-4 flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onNewRecipe}
          className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold text-orange-700 shadow border border-orange-100"
        >
          ← Back to Kitchen
        </button>
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow border border-orange-100">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${character.gradient}`}>
            <span className="text-sm">{character.emoji}</span>
          </div>
          <span className="text-sm font-bold text-slate-700">{chefName}</span>
        </div>
      </div>

      <div className={`w-full rounded-3xl border-2 border-emerald-200 bg-gradient-to-br ${character.gradient} p-8 shadow-xl`}>
        <div className="mb-2 flex justify-center">
          <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-white/90 shadow-2xl overflow-hidden animate-bounce`}>
            {character.image ? (
              <img src={character.image} alt={character.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-7xl">{character.emoji}</span>
            )}
          </div>
        </div>
        <div className="mb-2 text-sm font-black text-white/90 uppercase tracking-widest">
          🏆 Super Chef Award 🏆
        </div>
        <div className="mb-4 text-5xl">{recipe.emoji} 🎉</div>
        <h2 className="text-3xl font-black text-white drop-shadow">You did it!</h2>
        <p className="mt-3 text-lg font-bold text-white/95">
          Amazing job, Chef {chefName}!
        </p>
        <p className="mt-2 text-base font-medium text-white/90">
          You made <span className="font-bold text-white">{recipe.name}</span>.
          Time to taste your creation!
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {["⭐", "⭐", "⭐"].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white/90 py-3 text-3xl shadow-inner"
            >
              {s}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-black text-white uppercase tracking-widest drop-shadow">
          3-star chef award!
        </p>
      </div>

      <div className="mt-6 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onNewRecipe}
          className="w-full rounded-3xl bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-4 text-xl font-black text-white shadow-xl shadow-rose-200 transition hover:brightness-105 active:scale-[0.98]"
        >
          Cook Something New! 🍳
        </button>
        <button
          type="button"
          onClick={onCookAgain}
          className="w-full rounded-3xl border-2 border-orange-200 bg-white px-6 py-3.5 text-lg font-bold text-orange-700 shadow transition hover:bg-orange-50 active:scale-[0.98]"
        >
          Practice These Steps Again
        </button>
      </div>

      <p className="mt-6 text-sm font-medium text-slate-500">
        Don&apos;t forget to help clean up, superstar! 🧽✨
      </p>
    </div>
  );
}
