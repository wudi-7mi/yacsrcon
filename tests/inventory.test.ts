import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInventoryItems } from "../lib/inventory-normalize.ts";

test("normalizes versioned inventory payloads", () => {
  const result = normalizeInventoryItems({
    version: 5,
    items: {
      "12": { id: "7", modelKey: "ak47", nameTag: "训练枪", wear: 0.12, statTrak: 42, equippedT: true },
    },
  });
  assert.deepEqual(result, [{
    uid: "12",
    itemId: "7",
    name: null,
    nameTag: "训练枪",
    model: "ak47",
    wear: 0.12,
    statTrak: 42,
    equipped: ["T"],
    raw: { id: "7", modelKey: "ak47", nameTag: "训练枪", wear: 0.12, statTrak: 42, equippedT: true },
  }]);
});

test("accepts arrays and empty public API responses", () => {
  assert.equal(normalizeInventoryItems({}).length, 0);
  assert.equal(normalizeInventoryItems([{ defindex: "9", equipped: true }])[0]?.itemId, "9");
});
