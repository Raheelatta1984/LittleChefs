import { useMemo, useState } from "react";
import type { RecipeView } from "../../shared/types";
import { playPop } from "../utils/audio";

export function MyRecipes({
  recipes,
  loading,
  error,
  onOpen,
  onImport,
  onBrowse,
  onDelete,
  onRefresh,
  onBack,
}: {
  recipes: RecipeView[];
  loading: boolean;
  error: string | null;
  onOpen: (recipe: RecipeView) => void;
  onImport: () => void;
  onBrowse?: () => void;
  onDelete: (recipe: RecipeView) => void;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return recipes;
    return recipes.filter(
      (recipe) =>
        recipe.title.toLowerCase().includes(query) ||
        (recipe.cuisine ?? "").toLowerCase().includes(query),
    );
  }, [recipes, filter]);

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
        <h2 className="flex-1 text-xl font-black text-slate-800">📖 My Recipe Book</h2>
        <button
          type="button"
          onClick={() => { playPop(); onRefresh(); }}
          className="rounded-xl bg-white px-3 py-2 font-black text-slate-500 ring-1 ring-slate-200 transition active:scale-95"
          aria-label="Refresh my recipes"
        >
          ↻
        </button>
      </div>

      <p className="-mt-2 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">
        🔒 Private to you. No other chef can open, search or copy the recipes in this book.
      </p>

      <div className="flex gap-2">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search my recipes…"
          aria-label="Search my recipes"
          className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 font-bold outline-none focus:border-orange-400"
        />
        <button
          type="button"
          onClick={() => { playPop(); onImport(); }}
          className="shrink-0 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-2.5 font-black text-white shadow transition active:scale-95"
        >
          🤖 AI Import
        </button>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 ring-1 ring-red-200" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="rounded-2xl bg-white p-4 text-center font-black text-slate-400 ring-1 ring-slate-100">
          Opening your book…
        </p>
      )}

      {!loading && visible.length === 0 && (
        <div className="rounded-3xl bg-white p-6 text-center shadow ring-1 ring-orange-100">
          <p className="text-5xl" aria-hidden="true">🍳</p>
          <h3 className="mt-2 font-black text-slate-700">
            {recipes.length === 0 ? "Your book is empty — for now!" : "No recipes match that search."}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Paste a recipe website link or a YouTube link and the AI onboarding will import the recipe,
            its steps, its photos and its shopping list into your private book.
          </p>
          <button
            type="button"
            onClick={() => { playPop(); onImport(); }}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 py-3 font-black text-white shadow transition active:scale-95"
          >
            🤖 Import my first recipe
          </button>
          {onBrowse && (
            <button
              type="button"
              onClick={() => { playPop(); onBrowse(); }}
              className="mt-2 w-full rounded-2xl bg-sky-50 py-2.5 text-sm font-black text-sky-700 ring-1 ring-sky-200 transition active:scale-95"
            >
              🌐📺 Browse Chef Websites &amp; YouTube In-App
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((recipe) => (
          <li key={recipe.id}>
            <div className="flex items-stretch gap-2 rounded-3xl bg-white p-2 shadow ring-1 ring-orange-100">
              <button
                type="button"
                onClick={() => { playPop(); onOpen(recipe); }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99]"
              >
                {recipe.heroImageUrl ? (
                  <img
                    src={recipe.heroImageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-pink-100 text-2xl">
                    🍽️
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-black text-slate-800">{recipe.title}</span>
                  <span className="block truncate text-xs font-bold text-slate-400">
                    {recipe.ingredients.length} ingredients • {recipe.steps.length} steps
                    {recipe.totalMinutes ? ` • ${recipe.totalMinutes} min` : ""}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {recipe.claimedFromCatalogue ? "shared copy" : "my recipe"}
                  </span>
                </span>
              </button>
              {confirming === recipe.id ? (
                <div className="flex shrink-0 flex-col justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setConfirming(null); onDelete(recipe); }}
                    className="rounded-xl bg-red-500 px-2.5 py-1 text-xs font-black text-white"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(recipe.id)}
                  aria-label={`Delete ${recipe.title}`}
                  className="shrink-0 self-center rounded-xl px-2 py-2 text-slate-300 transition hover:text-red-400"
                >
                  🗑️
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
