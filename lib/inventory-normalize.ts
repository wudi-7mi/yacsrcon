import type { InventoryItemSummary } from "./types.ts";

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function itemEntries(value: unknown): Array<[string, Record<string, unknown>]> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const object = objectValue(item);
      return object ? [[String(index), object]] : [];
    });
  }
  const object = objectValue(value);
  if (!object) return [];
  const nested = objectValue(object.items);
  const source = nested ?? object;
  return Object.entries(source).flatMap(([key, item]) => {
    if (["version", "updatedAt", "steamId"].includes(key)) return [];
    const candidate = objectValue(item);
    return candidate ? [[key, candidate]] : [];
  });
}

function stringField(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (typeof item[key] === "string" && item[key]) return item[key] as string;
    if (typeof item[key] === "number" && Number.isFinite(item[key])) return String(item[key]);
  }
  return null;
}

function numberField(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (typeof item[key] === "number" && Number.isFinite(item[key])) return item[key] as number;
  return null;
}

function summarizeItem(
  uid: string,
  item: Record<string, unknown>,
  equipped: string[] = [],
): InventoryItemSummary {
  const statTrak = numberField(item, "statTrak", "stattrak");
  return {
    uid,
    itemId: stringField(item, "id", "def", "defindex", "itemId", "musicId"),
    name: stringField(item, "name", "displayName", "weapon"),
    nameTag: stringField(item, "nameTag", "nametag"),
    model: stringField(item, "model", "modelKey", "type"),
    wear: numberField(item, "wear", "paintwear"),
    statTrak: statTrak !== null && statTrak >= 0 ? statTrak : null,
    equipped: [
      ...equipped,
      item.equipped === true ? "通用" : null,
      item.equippedCT === true ? "CT" : null,
      item.equippedT === true ? "T" : null,
      typeof item.team === "string" ? item.team : null,
      typeof item.slot === "string" ? item.slot : null,
    ].filter((entry): entry is string => Boolean(entry)),
    raw: item,
  };
}

export function normalizeInventoryItems(value: unknown): InventoryItemSummary[] {
  return itemEntries(value).map(([uid, item]) => summarizeItem(uid, item));
}

const dictionaryCategories = [
  ["agents", "探员"],
  ["ctWeapons", "CT 武器"],
  ["gloves", "手套"],
  ["knives", "刀具"],
  ["tWeapons", "T 武器"],
] as const;
const singletonCategories = [
  ["collectible", "收藏品"],
  ["graffiti", "涂鸦"],
  ["musicKit", "音乐盒"],
] as const;
const itemFields = new Set(["charges", "def", "hash", "keychains", "musicId", "nametag", "paint", "seed", "stattrak", "stickers", "tint", "uid", "wear"]);

function isEquippedItem(value: unknown): value is Record<string, unknown> {
  const item = objectValue(value);
  return Boolean(item && Object.keys(item).some((key) => itemFields.has(key)));
}

function teamForDictionary(category: string, key: string) {
  if (category === "ctWeapons") return "CT";
  if (category === "tWeapons") return "T";
  if (["agents", "gloves", "knives"].includes(category)) {
    if (key === "2") return "T";
    if (key === "3") return "CT";
  }
  return null;
}

export function normalizeEquippedV5(value: unknown): InventoryItemSummary[] {
  const root = objectValue(value);
  if (!root) return [];
  const result: InventoryItemSummary[] = [];
  for (const [category, label] of dictionaryCategories) {
    const dictionary = objectValue(root[category]);
    if (!dictionary) continue;
    for (const [key, value] of Object.entries(dictionary)) {
      if (!isEquippedItem(value)) continue;
      const team = teamForDictionary(category, key);
      result.push(summarizeItem(`${category}:${key}`, value, team ? [team, label] : [label]));
    }
  }
  for (const [category, label] of singletonCategories) {
    const item = root[category];
    if (!isEquippedItem(item)) continue;
    result.push(summarizeItem(category, item, [label]));
  }
  return result;
}
