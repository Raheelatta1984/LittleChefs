import type { SearchResponse } from "../../shared/types";
import { playPop } from "../utils/audio";

export function InternalMatches({
  result,
  busyId,
  onOpenOwn,
  onClaim,
  onSearchOnline,
  onImport,
  onClose,
}: {
  result: SearchResponse;
  busyId: string | null;
  onOpenOwn: (recipeId: string) => void;
  onClaim: (catalogueId: string) => void;
  onSearchOnline: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const hasMatches = result.myRecipes.length > 0 || result.sharedMatches.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Internal recipe matches">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-black text-slate-800">
              {hasMatches ? "✅ Found it in the kitchen!" : "🔍 Nothing internal yet"}
            </h2>
            <p className="text-xs font-bold text-slate-500">
              Searching for “{result.query}” · {result.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { playPop(); onClose(); }}
            aria-label="Close results"
            className="rounded-full bg-slate-100 px-3 py-2 font-black text-slate-500 transition active:scale-95"
          >
            ✕
          </button>
        </div>

        {result.myRecipes.length > 0 && (
          <section className="mt-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-400">📖 In my recipe book</h3>
            <ul className="mt-1 space-y-2">
              {result.myRecipes.map((match) => (
                <li key={match.recipeId}>
                  <button
                    type="button"
                    onClick={() => { playPop(); match.recipeId && onOpenOwn(match.recipeId); }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-2 text-left ring-1 ring-slate-100 transition active:scale-[0.99]"
                  >
                    {match.heroImageUrl ? (
                      <img src={match.heroImageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100 text-xl">🍽️</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-slate-800">{match.title}</span>
                      <span className="block text-xs font-bold text-slate-400">
                        {match.ingredientCount} ingredients • {match.stepCount} steps
                        {match.totalMinutes ? ` • ${match.totalMinutes} min` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-black text-orange-500">Open →</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.sharedMatches.length > 0 && (
          <section className="mt-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-400">🌍 Shared recipe catalogue</h3>
            <p className="text-[11px] font-bold text-slate-400">
              A private copy is added to your book. You never see who imported it.
            </p>
            <ul className="mt-1 space-y-2">
              {result.sharedMatches.map((match) => (
                <li key={match.catalogueId}>
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/60 p-2 ring-1 ring-emerald-100">
                    {match.heroImageUrl ? (
                      <img src={match.heroImageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-xl">🍲</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-slate-800">{match.title}</span>
                      <span className="block text-xs font-bold text-slate-500">
                        {match.ingredientCount} ingredients • {match.stepCount} steps
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => { playPop(); match.catalogueId && onClaim(match.catalogueId); }}
                      disabled={busyId === match.catalogueId}
                      className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-white shadow transition active:scale-95 disabled:opacity-60"
                    >
                      {busyId === match.catalogueId ? "Copying…" : "Copy to my book"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => { playPop(); onImport(); }}
            className="w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3 font-black text-white shadow transition active:scale-95"
          >
            🤖 {hasMatches ? "Import a different version with AI" : "Import it with AI onboarding"}
          </button>
          <button
            type="button"
            onClick={() => { playPop(); onSearchOnline(); }}
            className="w-full rounded-3xl bg-white py-3 font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
          >
            🔮 Search the world (AI Smart Finder)
          </button>
        </div>

        {!hasMatches && (
          <p className="mt-3 rounded-2xl bg-sky-50 p-3 text-[11px] font-bold text-sky-800 ring-1 ring-sky-100">
            Paste a recipe website link, a YouTube link or the video description and we&apos;ll map every
            ingredient, step and photo — then ask how many people are eating and build your shopping list.
          </p>
        )}
      </div>
    </div>
  );
}
