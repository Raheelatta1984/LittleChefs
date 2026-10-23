import type { RecipeView } from "../../shared/types";
import { playPop } from "../utils/audio";
import { emojiFor } from "../lib/adapters";
import { YouTubePlayer, extractYouTubeId } from "./YouTubePlayer";

export function DbRecipeDetail({
  recipe,
  onBack,
  onStartPrep,
  onDelete,
  deleting,
  onOpenSource,
}: {
  recipe: RecipeView;
  onBack: () => void;
  onStartPrep: () => void;
  onDelete: () => void;
  deleting: boolean;
  onOpenSource?: (url: string) => void;
}) {
  const videoId = recipe.sourceVideoId ?? extractYouTubeId(recipe.sourceUrl);
  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { playPop(); onBack(); }}
          className="rounded-xl bg-white px-3 py-2 font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
        >
          ← Back
        </button>
        <span className="ml-auto rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
          🔒 only me
        </span>
      </div>

      {videoId ? (
        <YouTubePlayer youtubeIdOrUrl={videoId} title={recipe.title} />
      ) : recipe.heroImageUrl ? (
        <img
          src={recipe.heroImageUrl}
          alt={recipe.title}
          className="max-h-60 w-full rounded-3xl object-cover shadow-lg"
          loading="lazy"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-200 to-pink-200 text-7xl shadow-inner" aria-hidden="true">
          {emojiFor(recipe.title)}
        </div>
      )}

      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-800">{emojiFor(recipe.title)} {recipe.title}</h2>
        {recipe.sourceUrl && (
          <button
            type="button"
            onClick={() => {
              playPop();
              onOpenSource?.(recipe.sourceUrl!);
            }}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 active:scale-95"
          >
            {recipe.sourceType === "youtube" ? "📺" : "🌐"}{" "}
            {recipe.sourceChannel ?? recipe.sourceAuthor ?? "Open source inside app"}
          </button>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm font-extrabold">
          {recipe.totalMinutes ? (
            <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-700 ring-1 ring-orange-200">⏱️ {recipe.totalMinutes} min</span>
          ) : null}
          <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-700 ring-1 ring-sky-200">📊 {recipe.difficulty ?? "Easy"}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200">
            🍽️ {recipe.baseServings} servings
          </span>
          {recipe.cuisine ? (
            <span className="rounded-full bg-fuchsia-100 px-3 py-1.5 text-fuchsia-700 ring-1 ring-fuchsia-200">🌍 {recipe.cuisine}</span>
          ) : null}
        </div>
      </div>

      {recipe.description && (
        <p className="rounded-3xl bg-white/90 p-4 text-sm font-semibold text-slate-600 shadow ring-1 ring-orange-100">
          {recipe.description}
        </p>
      )}

      <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-orange-100" aria-label="Ingredients">
        <h3 className="font-black text-slate-800">🛒 Ingredients <span className="text-sm font-bold text-slate-400">({recipe.ingredients.length})</span></h3>
        <ul className="mt-2 space-y-1.5">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">
                {ingredient.item}
                {ingredient.prepNote ? <span className="text-slate-400">, {ingredient.prepNote}</span> : null}
              </span>
              <span className="shrink-0 text-sm font-black text-orange-600">
                {ingredient.quantity === null ? "to taste" : `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-orange-100" aria-label="Steps">
        <h3 className="font-black text-slate-800">👩‍🍳 Steps <span className="text-sm font-bold text-slate-400">({recipe.steps.length})</span></h3>
        <ol className="mt-2 space-y-3">
          {recipe.steps.map((step, index) => (
            <li key={step.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Step {index + 1}
                  {step.durationSeconds ? ` • ${Math.round(step.durationSeconds / 60)} min` : ""}
                  {step.temperatureC ? ` • ${step.temperatureC}°C` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-700">{step.instruction}</p>
              {step.imageUrl ? (
                <img src={step.imageUrl} alt="" className="mt-2 max-h-40 w-full rounded-xl object-cover" loading="lazy" />
              ) : (
                <div className="mt-2 flex h-16 items-center justify-center rounded-xl bg-gradient-to-r from-orange-100 to-pink-100 text-xs font-bold text-orange-500">
                  📷 no photo for this step
                </div>
              )}
              {step.tip && <p className="mt-2 text-xs font-bold text-amber-700">💡 {step.tip}</p>}
            </li>
          ))}
        </ol>
      </section>

      {recipe.notes && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          📝 {recipe.notes}
        </p>
      )}

      <button
        type="button"
        onClick={onStartPrep}
        className="w-full rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 py-4 text-lg font-black text-white shadow-xl transition active:scale-95"
      >
        🤖 Prep &amp; shopping list
      </button>
      <p className="-mt-2 text-center text-xs font-bold text-slate-400">
        Tell us how many people, the meal and what you already have — we&apos;ll scale everything and write the list.
      </p>

      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="w-full rounded-3xl bg-white py-3 font-black text-red-500 ring-2 ring-red-100 transition hover:bg-red-50 active:scale-95 disabled:opacity-60"
      >
        {deleting ? "Deleting…" : "🗑️ Delete from my book"}
      </button>
    </main>
  );
}
