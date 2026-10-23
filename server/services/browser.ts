import type {
  BrowserPageResponse,
  BrowserRecipeCard,
  BrowserYouTubeVideo,
  RecipeDraft,
} from "../../shared/types.js";
import { ApiError } from "../lib/errors.js";
import { safeFetchPage, normaliseUrl } from "./importer/fetch.js";
import { extractJsonLdRecipe, extractPageFallback } from "./importer/jsonld.js";
import { confidenceOf, decodeEntities, stripHtml } from "./importer/parse.js";
import { parseRecipeFromText } from "./importer/text.js";
import { tidyDraft } from "./importer/index.js";
import { fetchYouTubeMeta, youtubeVideoId } from "./importer/youtube.js";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const NOISE_PATH_RE =
  /\/(?:wp-login|wp-admin|login|signin|sign-in|register|signup|cart|checkout|account|privacy|terms|cookie|contact|about-us|advertise|feed|rss|tag|author|wp-json|xmlrpc)(?:\/|$|\?)/i;

const SOCIAL_HOST_RE =
  /(?:^|\.)(?:facebook\.com|instagram\.com|twitter\.com|x\.com|pinterest\.com|tiktok\.com|linkedin\.com|whatsapp\.com|t\.me|play\.google\.com|apps\.apple\.com)$/i;

const RECIPE_HINT_RE =
  /\b(?:recipe|recipes|cook|bake|biryani|chicken|pasta|cake|curry|soup|salad|bread|rice|paneer|masala|noodles|pizza|burger|cookies|brownie|dessert|stew|fry|roast|grill|sauce|tacos|pancake|halwa|karahi|nihari|pulao|kebab|kabab|samosa|dal|daal)\b/i;

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unwrapSearchRedirect(rawHref: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(decodeEntities(rawHref.trim()), baseUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) return null;
    const host = resolved.hostname.toLowerCase();
    // Unwrap DuckDuckGo /l/?uddg=... and Google /url?q=... result wrappers.
    if (host.endsWith("duckduckgo.com") && resolved.pathname.startsWith("/l/")) {
      const target = resolved.searchParams.get("uddg");
      if (target && /^https?:\/\//i.test(target)) return target;
    }
    if ((host.endsWith("google.com") || host.endsWith("google.com.au")) && resolved.pathname === "/url") {
      const target = resolved.searchParams.get("q") ?? resolved.searchParams.get("url");
      if (target && /^https?:\/\//i.test(target)) return target;
    }
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

function extractFirstImgUrl(fragment: string, baseUrl: string): string | null {
  const imgTag = fragment.match(/<img\b[^>]*>/i)?.[0];
  if (!imgTag) return null;
  const attrs = ["data-lazy-src", "data-src", "src"];
  for (const attr of attrs) {
    const match = imgTag.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, "i"));
    const candidate = match?.[1]?.trim();
    if (candidate && !candidate.startsWith("data:image/svg") && !/1x1|pixel|blank|avatar|logo/i.test(candidate)) {
      try {
        const resolved = new URL(decodeEntities(candidate), baseUrl);
        if (["http:", "https:"].includes(resolved.protocol)) return resolved.toString();
      } catch {
        continue;
      }
    }
  }
  const srcset = imgTag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
  if (srcset) {
    const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    if (first) {
      try {
        const resolved = new URL(decodeEntities(first), baseUrl);
        if (["http:", "https:"].includes(resolved.protocol)) return resolved.toString();
      } catch {
        // ignore bad srcset
      }
    }
  }
  return null;
}

/**
 * Sanitizes fetched HTML for safe rendering inside a sandboxed `<iframe sandbox="allow-scripts" srcDoc={...}>`.
 * Strips all page scripts/frames/handlers and injects a tiny navigation bridge so clicking any
 * link or search form navigates inside Chef Universe's Internal Browser instead of leaving the app.
 */
export function sanitizeHtmlForPreview(html: string, finalUrl: string): string {
  const withoutDangerousBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<(?:iframe|object|embed|applet|portal)[\s\S]*?<\/(?:iframe|object|embed|applet|portal)>/gi, "")
    .replace(/<(?:iframe|object|embed|applet|portal)\b[^>]*\/?>/gi, "")
    .replace(/<meta[^>]+http-equiv=["']?(?:refresh|content-security-policy|x-frame-options)["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(href|src|action)\s*=\s*(["'])\s*(?:javascript:|vbscript:|data:text\/html)[^"']*\2/gi, '$1=$2#$2');

  const bridgeHead = `<base href="${escapeHtmlAttr(finalUrl)}">
<meta name="referrer" content="no-referrer">
<style>
  html, body { max-width: 100% !important; overflow-x: hidden !important; }
  body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; margin: 0; padding: 12px; background: #fff; color: #1e293b; }
  img, video, svg { max-width: 100% !important; height: auto !important; border-radius: 8px; }
  a { cursor: pointer; }
</style>
<script>
(function () {
  document.addEventListener("click", function (event) {
    var el = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!el) return;
    var raw = el.getAttribute("href") || "";
    if (!raw || raw.charAt(0) === "#") return;
    event.preventDefault();
    event.stopPropagation();
    try {
      var target = new URL(el.href, document.baseURI).toString();
      if (/^https?:\\/\\//i.test(target)) {
        window.parent.postMessage({ type: "chef-browser:navigate", url: target }, "*");
      }
    } catch (_e) {}
  }, true);
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.tagName || form.tagName.toLowerCase() !== "form") return;
    event.preventDefault();
    event.stopPropagation();
    try {
      var method = (form.getAttribute("method") || "get").toLowerCase();
      if (method !== "get") return;
      var action = new URL(form.getAttribute("action") || document.baseURI, document.baseURI);
      var data = new FormData(form);
      data.forEach(function (val, key) {
        if (typeof val === "string") action.searchParams.set(key, val);
      });
      window.parent.postMessage({ type: "chef-browser:navigate", url: action.toString() }, "*");
    } catch (_e) {}
  }, true);
})();
</script>`;

  if (/<head[^>]*>/i.test(withoutDangerousBlocks)) {
    return withoutDangerousBlocks.replace(/<head[^>]*>/i, (match) => `${match}\n${bridgeHead}`);
  }
  return `<!doctype html><html><head>${bridgeHead}</head><body>${withoutDangerousBlocks}</body></html>`;
}

/** Extracts recipe cards and navigable article links from a chef website or search results page. */
export function extractRecipeLinks(html: string, baseUrl: string): BrowserRecipeCard[] {
  let baseHost = "";
  try {
    baseHost = new URL(baseUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    baseHost = "";
  }
  const normalisedSelf = unwrapSearchRedirect(baseUrl, baseUrl) ?? baseUrl;
  const seen = new Set<string>([normalisedSelf.replace(/\/$/, "")]);
  const cards: Array<BrowserRecipeCard & { score: number }> = [];

  const pushCandidate = (rawUrl: string, titleText: string, snippetText: string | null, imageUrl: string | null, fromArticle: boolean) => {
    const resolved = unwrapSearchRedirect(rawUrl, baseUrl);
    if (!resolved) return;
    const key = resolved.replace(/\/$/, "");
    if (seen.has(key)) return;

    let parsed: URL;
    try {
      parsed = new URL(resolved);
    } catch {
      return;
    }
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (SOCIAL_HOST_RE.test(host)) return;
    if (NOISE_PATH_RE.test(parsed.pathname)) return;
    if (/\.(?:jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js)$/i.test(parsed.pathname)) return;
    if (parsed.pathname === "/" && !parsed.search) return;

    const cleanTitle = decodeEntities(stripHtml(titleText)).replace(/\s+/g, " ").trim();
    if (cleanTitle.length < 4 || cleanTitle.length > 180) return;
    if (/^(?:read more|view recipe|learn more|home|menu|next|previous|page \d+|search|skip to content|log ?in|sign ?up|privacy policy)$/i.test(cleanTitle)) {
      return;
    }

    seen.add(key);

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const hasRecipeSlug =
      /recipe|recipes|dish|cook|food|meal/i.test(parsed.pathname) ||
      RECIPE_HINT_RE.test(cleanTitle);
    const isYoutubeWatch = Boolean(youtubeVideoId(resolved));
    const isLikelyRecipe = Boolean(
      isYoutubeWatch ||
      hasRecipeSlug ||
      (fromArticle && pathSegments.length >= 1) ||
      (imageUrl && pathSegments.length >= 1),
    );

    let score = 0;
    if (isLikelyRecipe) score += 5;
    if (fromArticle) score += 3;
    if (imageUrl) score += 3;
    if (RECIPE_HINT_RE.test(cleanTitle)) score += 2;
    if (host === baseHost) score += 1;
    if (pathSegments.length >= 1 && pathSegments[pathSegments.length - 1].includes("-")) score += 2;

    const cleanSnippet = snippetText
      ? decodeEntities(stripHtml(snippetText)).replace(/\s+/g, " ").trim().slice(0, 180) || null
      : null;

    cards.push({
      url: resolved,
      title: cleanTitle,
      snippet: cleanSnippet && cleanSnippet.toLowerCase() !== cleanTitle.toLowerCase() ? cleanSnippet : null,
      imageUrl,
      siteName: host || null,
      isLikelyRecipe,
      score,
    });
  };

  // Pass 1: <article> cards (WordPress recipe themes like Food Fusion, Ranveer Brar, Cakes by MK, etc.)
  const articleBlocks = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  for (const block of articleBlocks.slice(0, 60)) {
    const headingLink =
      block.match(/<h[1-4][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[1-4]>/i) ??
      block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>[\s\S]*?<\/a>/i);
    const anyLinks = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const chosen =
      headingLink ??
      anyLinks.find((m) => decodeEntities(stripHtml(m[2])).trim().length >= 5);
    if (!chosen) continue;
    const img = extractFirstImgUrl(block, baseUrl);
    const para = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null;
    pushCandidate(chosen[1], chosen[2], para, img, true);
  }

  // Pass 2: General anchor scan across search results / category grids
  const anchorMatches = [...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
  for (const match of anchorMatches.slice(0, 250)) {
    const attrs = `${match[1]} ${match[3]}`;
    const href = match[2];
    const inner = match[4];
    const ariaTitle =
      attrs.match(/\b(?:aria-label|title)=["']([^"']+)["']/i)?.[1] ?? "";
    const textContent = stripHtml(inner).trim() || ariaTitle;
    const img = extractFirstImgUrl(inner, baseUrl);
    pushCandidate(href, textContent, null, img, false);
  }

  return cards
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
    .map(({ score: _score, ...card }) => card);
}

/** Detects whether a single loaded webpage already holds a structured recipe ready to import. */
export function detectPageRecipe(
  html: string,
  pageUrl: string,
): { draft: RecipeDraft; method: string; confidence: number } | null {
  const jsonld = extractJsonLdRecipe(html, pageUrl);
  if (jsonld && jsonld.ingredients.length >= 2 && jsonld.steps.length >= 1) {
    const tidy = tidyDraft(jsonld);
    return { draft: tidy, method: "jsonld", confidence: confidenceOf(tidy) };
  }

  const cleaned = stripHtml(html).slice(0, 14_000);
  const hasExplicitSections =
    /(?:^|\n)\s*(?:🛒\s*)?(?:ingredients?|you(?:'| wi)ll need|what you need)\s*:?\s*(?:\n|$)/i.test(cleaned) &&
    /(?:^|\n)\s*(?:👩‍🍳\s*)?(?:method|instructions?|directions?|steps?|preparation|how to (?:make|cook))\s*:?\s*(?:\n|$)/i.test(cleaned);

  if (hasExplicitSections) {
    const fallbackMeta = extractPageFallback(html, pageUrl);
    const heuristic = parseRecipeFromText(cleaned, {
      title: fallbackMeta.title,
      sourceUrl: pageUrl,
    });
    heuristic.heroImageUrl = heuristic.heroImageUrl ?? fallbackMeta.heroImageUrl;
    heuristic.description = heuristic.description ?? fallbackMeta.description;
    if (heuristic.ingredients.length >= 3 && heuristic.steps.length >= 2) {
      const tidy = tidyDraft(heuristic);
      return { draft: tidy, method: "heuristic", confidence: confidenceOf(tidy) };
    }
  }

  return null;
}

function runsText(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  if (typeof record.simpleText === "string") return record.simpleText.trim() || null;
  if (Array.isArray(record.runs)) {
    const joined = record.runs
      .map((r) => (r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : ""))
      .join("")
      .trim();
    return joined || null;
  }
  return null;
}

function extractBalancedJson(source: string, markerIndex: number): string | null {
  const start = source.indexOf("{", markerIndex);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** Parses YouTube search or channel HTML (`ytInitialData` + HTML anchor fallback) into video cards. */
export function extractYouTubeVideosFromHtml(html: string): BrowserYouTubeVideo[] {
  const videos: BrowserYouTubeVideo[] = [];
  const seen = new Set<string>();

  const pushVideo = (video: Omit<BrowserYouTubeVideo, "watchUrl" | "thumbnailUrl"> & { thumbnailUrl?: string | null }) => {
    if (!video.videoId || !/^[\w-]{6,15}$/.test(video.videoId) || seen.has(video.videoId)) return;
    if (!video.title || video.title.trim().length < 2) return;
    seen.add(video.videoId);
    videos.push({
      videoId: video.videoId,
      watchUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      title: decodeEntities(video.title.trim()),
      channel: video.channel ? decodeEntities(video.channel.trim()) : null,
      duration: video.duration ?? null,
      publishedText: video.publishedText ?? null,
      viewCountText: video.viewCountText ?? null,
      descriptionSnippet: video.descriptionSnippet ? decodeEntities(video.descriptionSnippet.trim()) : null,
      thumbnailUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
    });
  };

  // Pass 1: Walk ytInitialData JSON if present
  const markerMatch = html.match(/(?:var\s+ytInitialData|window\[["']ytInitialData["']\])\s*=/);
  if (markerMatch && markerMatch.index !== undefined) {
    const jsonBlock = extractBalancedJson(html, markerMatch.index + markerMatch[0].length);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock) as unknown;
        const walkYt = (node: unknown, depth = 0): void => {
          if (!node || depth > 28 || videos.length >= 24) return;
          if (Array.isArray(node)) {
            for (const item of node) walkYt(item, depth + 1);
            return;
          }
          if (typeof node !== "object") return;
          const record = node as Record<string, unknown>;
          const renderer = (record.videoRenderer ??
            record.gridVideoRenderer ??
            record.compactVideoRenderer) as Record<string, unknown> | undefined;
          if (renderer && typeof renderer.videoId === "string") {
            const snippets = Array.isArray(renderer.detailedMetadataSnippets)
              ? (renderer.detailedMetadataSnippets[0] as Record<string, unknown> | undefined)?.snippetText
              : renderer.descriptionSnippet;
            pushVideo({
              videoId: renderer.videoId,
              title: runsText(renderer.title) ?? "",
              channel:
                runsText(renderer.ownerText) ??
                runsText(renderer.longBylineText) ??
                runsText(renderer.shortBylineText),
              duration: runsText(renderer.lengthText),
              publishedText: runsText(renderer.publishedTimeText),
              viewCountText: runsText(renderer.shortViewCountText) ?? runsText(renderer.viewCountText),
              descriptionSnippet: runsText(snippets),
            });
          }
          for (const value of Object.values(record)) {
            if (value && typeof value === "object") walkYt(value, depth + 1);
          }
        };
        walkYt(parsed);
      } catch {
        // Fall through to HTML/anchor extraction below
      }
    }
  }

  // Pass 2: HTML / anchor fallback (supports simplified HTML, mobile pages, and test fixtures)
  if (videos.length === 0) {
    const anchorMatches = [
      ...html.matchAll(/<a\b[^>]*href=["']([^"']*(?:\/watch\?v=|youtu\.be\/|\/shorts\/)[\w-]{6,15}[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi),
    ];
    for (const match of anchorMatches) {
      const id = youtubeVideoId(match[1].startsWith("http") ? match[1] : `https://www.youtube.com${match[1]}`);
      const title = stripHtml(match[2]).trim();
      if (id && title.length >= 3) {
        pushVideo({
          videoId: id,
          title,
          channel: null,
          duration: null,
          publishedText: null,
          viewCountText: null,
          descriptionSnippet: null,
        });
      }
    }
  }

  return videos.slice(0, 20);
}

export function isYouTubeHost(rawUrl: string): boolean {
  try {
    const parsed = normaliseUrl(rawUrl);
    const host = parsed.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
    return host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com";
  } catch {
    return false;
  }
}

export async function browseYouTubeVideo(
  rawUrl: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<BrowserPageResponse> {
  const meta = await fetchYouTubeMeta(rawUrl, options);
  const watchUrl = `https://www.youtube.com/watch?v=${meta.videoId}`;
  const combined = [meta.description, meta.captionText ?? ""].filter(Boolean).join("\n\n");
  const parsed = parseRecipeFromText(combined, {
    title: meta.title,
    sourceUrl: watchUrl,
    sourceVideoId: meta.videoId,
    sourceChannel: meta.channel,
  });
  parsed.sourceType = "youtube";
  parsed.heroImageUrl = meta.thumbnailUrl;
  parsed.sourceAuthor = meta.channel;

  const hasStructuredRecipe = parsed.ingredients.length >= 2 && parsed.steps.length >= 1;
  const detectedRecipe = hasStructuredRecipe ? tidyDraft(parsed) : null;

  return {
    kind: "youtube-video",
    url: watchUrl,
    title: meta.title,
    siteName: meta.channel ? `${meta.channel} · YouTube` : "YouTube",
    description: meta.description || null,
    heroImageUrl: meta.thumbnailUrl,
    sanitizedHtml: null,
    links: [],
    videos: [],
    activeVideo: {
      videoId: meta.videoId,
      watchUrl,
      title: meta.title,
      channel: meta.channel,
      duration: null,
      publishedText: null,
      viewCountText: null,
      descriptionSnippet: meta.description ? meta.description.slice(0, 220) : null,
      thumbnailUrl: meta.thumbnailUrl,
      description: meta.description,
    },
    detectedRecipe,
    detectedMethod: detectedRecipe ? "youtube" : null,
    detectedConfidence: detectedRecipe ? confidenceOf(detectedRecipe) : null,
  };
}

export async function browseYouTube(
  queryOrUrl: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<BrowserPageResponse> {
  const trimmed = queryOrUrl.trim();
  if (!trimmed) throw ApiError.badRequest("Type a dish or channel name to search YouTube.");

  const directVideoId = youtubeVideoId(trimmed);
  if (directVideoId) {
    return browseYouTubeVideo(trimmed, options);
  }

  let targetUrl: string;
  let displayQuery = trimmed;
  if (/^https?:\/\//i.test(trimmed) || /^www\.youtube\.com/i.test(trimmed) || /^youtube\.com/i.test(trimmed)) {
    const parsed = normaliseUrl(trimmed);
    const q = parsed.searchParams.get("search_query") ?? parsed.searchParams.get("q");
    if (q) displayQuery = q;
    if (/^\/@[^/]+\/?$/.test(parsed.pathname)) {
      parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/videos`;
    }
    targetUrl = parsed.toString();
  } else {
    targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
  }

  const page = await safeFetchPage(targetUrl, {
    fetchImpl: options.fetchImpl,
    userAgent: BROWSER_UA,
  });
  const videos = extractYouTubeVideosFromHtml(page.html);
  const fallback = extractPageFallback(page.html, page.url);

  return {
    kind: "youtube-search",
    url: page.url,
    title: displayQuery ? `YouTube: ${displayQuery}` : fallback.title || "YouTube Recipes",
    siteName: "YouTube",
    description:
      videos.length > 0
        ? `Found ${videos.length} cooking video${videos.length === 1 ? "" : "s"} — watch inside the app and import the complete recipe with AI Onboarding!`
        : "No videos matched on that page. Try refining the dish or chef channel name, or paste a direct video link.",
    heroImageUrl: videos[0]?.thumbnailUrl ?? null,
    sanitizedHtml: null,
    links: [],
    videos,
    activeVideo: null,
    detectedRecipe: null,
    detectedMethod: null,
    detectedConfidence: null,
  };
}

export async function browseWebsite(
  rawInput: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<BrowserPageResponse> {
  const trimmed = rawInput.trim();
  if (!trimmed) throw ApiError.badRequest("Enter a website link or recipe search first.");

  // Allow plain search queries in the address bar too (routes through DuckDuckGo HTML search).
  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed) ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]|$)/i.test(trimmed);

  const targetUrl = looksLikeUrl
    ? normaliseUrl(trimmed).toString()
    : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${trimmed} recipe`)}`;

  if (youtubeVideoId(targetUrl)) {
    return browseYouTubeVideo(targetUrl, options);
  }
  if (isYouTubeHost(targetUrl)) {
    return browseYouTube(targetUrl, options);
  }

  // Upgrade Google search links (which require JS/CAPTCHA for bots) into DuckDuckGo HTML search
  // so web recipe searches render cleanly inside the Internal Browser.
  let fetchTarget = targetUrl;
  try {
    const parsedTarget = new URL(targetUrl);
    if (
      (parsedTarget.hostname.includes("google.") && parsedTarget.pathname === "/search") ||
      (parsedTarget.hostname === "duckduckgo.com" && parsedTarget.pathname === "/")
    ) {
      const q = parsedTarget.searchParams.get("q");
      if (q) {
        fetchTarget = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      }
    }
  } catch {
    // keep targetUrl
  }

  const page = await safeFetchPage(fetchTarget, {
    fetchImpl: options.fetchImpl,
    userAgent: BROWSER_UA,
  });

  const meta = extractPageFallback(page.html, page.url);
  const detected = detectPageRecipe(page.html, page.url);
  const links = extractRecipeLinks(page.html, page.url);
  const sanitizedHtml = sanitizeHtmlForPreview(page.html, page.url);

  let siteName: string | null = null;
  try {
    siteName = new URL(page.url).hostname.replace(/^www\./i, "");
  } catch {
    siteName = null;
  }

  return {
    kind: "website",
    url: page.url,
    title: detected?.draft.title || meta.title || siteName || "Recipe Page",
    siteName,
    description: detected?.draft.description ?? meta.description ?? null,
    heroImageUrl: detected?.draft.heroImageUrl ?? meta.heroImageUrl ?? null,
    sanitizedHtml,
    links,
    videos: [],
    activeVideo: null,
    detectedRecipe: detected?.draft ?? null,
    detectedMethod: detected?.method ?? null,
    detectedConfidence: detected?.confidence ?? null,
  };
}
