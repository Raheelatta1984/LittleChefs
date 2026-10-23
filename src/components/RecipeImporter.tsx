import { useState } from "react";
import type { Ingredient, ImportJobView, RecipeDraft, RecipeView, Step } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { playPop, playSuccess } from "../utils/audio";

type Phase = "input" | "loading" | "review" | "saving";

function draftFromJob(job: ImportJobView): RecipeDraft {
  const draft = job.draft;
  if (!draft) {
    return {
      title: job.inputValue.slice(0, 80),
      cuisine: null,
      description: null,
      difficulty: "Easy",
      baseServings: 4,
      totalMinutes: null,
      heroImageUrl: null,
      sourceType: "web",
      sourceUrl: job.inputValue.startsWith("http") ? job.inputValue : null,
      sourceVideoId: null,
      sourceChannel: null,
      sourceAuthor: null,
      ingredients: [],
      steps: [],
    };
  }
  return {
    ...draft,
    ingredients: draft.ingredients.map((ingredient, index) => ({ ...ingredient, position: index })),
    steps: draft.steps.map((step, index) => ({ ...step, position: index })),
  };
}

export function RecipeImporter({
  token,
  canPublish,
  initialQuery,
  onClose,
  onSaved,
}: {
  token: string;
  canPublish: boolean;
  initialQuery: string;
  onClose: () => void;
  onSaved: (recipe: RecipeView) => void;
}) {
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState(initialQuery);
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    if (!input.trim()) {
      setError("Paste a recipe link, a YouTube link, or the recipe description.");
      return;
    }
    setPhase("loading");
    setError(null);
    try {
      const result = await api.startImport(token, input.trim());
      setJob(result);
      setDraft(draftFromJob(result));
      setPhase("review");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Import failed.");
      setPhase("input");
    }
  }

  async function save() {
    if (!job || !draft) return;
    if (draft.ingredients.length === 0 || draft.steps.length === 0) {
      setError("Add at least one ingredient and one step before saving.");
      return;
    }
    setPhase("saving");
    setError(null);
    try {
      const result = await api.confirmImport(token, job.id, draft);
      const recipe = await api.getRecipe(token, result.recipeId);
      playSuccess();
      onSaved(recipe);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Could not save this recipe.");
      setPhase("review");
    }
  }

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    setDraft((current) => {
      if (!current) return current;
      const ingredients = current.ingredients.map((ingredient, i) =>
        i === index ? { ...ingredient, ...patch } : ingredient,
      );
      return { ...current, ingredients };
    });
  }

  function updateStep(index: number, instruction: string) {
    setDraft((current) => {
      if (!current) return current;
      const steps = current.steps.map((step, i) => (i === index ? { ...step, instruction } : step));
      return { ...current, steps };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-2 sm:items-center" role="dialog" aria-modal="true" aria-label="AI recipe onboarding">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-800">🤖 AI Recipe Onboarding</h2>
            <p className="text-xs font-bold text-slate-500">
              Website, YouTube or pasted description → ingredients, steps, photos and a shopping list.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { playPop(); onClose(); }}
            aria-label="Close importer"
            className="rounded-full bg-slate-100 px-3 py-2 font-black text-slate-500 transition active:scale-95"
          >
            ✕
          </button>
        </div>

        {phase === "input" && (
          <>
            <label htmlFor="import-input" className="mt-4 block text-sm font-black text-slate-600">
              Recipe link or description
            </label>
            <textarea
              id="import-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={5}
              placeholder={"https://www.example.com/chicken-biryani\n\nor\n\nhttps://www.youtube.com/watch?v=…\n\nor paste:\nIngredients:\n- 2 cups rice\nMethod:\n1. Boil the rice…"}
              className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-3 font-semibold outline-none focus:border-orange-400"
            />
            <p className="mt-2 rounded-2xl bg-sky-50 p-3 text-[11px] font-bold text-sky-800 ring-1 ring-sky-100">
              🔎 We check your own book and the shared catalogue first — a dish we already know is copied
              instantly, with no internet needed.
            </p>
            {error && (
              <p className="mt-2 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 ring-1 ring-red-200" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void runImport()}
              className="mt-4 w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3.5 font-black text-white shadow-lg transition active:scale-95"
            >
              🔮 Import &amp; map this recipe
            </button>
            <p className="mt-2 text-center text-[11px] font-bold text-slate-400">
              You&apos;ll review everything before it is saved to your private book.
            </p>
          </>
        )}

        {phase === "loading" && (
          <div className="py-12 text-center">
            <p className="text-5xl" style={{ animation: "pop 1s ease-in-out infinite" }} aria-hidden="true">🍳</p>
            <p className="mt-4 font-black text-slate-700">Reading the recipe…</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Finding the ingredients, mapping each step and collecting the photos.
            </p>
          </div>
        )}

        {(phase === "review" || phase === "saving") && draft && (
          <div className="mt-4 space-y-3">
            {job?.warnings.map((warning) => (
              <p key={warning} className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
                ⚠️ {warning}
              </p>
            ))}

            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                {job?.method ?? "import"}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                confidence {Math.round((job?.confidence ?? 0) * 100)}%
              </span>
              <span className="ml-auto text-[11px] font-bold text-slate-400">
                {draft.ingredients.length} ingredients • {draft.steps.length} steps
              </span>
            </div>

            <label className="block text-sm font-black text-slate-600" htmlFor="import-title">
              Recipe name
            </label>
            <input
              id="import-title"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              className="w-full rounded-2xl border-2 border-slate-200 px-3 py-2 font-bold outline-none focus:border-orange-400"
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-black text-slate-600">
                Servings
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.baseServings}
                  onChange={(event) =>
                    setDraft({ ...draft, baseServings: Math.max(1, Number(event.target.value) || 1) })
                  }
                  className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-3 py-2 font-bold outline-none focus:border-orange-400"
                />
              </label>
              <label className="block text-sm font-black text-slate-600">
                Minutes
                <input
                  type="number"
                  min={1}
                  max={2880}
                  value={draft.totalMinutes ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      totalMinutes: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-3 py-2 font-bold outline-none focus:border-orange-400"
                />
              </label>
            </div>

            <label className="block text-sm font-black text-slate-600" htmlFor="import-image">
              Photo link
            </label>
            <input
              id="import-image"
              value={draft.heroImageUrl ?? ""}
              onChange={(event) => setDraft({ ...draft, heroImageUrl: event.target.value || null })}
              placeholder="https://…"
              className="w-full rounded-2xl border-2 border-slate-200 px-3 py-2 font-bold outline-none focus:border-orange-400"
            />

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-600">Ingredients</p>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      ingredients: [
                        ...draft.ingredients,
                        {
                          position: draft.ingredients.length,
                          quantity: 1,
                          unit: null,
                          item: "",
                          prepNote: null,
                          groupName: null,
                          scalable: true,
                          rawText: null,
                        },
                      ],
                    })
                  }
                  className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-black text-slate-600"
                >
                  + Add
                </button>
              </div>
              <ul className="mt-1 space-y-1.5">
                {draft.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.25"
                      value={ingredient.quantity ?? ""}
                      onChange={(event) =>
                        updateIngredient(index, {
                          quantity: event.target.value === "" ? null : Number(event.target.value),
                          scalable: event.target.value !== "",
                        })
                      }
                      placeholder="qty"
                      aria-label={`Quantity ${index + 1}`}
                      className="w-16 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:border-orange-400"
                    />
                    <input
                      value={ingredient.unit ?? ""}
                      onChange={(event) => updateIngredient(index, { unit: event.target.value || null })}
                      placeholder="unit"
                      aria-label={`Unit ${index + 1}`}
                      className="w-16 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:border-orange-400"
                    />
                    <input
                      value={ingredient.item}
                      onChange={(event) => updateIngredient(index, { item: event.target.value })}
                      placeholder="ingredient"
                      aria-label={`Ingredient ${index + 1}`}
                      className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:border-orange-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          ingredients: draft.ingredients.filter((_, i) => i !== index),
                        })
                      }
                      aria-label={`Remove ingredient ${index + 1}`}
                      className="px-1 text-slate-300 transition hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-600">Steps</p>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      steps: [
                        ...draft.steps,
                        {
                          position: draft.steps.length,
                          instruction: "",
                          durationSeconds: null,
                          temperatureC: null,
                          imageUrl: null,
                          tip: null,
                        } satisfies Step,
                      ],
                    })
                  }
                  className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-black text-slate-600"
                >
                  + Add
                </button>
              </div>
              <ol className="mt-1 space-y-1.5">
                {draft.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-1.5">
                    <span className="mt-2 w-5 shrink-0 text-center text-xs font-black text-slate-400">
                      {index + 1}
                    </span>
                    <textarea
                      value={step.instruction}
                      onChange={(event) => updateStep(index, event.target.value)}
                      rows={2}
                      aria-label={`Step ${index + 1}`}
                      className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-sm font-semibold outline-none focus:border-orange-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })
                      }
                      aria-label={`Remove step ${index + 1}`}
                      className="mt-1 px-1 text-slate-300 transition hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            {error && (
              <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 ring-1 ring-red-200" role="alert">
                {error}
              </p>
            )}

            {canPublish && (
              <p className="rounded-2xl bg-emerald-50 p-3 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100">
                🌍 As a {canPublish ? "senior" : "junior"} chef, this recipe is also added to the shared
                catalogue — other chefs can cook it, but they never see your name or your private notes.
              </p>
            )}

            <button
              type="button"
              onClick={() => void save()}
              disabled={phase === "saving"}
              className="w-full rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-black text-white shadow-lg transition active:scale-95 disabled:opacity-60"
            >
              {phase === "saving" ? "Saving to my book…" : "✅ Save to my private book"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
