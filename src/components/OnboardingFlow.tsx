import { useMemo, useState } from "react";
import {
  MEAL_OCCASIONS, type MealOccasion, type OnboardingResult, type RecipeView, type ShoppingListView,
} from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { playDing, playPop, playSuccess } from "../utils/audio";

const DIETARY = [
  { id: "vegetarian", label: "🥕 Vegetarian" },
  { id: "vegan", label: "🌱 Vegan" },
  { id: "nut-allergy", label: "🥜 Nut allergy" },
  { id: "gluten-free", label: "🌾 Gluten-free" },
  { id: "dairy-free", label: "🥛 Dairy-free" },
];

const PANTRY_CHIPS = ["salt", "pepper", "oil", "sugar", "flour", "rice", "eggs", "milk", "butter", "cumin", "turmeric", "onions", "garlic"];

const PORTIONS = [1, 2, 3, 4, 6, 8];

export function OnboardingFlow({
  recipe,
  onCancel,
  onStartCooking,
}: {
  recipe: RecipeView;
  onCancel: () => void;
  onStartCooking: (result: OnboardingResult) => void;
}) {
  const [phase, setPhase] = useState<"interview" | "prep">("interview");
  const [servings, setServings] = useState(recipe.baseServings || 4);
  const [meal, setMeal] = useState<MealOccasion>("dinner");
  const [dietary, setDietary] = useState<string[]>([]);
  const [pantryText, setPantryText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [list, setList] = useState<ShoppingListView | null>(null);

  const pantry = useMemo(
    () =>
      pantryText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    [pantryText],
  );

  function toggleDiet(id: string) {
    playPop();
    setDietary((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  function togglePantry(item: string) {
    playPop();
    setPantryText((current) => {
      const entries = current.split(",").map((entry) => entry.trim()).filter(Boolean);
      if (entries.includes(item)) return entries.filter((entry) => entry !== item).join(", ");
      return [...entries, item].join(", ");
    });
  }

  async function runOnboarding() {
    setBusy(true);
    setError(null);
    try {
      const outcome = await api.onboarding(recipe.id, {
        servings,
        mealOccasion: meal,
        dietary,
        pantry,
      });
      setResult(outcome);
      setList(outcome.shoppingList);
      setPhase("prep");
      playSuccess();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Could not build your plan.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(itemId: string, checked: boolean) {
    if (!list) return;
    playPop();
    setList({
      ...list,
      items: list.items.map((item) => (item.id === itemId ? { ...item, checked } : item)),
    });
    try {
      const updated = await api.toggleShoppingItem(list.id, itemId, checked);
      setList(updated);
    } catch {
      /* keep the optimistic tick — it will resync next time */
    }
  }

  async function copyList() {
    if (!list) return;
    const text = list.groups
      .map(
        (group) =>
          `${group.emoji} ${group.label}\n${group.items
            .filter((item) => !item.alreadyAtHome)
            .map((item) => `  [ ] ${item.quantityText ? `${item.quantityText} ` : ""}${item.item}`)
            .join("\n")}`,
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(`Shopping list for ${recipe.title} (${list.servings} people)\n\n${text}`);
      playDing();
    } catch {
      window.print();
    }
  }

  if (phase === "interview") {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { playPop(); onCancel(); }}
            className="rounded-xl bg-white px-3 py-2 font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
          >
            ← Back
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-slate-800">🤖 Getting dinner ready</h2>
            <p className="truncate text-xs font-bold text-slate-500">{recipe.title}</p>
          </div>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 p-5 text-white shadow-xl">
          <h3 className="text-lg font-black">A few questions before we cook</h3>
          <p className="mt-1 text-sm font-semibold text-white/85">
            We&apos;ll adjust every ingredient to the number of people and write your shopping list.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-orange-100">
          <h3 className="font-black text-slate-800">1️⃣ How many people are eating?</h3>
          <p className="text-xs font-bold text-slate-400">
            This recipe is written for {recipe.baseServings} — we&apos;ll scale everything from there.
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => { playPop(); setServings((value) => Math.max(1, value - 1)); }}
              className="h-11 w-11 rounded-2xl bg-slate-100 text-xl font-black text-slate-600 transition active:scale-95"
              aria-label="Fewer people"
            >
              −
            </button>
            <input
              value={servings}
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(/\D/g, ""));
                setServings(Number.isFinite(parsed) && parsed > 0 ? Math.min(100, parsed) : 1);
              }}
              inputMode="numeric"
              aria-label="Number of people"
              className="w-20 rounded-2xl border-2 border-slate-200 py-2 text-center text-2xl font-black outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={() => { playPop(); setServings((value) => Math.min(100, value + 1)); }}
              className="h-11 w-11 rounded-2xl bg-slate-100 text-xl font-black text-slate-600 transition active:scale-95"
              aria-label="More people"
            >
              +
            </button>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {PORTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => { playPop(); setServings(count); }}
                className={`rounded-full px-3 py-1.5 text-sm font-black transition active:scale-95 ${
                  servings === count ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-orange-100">
          <h3 className="font-black text-slate-800">2️⃣ What meal is this for?</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MEAL_OCCASIONS.map((occasion) => (
              <button
                key={occasion.id}
                type="button"
                onClick={() => { playPop(); setMeal(occasion.id); }}
                aria-pressed={meal === occasion.id}
                className={`rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] ${
                  meal === occasion.id
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-indigo-200"
                }`}
              >
                <span className="block font-black text-slate-800">
                  {occasion.emoji} {occasion.label}
                </span>
                <span className="block text-[11px] font-bold text-slate-400">{occasion.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-orange-100">
          <h3 className="font-black text-slate-800">3️⃣ Any allergies or diets? <span className="text-xs font-bold text-slate-400">(optional)</span></h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIETARY.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleDiet(option.id)}
                aria-pressed={dietary.includes(option.id)}
                className={`rounded-full px-3 py-2 text-sm font-black transition active:scale-95 ${
                  dietary.includes(option.id)
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <h3 className="mt-4 font-black text-slate-800">4️⃣ What&apos;s already in your kitchen?</h3>
          <p className="text-xs font-bold text-slate-400">Tap the things you already have — they skip the shopping list.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PANTRY_CHIPS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => togglePantry(item)}
                aria-pressed={pantry.includes(item)}
                className={`rounded-full px-3 py-1.5 text-sm font-black transition active:scale-95 ${
                  pantry.includes(item) ? "bg-amber-400 text-amber-900" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <input
            value={pantryText}
            onChange={(event) => setPantryText(event.target.value)}
            placeholder="Anything else? Separate with commas"
            aria-label="Other ingredients you already have"
            className="mt-2 w-full rounded-2xl border-2 border-slate-200 px-4 py-2.5 font-bold outline-none focus:border-orange-400"
          />
        </section>

        {error && (
          <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 ring-1 ring-red-200" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void runOnboarding()}
          disabled={busy}
          className="w-full rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 py-4 text-lg font-black text-white shadow-xl transition active:scale-95 disabled:opacity-60"
        >
          {busy ? "Working out portions…" : `🍽️ Build my plan for ${servings} ${servings === 1 ? "person" : "people"}`}
        </button>
      </main>
    );
  }

  if (!result || !list) return null;

  const needed = list.items.filter((item) => !item.alreadyAtHome);

  return (
    <main className="flex flex-1 flex-col gap-4">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 p-5 text-white shadow-xl">
        <h2 className="text-xl font-black">{result.recipeTitle} for {result.servings} {result.servings === 1 ? "person" : "people"}</h2>
        <p className="mt-1 text-sm font-semibold text-white/90">{result.mealHint}</p>
        <p className="mt-1 text-xs font-bold text-white/80">{result.portionNote}</p>
      </section>

      {result.reminders.length > 0 && (
        <section className="space-y-2" aria-label="Important reminders">
          {result.reminders.map((reminder) => (
            <p key={reminder} className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
              ⚠️ {reminder}
            </p>
          ))}
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-orange-100">
        <h3 className="font-black text-slate-800">🥣 Scaled ingredients <span className="text-xs font-bold text-slate-400">({result.scaleFactor.toFixed(2)}× the original</span>)</h3>
        <ul className="mt-2 space-y-1.5">
          {result.ingredients.map((ingredient, index) => (
            <li key={ingredient.id ?? index} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">
                {ingredient.item}
                {ingredient.prepNote ? <span className="text-slate-400">, {ingredient.prepNote}</span> : null}
              </span>
              <span className="shrink-0 text-sm font-black text-orange-600">
                {ingredient.quantityText || "to taste"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-orange-100" aria-label="Shopping list">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-black text-slate-800">🛒 Shopping list</h3>
            <p className="text-xs font-bold text-slate-400">
              {needed.length} to buy • {list.totals.alreadyAtHome} already at home
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void copyList()}
              className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-600 transition active:scale-95"
            >
              📋 Copy
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-600 transition active:scale-95"
            >
              🖨️ Print
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {list.groups.map((group) => (
            <div key={group.aisle}>
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">
                {group.emoji} {group.label}
              </h4>
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <li key={item.id ?? `${group.aisle}-${item.item}`}>
                    <button
                      type="button"
                      onClick={() => item.id && void toggleItem(item.id, !item.checked)}
                      aria-pressed={item.checked}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition active:scale-[0.99] ${
                        item.alreadyAtHome
                          ? "bg-amber-50/60 text-slate-400 ring-1 ring-amber-100"
                          : item.checked
                            ? "bg-emerald-50 text-slate-400 ring-1 ring-emerald-100"
                            : "bg-slate-50 text-slate-700 ring-1 ring-slate-100"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-black text-white ${
                          item.alreadyAtHome ? "bg-amber-400" : item.checked ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      >
                        {item.alreadyAtHome ? "🏠" : item.checked ? "✓" : ""}
                      </span>
                      <span className={`flex-1 text-sm font-semibold ${item.checked ? "line-through" : ""}`}>
                        {item.item}
                      </span>
                      <span className="shrink-0 text-xs font-black text-slate-500">{item.quantityText}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {list.totals.alreadyAtHome > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-2 text-[11px] font-bold text-amber-800">
            🏠 = already in your kitchen, so you don&apos;t need to buy it.
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-white p-4 shadow ring-1 ring-orange-100">
        <h3 className="font-black text-slate-800">🧑‍🍳 Step preview</h3>
        <ol className="mt-2 space-y-1.5">
          {result.steps.slice(0, 4).map((step, index) => (
            <li key={step.id ?? index} className="flex gap-2 text-sm font-semibold text-slate-600">
              <span className="font-black text-orange-500">{index + 1}.</span>
              <span className="line-clamp-2">{step.instruction}</span>
            </li>
          ))}
        </ol>
        {result.steps.length > 4 && (
          <p className="mt-1 text-xs font-bold text-slate-400">+ {result.steps.length - 4} more steps</p>
        )}
      </section>

      <div className="mt-auto space-y-2">
        <button
          type="button"
          onClick={() => { playSuccess(); onStartCooking(result); }}
          className="w-full rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-lg font-black text-white shadow-xl transition active:scale-95"
        >
          ✅ Everything&apos;s ready — start cooking!
        </button>
        <button
          type="button"
          onClick={() => { playPop(); setPhase("interview"); }}
          className="w-full rounded-3xl bg-white py-3 font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
        >
          ← Change my answers
        </button>
      </div>
    </main>
  );
}
