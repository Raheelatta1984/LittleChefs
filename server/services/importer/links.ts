import type { BrowserRecipeCard } from "../../../shared/types.js";
import { decodeEntities, stripHtml } from "./parse.js";
import { youtubeVideoId } from "./youtube.js";

/**
 * Recipe-link extraction shared by the in-app browser (recipe cards) and the
 * importer (following a search-results / listing page to the real recipe).
 */

const NOISE_PATH_RE =
  /\/(?:wp-login|wp-admin|login|signin|sign-in|register|signup|cart|checkout|account|privacy|terms|cookie|contact|about-us|advertise|feed|rss|tag|author|wp-json|xmlrpc)(?:\/|$|\?)/i;

const SOCIAL_HOST_RE =
  /(?:^|\.)(?:facebook\.com|instagram\.com|twitter\.com|x\.com|pinterest\.com|tiktok\.com|linkedin\.com|whatsapp\.com|t\.me|play\.google\.com|apps\.apple\.com)$/i;

const RECIPE_HINT_RE =
  /\b(?:recipe|recipes|cook|bake|biryani|chicken|pasta|cake|curry|soup|salad|bread|rice|paneer|masala|noodles|pizza|burger|cookies|brownie|dessert|stew|fry|roast|grill|sauce|tacos|pancake|halwa|karahi|nihari|pulao|kebab|kabab|samosa|dal|daal)\b/i;

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

/**
 * Ranks extracted cards for the dish the chef actually asked for, so a search
 * page like foodfusion.com/?s=Chicken+Balochi+Karahi resolves to its best
 * recipe instead of whichever card the theme happened to list first.
 */
export function rankCardsForDish(cards: BrowserRecipeCard[], dish: string): BrowserRecipeCard[] {
  const wanted = dishTokens(dish);
  if (wanted.length === 0) return cards;
  return [...cards]
    .map((card, index) => {
      const titleTokens = dishTokens(card.title);
      const overlap = wanted.filter((token) => titleTokens.includes(token)).length;
      const hostBoost = /foodfusion|sooperchef|hebbarskitchen|ranveerbrar|sanjeevkapoor|bbcgoodfood|allrecipes/i.test(
        card.siteName ?? "",
      )
        ? 0.5
        : 0;
      return { card, index, score: overlap + hostBoost + (card.isLikelyRecipe ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ card }) => card);
}

/** Significant lowercase tokens of a dish/title ("Chicken Balochi Karahi" -> chicken, balochi, karahi). */
export function dishTokens(text: string): string[] {
  const stop = ["recipe", "recipes", "easy", "style", "with", "from", "the", "and", "how", "make"];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length >= 3 && !stop.includes(token));
}
