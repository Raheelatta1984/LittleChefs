import { useEffect, useRef, useState } from "react";
import type { Ingredient, ImportJobView, RecipeDraft, RecipeView, Step } from "../../shared/types";
import { api, ApiClientError } from "../lib/api";
import { YouTubePlayer } from "./YouTubePlayer";
import { playPop, playSuccess } from "../utils/audio";

type Phase = "input" | "loading" | "review" | "saving";
type InputMode = "link" | "scan";

/** Shrinks a phone photo to a scan-friendly size (faster OCR, under the upload cap). */
async function downscaleImage(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("decode failed"));
      image.src = original;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale >= 1 && original.length < 3_500_000) return original;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return original;
  }
}

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
  autoStart = false,
  allowAiFallback = false,
  draftHint = null,
  onClose,
  onSaved,
  onSavedAndOnboard,
  onOpenBrowser,
}: {
  token: string;
  canPublish: boolean;
  initialQuery: string;
  autoStart?: boolean;
  allowAiFallback?: boolean;
  draftHint?: RecipeDraft | null;
  onClose: () => void;
  onSaved: (recipe: RecipeView) => void;
  onSavedAndOnboard?: (recipe: RecipeView) => void;
  onOpenBrowser?: (query: string, tab?: "website" | "youtube") => void;
}) {
  const [phase, setPhase] = useState<Phase>(autoStart && initialQuery.trim() ? "loading" : "input");
  const [mode, setMode] = useState<InputMode>("link");
  const [loadingLabel, setLoadingLabel] = useState("Reading the recipe…");
  const [input, setInput] = useState(initialQuery);
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanDataUrl, setScanDataUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const autoRanRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function runImport(overrideValue?: string) {
    const value = (overrideValue ?? input).trim();
    if (!value) {
      setError("Type a dish name, paste a recipe link, a YouTube link, or the recipe description.");
      return;
    }
    setLoadingLabel("Reading the recipe…");
    setPhase("loading");
    setError(null);
    try {
      const result = await api.startImport(token, value, {
        allowAiFallback,
        draftHint: value === initialQuery.trim() ? draftHint : null,
      });
      setJob(result);
      setOcrText(null);
      setDraft(draftFromJob(result));
      setPhase("review");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Import failed.");
      setPhase("input");
    }
  }

  useEffect(() => {
    if (!autoStart || autoRanRef.current || !initialQuery.trim()) return;
    autoRanRef.current = true;
    void runImport(initialQuery.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickScanPhoto(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      setScanDataUrl(await downscaleImage(file));
    } catch {
      setError("That photo couldn't be opened. Try a different picture.");
    }
  }

  /** 📷 OCR path: photo/screenshot → recognised text → same AI-onboarding review. */
  async function runOcrImport() {
    if (!scanDataUrl) {
      setError("Take or choose a photo of the recipe first.");
      return;
    }
    setLoadingLabel("Scanning your photo…");
    setPhase("loading");
    setError(null);
    try {
      const result = await api.ocrImport(token, scanDataUrl);
      setJob(result.job);
      setOcrText(result.ocrText);
      setDraft(draftFromJob(result.job));
      setPhase("review");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Scanning failed.");
      setPhase("input");
    }
  }

  async function save(startOnboarding = false) {
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
      if (startOnboarding && onSavedAndOnboard) {
        onSavedAndOnboard(recipe);
      } else {
        onSaved(recipe);
      }
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
            <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="How to add the recipe">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "link"}
                onClick={() => { playPop(); setMode("link"); setError(null); }}
                className={`rounded-2xl py-2.5 text-xs font-black transition active:scale-95 ${
                  mode === "link"
                    ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                🔗 Dish, link or text
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "scan"}
                onClick={() => { playPop(); setMode("scan"); setError(null); }}
                className={`rounded-2xl py-2.5 text-xs font-black transition active:scale-95 ${
                  mode === "scan"
                    ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                📷 Scan a photo (OCR)
              </button>
            </div>

            {mode === "link" && (
              <>
                <label htmlFor="import-input" className="mt-4 block text-sm font-black text-slate-600">
                  Dish name, recipe link or description
                </label>
                <textarea
                  id="import-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={5}
                  placeholder={"Chicken Balochi Karahi from Food Fusion\n\nor a link:\nhttps://www.foodfusion.com/recipe/…\nhttps://www.youtube.com/watch?v=…\n\nor paste:\nIngredients:\n- 2 cups rice\nMethod:\n1. Boil the rice…"}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-3 font-semibold outline-none focus:border-orange-400"
                />
                <p className="mt-2 rounded-2xl bg-sky-50 p-3 text-[11px] font-bold text-sky-800 ring-1 ring-sky-100">
                  🔎 Just a dish name works too! We check your book &amp; the shared catalogue first, then the
                  chef&apos;s website (e.g. Food Fusion), then YouTube — the recipe is usually hiding in the
                  video description. 📺
                </p>
              </>
            )}

            {mode === "scan" && (
              <div className="mt-4">
                <p className="text-sm font-black text-slate-600">Photo or screenshot of the recipe</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  A cookbook page, a screenshot from a video, a handwritten card — keep it flat, bright and
                  straight-on. We&apos;ll read the words (OCR), then AI Onboarding maps the ingredients &amp; steps.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  aria-label="Choose a recipe photo to scan"
                  onChange={(event) => void pickScanPhoto(event.target.files?.[0] ?? null)}
                />
                {scanDataUrl ? (
                  <div className="mt-3 overflow-hidden rounded-2xl ring-2 ring-orange-200">
                    <img src={scanDataUrl} alt="Recipe photo ready to scan" className="max-h-64 w-full object-contain bg-slate-50" />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => { playPop(); fileInputRef.current?.click(); }}
                  className="mt-3 w-full rounded-3xl bg-sky-50 py-3 text-sm font-black text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 active:scale-95"
                >
                  {scanDataUrl ? "📷 Choose a different photo" : "📷 Take / choose a photo"}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-2 rounded-2xl bg-red-50 p-3 ring-1 ring-red-200" role="alert">
                <p className="text-sm font-bold text-red-700">{error}</p>
                <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-red-400">Try another way:</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {onOpenBrowser && (
                    <button
                      type="button"
                      onClick={() => { playPop(); onOpenBrowser(input.trim(), "youtube"); }}
                      className="rounded-xl bg-white py-2 text-[11px] font-black text-red-600 ring-1 ring-red-200 transition active:scale-95"
                    >
                      ▶️ YouTube
                    </button>
                  )}
                  {onOpenBrowser && (
                    <button
                      type="button"
                      onClick={() => { playPop(); onOpenBrowser(input.trim(), "website"); }}
                      className="rounded-xl bg-white py-2 text-[11px] font-black text-sky-700 ring-1 ring-sky-200 transition active:scale-95"
                    >
                      🌐 Websites
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { playPop(); setMode(mode === "scan" ? "link" : "scan"); setError(null); }}
                    className="rounded-xl bg-white py-2 text-[11px] font-black text-fuchsia-700 ring-1 ring-fuchsia-200 transition active:scale-95"
                  >
                    {mode === "scan" ? "🔗 Type / paste" : "📷 Scan photo"}
                  </button>
                </div>
              </div>
            )}

            {mode === "link" ? (
              <button
                type="button"
                onClick={() => void runImport()}
                className="mt-4 w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3.5 font-black text-white shadow-lg transition active:scale-95"
              >
                🔮 Import &amp; map this recipe
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void runOcrImport()}
                disabled={!scanDataUrl}
                className="mt-4 w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3.5 font-black text-white shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                🔎 Scan &amp; read this recipe
              </button>
            )}

            {onOpenBrowser && (
              <button
                type="button"
                onClick={() => {
                  playPop();
                  onOpenBrowser(input.trim());
                }}
                className="mt-2 w-full rounded-3xl bg-sky-50 py-3 text-sm font-black text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 active:scale-95"
              >
                🌐 Don&apos;t have a link yet? Browse Websites &amp; YouTube In-App
              </button>
            )}
            <p className="mt-2 text-center text-[11px] font-bold text-slate-400">
              You&apos;ll review everything before it is saved to your private book.
            </p>
          </>
        )}

        {phase === "loading" && (
          <div className="py-12 text-center">
            <p className="text-5xl" style={{ animation: "pop 1s ease-in-out infinite" }} aria-hidden="true">🍳</p>
            <p className="mt-4 font-black text-slate-700">{loadingLabel}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {loadingLabel.startsWith("Scanning")
                ? "Reading the words in your photo, then mapping the ingredients and steps."
                : "Checking your book & the shared catalogue, then the chef's website, then YouTube descriptions — mapping each step and collecting the photos."}
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

            {ocrText && (
              <details className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <summary className="cursor-pointer text-xs font-black text-slate-600">
                  📷 Words we read from your photo — fix any mistakes &amp; re-read
                </summary>
                <textarea
                  value={ocrText}
                  onChange={(event) => setOcrText(event.target.value)}
                  rows={8}
                  aria-label="Scanned recipe text"
                  className="mt-2 w-full rounded-xl border-2 border-slate-200 p-2 text-xs font-semibold outline-none focus:border-orange-400"
                />
                <button
                  type="button"
                  onClick={() => { setInput(ocrText); void runImport(ocrText); }}
                  className="mt-2 w-full rounded-xl bg-white py-2 text-xs font-black text-fuchsia-700 ring-1 ring-fuchsia-200 transition active:scale-95"
                >
                  🔁 Re-read the fixed text with AI Onboarding
                </button>
              </details>
            )}

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

            {draft.sourceVideoId && (
              <YouTubePlayer youtubeIdOrUrl={draft.sourceVideoId} title={draft.title} />
            )}

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

            {onSavedAndOnboard && (
              <button
                type="button"
                onClick={() => void save(true)}
                disabled={phase === "saving"}
                className="w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 py-3.5 font-black text-white shadow-lg transition active:scale-95 disabled:opacity-60"
              >
                {phase === "saving"
                  ? "Saving & opening AI Onboarding…"
                  : "🍽️ Save & Start AI Onboarding (Portions & Shopping List)"}
              </button>
            )}

            <button
              type="button"
              onClick={() => void save(false)}
              disabled={phase === "saving"}
              className={`w-full rounded-3xl py-3.5 font-black transition active:scale-95 disabled:opacity-60 ${
                onSavedAndOnboard
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
              }`}
            >
              {phase === "saving" ? "Saving to my book…" : "✅ Save to my private book"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
