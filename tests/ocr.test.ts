import "./setup.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { decodeImageDataUrl, recogniseImageText } from "../server/services/importer/ocr.js";
import { parseRecipeFromText } from "../server/services/importer/text.js";

/**
 * Real-Tesseract OCR against a generated scan fixture (English data ships
 * with the app, so this runs fully offline). The recognised text must flow
 * through the normal AI-onboarding parser into a usable recipe.
 */
describe("OCR photo scanning (real Tesseract)", () => {
  it("validates image data URLs", () => {
    assert.throws(() => decodeImageDataUrl("not-a-data-url", 4_000_000), /photo/i);
    assert.throws(() => decodeImageDataUrl("data:text/html;base64,SGVsbG8=", 4_000_000), /photo/i);
    const tiny = `data:image/png;base64,${Buffer.alloc(128).toString("base64")}`;
    assert.equal(decodeImageDataUrl(tiny, 4_000_000).byteLength, 128);
  });

  it("reads a Balochi Karahi scan and parses it into a recipe", { timeout: 120_000 }, async () => {
    const image = readFileSync(new URL("./fixtures/balochi-scan.png", import.meta.url));
    const result = await recogniseImageText(image);
    assert.match(result.text, /ingredients/i);
    assert.match(result.text, /chicken/i);
    assert.match(result.text, /karahi/i);

    const draft = parseRecipeFromText(result.text, {});
    assert.ok(draft.ingredients.length >= 5, `OCR parse gave ${draft.ingredients.length} ingredients`);
    assert.ok(draft.steps.length >= 3, `OCR parse gave ${draft.steps.length} steps`);
    const chicken = draft.ingredients.find((i) => /chicken/i.test(i.item));
    assert.equal(chicken?.quantity, 1);
    assert.equal(chicken?.unit, "kg");
  });
});
