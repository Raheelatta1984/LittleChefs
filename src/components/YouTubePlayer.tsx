import { useState } from "react";

export function extractYouTubeId(input: string | undefined | null): string | null {
  if (!input) return null;
  const value = input.trim();
  // Raw 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/, // watch?v=
    /youtu\.be\/([a-zA-Z0-9_-]{11})/, // youtu.be/
    /\/embed\/([a-zA-Z0-9_-]{11})/, // embed/
    /\/live\/([a-zA-Z0-9_-]{11})/, // live/
    /\/shorts\/([a-zA-Z0-9_-]{11})/, // shorts/
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

type YouTubePlayerProps = {
  youtubeIdOrUrl: string | undefined | null;
  title?: string;
};

// In-app YouTube player: click-to-play thumbnail → youtube-nocookie embed.
// NO external links, NO new windows, NO redirects — playback stays inside the app.
export function YouTubePlayer({ youtubeIdOrUrl, title }: YouTubePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const videoId = extractYouTubeId(youtubeIdOrUrl);
  if (!videoId) return null;

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-lg ring-1 ring-black/10">
      {playing ? (
        <div className="aspect-video w-full">
          <iframe
            title={title ?? "Recipe video"}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative block aspect-video w-full"
          aria-label="Play recipe video inside the app"
        >
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt={title ?? "Recipe video thumbnail"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 transition group-hover:bg-black/25">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl text-white shadow-2xl transition group-hover:scale-110">
              ▶
            </span>
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
              Tap to play inside the app
            </span>
          </span>
        </button>
      )}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-sm font-extrabold text-white">🎬 Recipe Video</span>
        {playing && (
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25 active:scale-95"
          >
            Minimize
          </button>
        )}
      </div>
    </div>
  );
}
