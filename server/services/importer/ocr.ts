import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { ApiError } from "../../lib/errors.js";

/**
 * OCR for scanned / photographed / screenshotted recipes (Tesseract WASM).
 *
 * The English language data ships with the app (@tesseract.js-data/eng), so
 * scanning works offline and recipe photos never leave the server. The
 * recognised text is fed into the exact same AI-onboarding parser used for
 * websites and YouTube descriptions.
 */

export type OcrResult = { text: string; confidence: number | null };

export type OcrRecognise = (image: Buffer) => Promise<OcrResult>;

const requireFromHere = createRequire(import.meta.url);

function englishLangDir(): { langPath: string; gzip: boolean } | null {
  try {
    // The package's index exports { code, gzip, langPath }.
    const data = requireFromHere("@tesseract.js-data/eng") as { langPath?: string; gzip?: boolean };
    if (data.langPath && existsSync(join(data.langPath, "eng.traineddata.gz"))) {
      return { langPath: data.langPath, gzip: data.gzip !== false };
    }
    // Fallback: walk from the resolved index.js.
    const indexPath = requireFromHere.resolve("@tesseract.js-data/eng");
    for (const sub of ["4.0.0", "4.0.0_best_int"]) {
      const candidate = join(dirname(indexPath), sub);
      if (existsSync(join(candidate, "eng.traineddata.gz"))) {
        return { langPath: candidate, gzip: true };
      }
    }
  } catch {
    // Data package missing — tesseract.js would try to download it, which we
    // never want on a server. Report OCR as unavailable instead.
  }
  return null;
}

/** Real Tesseract-backed recogniser. Throws ApiError when OCR is unavailable. */
export const recogniseImageText: OcrRecognise = async (image: Buffer): Promise<OcrResult> => {
  const lang = englishLangDir();
  if (!lang) {
    throw ApiError.upstream(
      "Photo scanning (OCR) is not available on this server. Paste the recipe text instead — AI Onboarding will read it just the same.",
    );
  }

  let createWorker: typeof import("tesseract.js").createWorker;
  try {
    ({ createWorker } = await import("tesseract.js"));
  } catch {
    throw ApiError.upstream(
      "Photo scanning (OCR) is not available on this server. Paste the recipe text instead — AI Onboarding will read it just the same.",
    );
  }

  const worker = await createWorker("eng", 1, {
    langPath: lang.langPath,
    gzip: lang.gzip,
    cachePath: tmpdir(),
  });
  try {
    const { data } = await worker.recognize(image);
    return {
      text: (data.text ?? "").trim(),
      confidence: Number.isFinite(data.confidence) ? data.confidence : null,
    };
  } catch {
    throw ApiError.upstream(
      "We couldn't scan that photo. Try a clearer, well-lit picture held straight-on — or paste the recipe text instead.",
    );
  } finally {
    await worker.terminate().catch(() => undefined);
  }
};

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

/** Decodes + validates a `data:image/…;base64,…` payload (same rules as uploads). */
export function decodeImageDataUrl(dataUrl: string, maxBytes: number): Buffer {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    throw ApiError.badRequest("Send the photo as an image (png, jpg or webp) so we can scan it.");
  }
  const [, mime, base64] = match;
  if (!ALLOWED_MIME[mime.toLowerCase()]) {
    throw ApiError.badRequest("Only png, jpg, webp, gif or bmp photos can be scanned.");
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > maxBytes) {
    throw ApiError.tooLarge("That photo is too big to scan — please keep it under 4 MB.");
  }
  if (buffer.byteLength < 64) {
    throw ApiError.badRequest("That image looks empty. Try taking the photo again.");
  }
  return buffer;
}
