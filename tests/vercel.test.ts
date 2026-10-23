import "./setup.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeApiRequestUrl } from "../server/vercel.js";

describe("Vercel catch-all API routing", () => {
  it("adds the Express API mount when the platform strips the function prefix", () => {
    assert.equal(normalizeApiRequestUrl("/health"), "/api/health");
    assert.equal(normalizeApiRequestUrl("/browser/navigate?url=https%3A%2F%2Fexample.com"), "/api/browser/navigate?url=https%3A%2F%2Fexample.com");
  });

  it("does not duplicate an API prefix already supplied by the platform", () => {
    assert.equal(normalizeApiRequestUrl("/api/health"), "/api/health");
    assert.equal(normalizeApiRequestUrl("/api/imports/ocr?x=1"), "/api/imports/ocr?x=1");
  });
});
