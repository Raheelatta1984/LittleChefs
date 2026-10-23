import "./setup.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeApiRequestUrl } from "../server/vercel.js";

describe("Vercel API routing", () => {
  describe("rewrite destination carrying the path in __path", () => {
    // vercel.json: "/api/(.*)" -> "/api?__path=/$1".
    // Vercel hands the function the destination URL, so this is what the
    // function actually receives for a browser request to /api/health.
    it("rebuilds the requested path from __path", () => {
      assert.equal(normalizeApiRequestUrl("/api?__path=/health"), "/api/health");
      assert.equal(normalizeApiRequestUrl("/api?__path=/chefs/sign-in"), "/api/chefs/sign-in");
      assert.equal(normalizeApiRequestUrl("/api?__path=/recipes/abc-123"), "/api/recipes/abc-123");
    });

    it("rebuilds nested routes the bracketed catch-all could never match", () => {
      assert.equal(
        normalizeApiRequestUrl("/api?__path=/catalogue/3f9c/claim"),
        "/api/catalogue/3f9c/claim",
      );
      assert.equal(normalizeApiRequestUrl("/api?__path=/browser/navigate"), "/api/browser/navigate");
      assert.equal(normalizeApiRequestUrl("/api?__path=/imports/ocr"), "/api/imports/ocr");
    });

    it("keeps the client query string the rewrite merged in alongside __path", () => {
      assert.equal(normalizeApiRequestUrl("/api?__path=/search&q=biryani"), "/api/search?q=biryani");
      assert.equal(
        normalizeApiRequestUrl("/api?__path=/browser/navigate&url=https%3A%2F%2Fexample.com"),
        "/api/browser/navigate?url=https%3A%2F%2Fexample.com",
      );
      assert.equal(normalizeApiRequestUrl("/api?__path=/search&q=chicken%20biryani"), "/api/search?q=chicken+biryani");
    });

    it("accepts an encoded capture and never leaves __path behind", () => {
      assert.equal(normalizeApiRequestUrl("/api?__path=%2Fcatalogue%2F42%2Fclaim"), "/api/catalogue/42/claim");
      assert.ok(!normalizeApiRequestUrl("/api?__path=/search&q=x").includes("__path"));
    });

    it("maps an empty capture to the API mount", () => {
      assert.equal(normalizeApiRequestUrl("/api?__path="), "/api/");
      assert.equal(normalizeApiRequestUrl("/api?__path=/"), "/api/");
    });
  });

  describe("other URL shapes the platform may hand the function", () => {
    it("does not duplicate an API prefix already supplied by the platform", () => {
      assert.equal(normalizeApiRequestUrl("/api/health"), "/api/health");
      assert.equal(normalizeApiRequestUrl("/api/imports/ocr?x=1"), "/api/imports/ocr?x=1");
      assert.equal(normalizeApiRequestUrl("/api"), "/api");
    });

    it("adds the Express API mount when the platform strips the function prefix", () => {
      assert.equal(normalizeApiRequestUrl("/health"), "/api/health");
      assert.equal(
        normalizeApiRequestUrl("/browser/navigate?url=https%3A%2F%2Fexample.com"),
        "/api/browser/navigate?url=https%3A%2F%2Fexample.com",
      );
    });

    it("trims the function's own /api/index path back to the API mount", () => {
      assert.equal(normalizeApiRequestUrl("/api/index"), "/api");
      assert.equal(normalizeApiRequestUrl("/api/index/search?q=x"), "/api/search?q=x");
      assert.equal(normalizeApiRequestUrl("/api/index/chefs/sign-in"), "/api/chefs/sign-in");
    });

    it("handles a missing URL without throwing", () => {
      assert.equal(normalizeApiRequestUrl(undefined), "/api/");
      assert.equal(normalizeApiRequestUrl(""), "/api/");
    });
  });
});
