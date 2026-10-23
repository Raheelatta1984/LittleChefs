import "./setup.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AISLE_ORDER, aisleFor, buildShoppingList } from "../server/services/shopping.js";

describe("aisle mapping", () => {
  it("puts ingredients where you actually find them", () => {
    assert.equal(aisleFor("chicken breasts"), "meat");
    assert.equal(aisleFor("full-fat milk"), "dairy");
    assert.equal(aisleFor("ground cinnamon"), "spices");
    assert.equal(aisleFor("basmati rice"), "pantry");
    assert.equal(aisleFor("soy sauce"), "sauces");
    assert.equal(aisleFor("fresh coriander leaves"), "produce");
    assert.equal(aisleFor("mystery ingredient"), "other");
  });

  it("prefers the head ingredient over a trailing mention", () => {
    assert.equal(aisleFor("saffron or yellow food colour in milk"), "spices");
    assert.equal(aisleFor("ghee"), "sauces");
  });
});

describe("shopping list building", () => {
  it("de-duplicates and sums matching units", () => {
    const list = buildShoppingList([
      { item: "basmati rice", quantityText: "2 cups", quantity: 2, unit: "cups" },
      { item: "Basmati Rice", quantityText: "1 cup", quantity: 1, unit: "cups" },
      { item: "onion", quantityText: "2", quantity: 2, unit: null },
    ]);
    const rice = list.items.find((item) => item.item.toLowerCase() === "basmati rice");
    assert.equal(rice?.quantityText, "3 cups");
    assert.equal(list.groups.some((group) => group.aisle === "pantry"), true);
  });

  it("joins quantities when units differ instead of lying", () => {
    const list = buildShoppingList([
      { item: "tomatoes", quantityText: "3", quantity: 3, unit: null },
      { item: "tomato", quantityText: "200g", quantity: 200, unit: "g" },
    ]);
    assert.equal(list.items.length, 1);
    assert.match(list.items[0].quantityText, /\d+.*\+.*\d+/);
  });

  it("moves pantry staples off the buy list", () => {
    const list = buildShoppingList(
      [
        { item: "salt", quantityText: "1 tsp", quantity: 1, unit: "tsp" },
        { item: "chicken", quantityText: "500g", quantity: 500, unit: "g" },
        { item: "olive oil", quantityText: "2 tbsp", quantity: 2, unit: "tbsp" },
      ],
      { pantry: ["salt", "olive oil"] },
    );
    assert.equal(list.totals.toBuy, 1);
    assert.equal(list.totals.alreadyAtHome, 2);
    assert.equal(list.items.find((item) => item.item === "salt")?.alreadyAtHome, true);
  });

  it("orders groups the way a shop is laid out", () => {
    const list = buildShoppingList([
      { item: "frozen peas", quantityText: "1 cup" },
      { item: "chicken", quantityText: "500g" },
      { item: "onion", quantityText: "1" },
    ]);
    const order = list.groups.map((group) => group.aisle);
    const indexes = order.map((aisle) => AISLE_ORDER.indexOf(aisle));
    assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
    assert.equal(order[0], "produce");
  });
});
