import "./setup.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeKey, isSameDish, normaliseDishName, normaliseIngredient } from "../server/services/normalise.js";

describe("dish name normalisation", () => {
  it("strips filler words and noise", () => {
    assert.equal(normaliseDishName("Easy Chicken Biryani Recipe!"), "chicken biryani");
    assert.equal(normaliseDishName("  The BEST   Chocolate Cake  "), "chocolate cake");
    assert.equal(normaliseDishName("Bœuf Bourguignon"), "boeuf bourguignon");
  });

  it("produces a stable dedupe key", () => {
    assert.equal(dedupeKey("Chicken Biryani"), dedupeKey("easy chicken biryani recipe"));
    assert.notEqual(dedupeKey("Chicken Biryani"), dedupeKey("Beef Nihari"));
  });
});

describe("same-dish matching", () => {
  it("matches the same dish across titles", () => {
    assert.equal(isSameDish("Chicken Biryani", "Hyderabadi Chicken Biryani"), true);
    assert.equal(isSameDish("Tres Leches Cake", "tres leches"), true);
    assert.equal(isSameDish("Butter Chicken", "Chicken Butter"), true);
  });

  it("does not merge different dishes", () => {
    assert.equal(isSameDish("Chicken Biryani", "Beef Nihari"), false);
    assert.equal(isSameDish("Chocolate Cake", "Carrot Cake"), false);
    assert.equal(isSameDish("Mango Lassi", "Masala Chai"), false);
  });

  it("does not let a generic word claim everything", () => {
    assert.equal(isSameDish("Cake", "Chocolate Cake"), false);
  });
});

describe("ingredient normalisation", () => {
  it("reduces preparation noise", () => {
    assert.equal(normaliseIngredient("2 large onions, finely chopped"), "onion");
    assert.equal(normaliseIngredient("Freshly ground black pepper"), "ground black pepper");
  });
});
