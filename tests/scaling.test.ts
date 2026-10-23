import "./setup.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatQuantity, friendlyRound, parseQuantity, scaleFactorLabel, scaleIngredients,
} from "../server/services/scaling.js";

describe("quantity parsing", () => {
  it("reads fractions, mixed numbers and ranges", () => {
    assert.equal(parseQuantity("1 1/2"), 1.5);
    assert.equal(parseQuantity("1/2"), 0.5);
    assert.equal(parseQuantity("½"), 0.5);
    assert.equal(parseQuantity("2-3"), 2);
    assert.equal(parseQuantity("1,5"), 1.5);
    assert.equal(parseQuantity("350"), 350);
    assert.equal(parseQuantity("to taste"), null);
    assert.equal(parseQuantity(""), null);
  });

  it("rounds against ⅓ of a cup", () => {
    assert.equal(parseQuantity("1/3"), 0.3333333333333333);
  });
});

describe("friendly rounding", () => {
  it("never produces ugly decimals for cups", () => {
    assert.equal(friendlyRound(0.6666, "cups"), 0.75);
    assert.equal(friendlyRound(1.3333, "cups"), 1.25);
  });

  it("rounds grams sensibly and keeps small amounts", () => {
    assert.equal(friendlyRound(333.3, "g"), 330);
    assert.equal(friendlyRound(1250, "g"), 1250);
    assert.equal(friendlyRound(0.4, "g"), 0.4);
  });

  it("treats eggs as whole items", () => {
    assert.equal(friendlyRound(1.5, "eggs"), 2);
    assert.equal(friendlyRound(2.2, "eggs"), 2);
  });
});

describe("quantity formatting", () => {
  it("uses kitchen fractions", () => {
    assert.equal(formatQuantity(1.5, "cups"), "1½ cups");
    assert.equal(formatQuantity(0.25, "tsp"), "¼ tsp");
    assert.equal(formatQuantity(1, "cups"), "1 cup");
    assert.equal(formatQuantity(200, "g"), "200g");
    assert.equal(formatQuantity(2, null), "2");
  });
});

describe("portion scaling", () => {
  const ingredients = [
    { position: 0, quantity: 3, unit: "cups", item: "basmati rice", prepNote: null, groupName: null, scalable: true, rawText: null },
    { position: 1, quantity: 2, unit: "eggs", item: "eggs", prepNote: null, groupName: null, scalable: true, rawText: null },
    { position: 2, quantity: null, unit: null, item: "salt", prepNote: null, groupName: null, scalable: false, rawText: "Salt to taste" },
  ];

  it("scales every ingredient by servings / base servings", () => {
    const scaled = scaleIngredients(ingredients, 10 / 6, 6);
    assert.equal(scaled[0].quantityText, "5 cups");
    assert.equal(scaled[1].quantityText, "3 eggs", "10/6 of 2 eggs rounds to 3");
    assert.equal(scaled[2].scalable, false);
    assert.equal(scaled[2].quantityText, "");
  });

  it("half batches round down cleanly", () => {
    const scaled = scaleIngredients(ingredients, 0.5, 4);
    assert.equal(scaled[0].quantityText, "1½ cups");
    assert.equal(scaled[1].quantityText, "1 egg");
  });

  it("labels the scale factor for the UI", () => {
    assert.equal(scaleFactorLabel(10 / 6), "1.67×");
    assert.equal(scaleFactorLabel(2), "2×");
  });
});
