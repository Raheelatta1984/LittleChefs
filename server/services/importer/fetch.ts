import { lookup } from "node:dns/promises";
import net from "node:net";
import { ApiError } from "../../lib/errors.js";
import { config } from "../../config.js";

/** Blocks localhost, link-local and RFC1918 targets so a pasted URL cannot probe the server's network. */
export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return false;
  }
  return true;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (config.imports.allowPrivateHosts) return;
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw ApiError.badRequest("That address is not allowed. Please paste a public recipe link.");
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw ApiError.badRequest("That address is not allowed. Please paste a public recipe link.");
    }
    return;
  }
  try {
    const records = await lookup(host, { all: true });
    if (records.some((record) => isPrivateAddress(record.address))) {
      throw ApiError.badRequest("That address is not allowed. Please paste a public recipe link.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest("We could not find that website. Check the link and try again.");
  }
}

export function normaliseUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw ApiError.badRequest("That does not look like a web link.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw ApiError.badRequest("Only http and https links can be imported.");
  }
  return url;
}

export type FetchedPage = { url: string; html: string; contentType: string };

/**
 * Fetches a public page with redirect, size and time limits.
 * `fetchImpl` is injectable so tests can serve fixtures without network access.
 */
export async function safeFetchPage(
  rawUrl: string,
  options: { fetchImpl?: typeof fetch; accept?: string } = {},
): Promise<FetchedPage> {
  const doFetch = options.fetchImpl ?? fetch;
  let url = normaliseUrl(rawUrl);
  const maxBytes = config.imports.maxBytes;

  for (let hop = 0; hop <= config.imports.maxRedirects; hop++) {
    await assertPublicHost(url.hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.imports.timeoutMs);
    try {
      const response = await doFetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "ChefUniverseBot/1.0 (+recipe import; contact: app owner)",
          accept: options.accept ?? "text/html,application/xhtml+xml,application/ld+json;q=0.9,*/*;q=0.5",
          "accept-language": "en",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw ApiError.upstream("That website sent us in circles.");
        url = normaliseUrl(new URL(location, url).toString());
        continue;
      }

      if (!response.ok) {
        throw ApiError.upstream(
          response.status === 403 || response.status === 401
            ? "That website does not allow recipe imports. Try copying the recipe text instead."
            : `That website could not be read (HTTP ${response.status}).`,
        );
      }

      const length = Number(response.headers.get("content-length") ?? 0);
      if (length && length > maxBytes) {
        throw ApiError.tooLarge("That page is too large to import.");
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        throw ApiError.tooLarge("That page is too large to import.");
      }

      return {
        url: url.toString(),
        html: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
        contentType: response.headers.get("content-type") ?? "text/html",
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if ((error as Error).name === "AbortError") {
        throw ApiError.upstream("That website took too long to answer. Please try again.");
      }
      throw ApiError.upstream("We could not reach that website. Check the link and try again.");
    } finally {
      clearTimeout(timer);
    }
  }

  throw ApiError.upstream("That link redirects too many times.");
}
