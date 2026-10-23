import { ApiError } from "../../lib/errors.js";
import type { RecipeDraft } from "../../../shared/types.js";
import { safeFetchPage } from "./fetch.js";
import { parseRecipeFromText } from "./text.js";

export function youtubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{6,}$/.test(v)) return v;
      const match = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
      if (match) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

export type YouTubeMeta = {
  videoId: string;
  title: string;
  channel: string | null;
  description: string;
  thumbnailUrl: string;
};

function decodeJsonString(fragment: string): string {
  try {
    return JSON.parse(`"${fragment}"`) as string;
  } catch {
    return fragment.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

/** Reads title/author from oEmbed (no key needed) and the description from the watch page. */
export async function fetchYouTubeMeta(
  rawUrl: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<YouTubeMeta> {
  const videoId = youtubeVideoId(rawUrl);
  if (!videoId) {
    throw ApiError.badRequest(
      "That YouTube link is a channel or playlist. Paste a link to one video, or paste the recipe description instead.",
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = "";
  let channel: string | null = null;
  let description = "";

  try {
    const oembed = await safeFetchPage(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { fetchImpl: options.fetchImpl, accept: "application/json" },
    );
    const data = JSON.parse(oembed.html) as { title?: string; author_name?: string };
    title = data.title?.trim() ?? "";
    channel = data.author_name?.trim() ?? null;
  } catch {
    // oEmbed can fail for age-restricted videos; the watch page may still work.
  }

  try {
    const page = await safeFetchPage(watchUrl, { fetchImpl: options.fetchImpl });
    if (!title) {
      const titleMatch = page.html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i);
      title = titleMatch?.[1] ?? "";
    }
    if (!channel) {
      const channelMatch = page.html.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/);
      channel = channelMatch ? decodeJsonString(channelMatch[1]) : null;
    }
    const descriptionMatch =
      page.html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/) ??
      page.html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']\s*\/?>/i);
    if (descriptionMatch) description = decodeJsonString(descriptionMatch[1]);
  } catch {
    // The description is optional if oEmbed at least gave us a title.
  }

  if (!title && !description) {
    throw ApiError.upstream("We could not read that YouTube video. Check that it is public and try again.");
  }

  return {
    videoId,
    title: title || `YouTube recipe ${videoId}`,
    channel,
    description,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export async function importFromYouTube(
  rawUrl: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<{ draft: RecipeDraft; description: string }> {
  const meta = await fetchYouTubeMeta(rawUrl, options);
  const draft = parseRecipeFromText(meta.description, {
    title: meta.title,
    sourceUrl: `https://www.youtube.com/watch?v=${meta.videoId}`,
    sourceVideoId: meta.videoId,
    sourceChannel: meta.channel,
  });
  draft.sourceType = "youtube";
  draft.heroImageUrl = meta.thumbnailUrl;
  draft.sourceAuthor = meta.channel;
  return { draft, description: meta.description };
}
