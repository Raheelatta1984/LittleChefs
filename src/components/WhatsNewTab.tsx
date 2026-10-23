import { useEffect, useState } from "react";
import {
  WHATS_NEW_CATEGORIES,
  WHATS_NEW_ITEMS,
  markWhatsNewSeen,
  type WhatsNewAction,
  type WhatsNewCategory,
} from "../data/whatsNew";
import { playPop } from "../utils/audio";

function badgeClasses(badge: "NEW" | "UPDATED" | "CORE"): string {
  if (badge === "NEW") return "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-sm";
  if (badge === "UPDATED") return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
}

export function WhatsNewTab({
  chefName,
  onAction,
  onSeen,
  onBack,
}: {
  chefName: string;
  onAction: (action: WhatsNewAction) => void;
  onSeen?: () => void;
  onBack?: () => void;
}) {
  const [category, setCategory] = useState<WhatsNewCategory>("all");

  useEffect(() => {
    markWhatsNewSeen();
    onSeen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleItems =
    category === "all"
      ? WHATS_NEW_ITEMS
      : WHATS_NEW_ITEMS.filter((item) => item.category === category);

  return (
    <main className="flex flex-1 flex-col gap-4" aria-label="What's New in Chef Universe">
      <section className="rounded-3xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-black uppercase tracking-wider">
              ✨ What&apos;s New for Every Chef
            </span>
            <h2 className="mt-2 text-2xl font-black">
              Welcome to the Upgraded Kitchen, {chefName}!
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/90">
              Browse chef websites &amp; YouTube channels right inside the app, choose the exact
              recipe you love, and import it with AI-Powered Onboarding!
            </p>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={() => {
                playPop();
                onBack();
              }}
              aria-label="Close What's New"
              className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-sm font-black text-white transition hover:bg-white/30 active:scale-95"
            >
              ✕
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              playPop();
              onAction("open-browser");
            }}
            className="rounded-2xl bg-white px-3 py-2.5 text-xs font-black text-fuchsia-700 shadow transition active:scale-95"
          >
            🌐 Open Website Browser
          </button>
          <button
            type="button"
            onClick={() => {
              playPop();
              onAction("open-youtube-browser");
            }}
            className="rounded-2xl bg-slate-900/85 px-3 py-2.5 text-xs font-black text-white shadow transition active:scale-95"
          >
            📺 Open YouTube Explorer
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter What's New updates">
        {WHATS_NEW_CATEGORIES.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={category === tab.id}
            onClick={() => {
              playPop();
              setCategory(tab.id);
            }}
            className={`rounded-full px-3.5 py-2 text-xs font-black transition active:scale-95 ${
              category === tab.id
                ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow"
                : "bg-white text-slate-600 ring-1 ring-orange-100 hover:ring-orange-300"
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className="rounded-3xl bg-white/95 p-5 shadow-md ring-1 ring-orange-100"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-pink-100 text-xl">
                {item.emoji}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${badgeClasses(item.badge)}`}>
                {item.badge}
              </span>
              <span className="text-xs font-black text-slate-400">
                {item.version} • {item.date}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-black text-slate-800">{item.title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">{item.summary}</p>

            <ul className="mt-3 space-y-1.5 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              {item.highlights.map((point) => (
                <li key={point} className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                  <span className="mt-0.5 font-black text-emerald-500" aria-hidden="true">
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => {
                playPop();
                onAction(item.action);
              }}
              className="mt-3 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 py-3 text-sm font-black text-white shadow transition active:scale-95"
            >
              {item.ctaLabel} →
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
