import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeEquippedV5, normalizeInventoryItems } from "../lib/inventory-normalize.ts";

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

test("expands real equipped v5 categories into actual items", () => {
  const fixture = JSON.parse(readFileSync(new URL("fixtures/inventory-equipped-v5.json", import.meta.url), "utf8"));
  const result = normalizeEquippedV5(fixture);
  assert.equal(result.length, 7);
  assert.deepEqual(result.map((item) => item.uid), [
    "agents:2",
    "agents:3",
    "ctWeapons:7",
    "ctWeapons:16",
    "knives:2",
    "collectible",
    "musicKit",
  ]);
  assert.deepEqual(result.map((item) => item.itemId), ["5105", "5036", "7", "16", "500", "874", "3"]);
  assert.deepEqual(result.find((item) => item.uid === "ctWeapons:7")?.equipped, ["CT", "CT 武器"]);
  assert.deepEqual(result.find((item) => item.uid === "agents:2")?.equipped, ["T", "探员"]);
  assert.equal(result.find((item) => item.uid === "musicKit")?.statTrak, null);
  assert.equal(result.some((item) => item.uid === "gloves" || item.uid === "tWeapons"), false);
});

test("ignores empty, null, and unknown equipped v5 categories", () => {
  assert.deepEqual(normalizeEquippedV5({ agents: {}, graffiti: null, musicKit: {}, futureCategory: { def: 99 } }), []);
});
