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

export function normalizeInventoryItems(value: unknown): InventoryItemSummary[] {
  return itemEntries(value).map(([uid, item]) => ({
    uid,
    itemId: stringField(item, "id", "defindex", "itemId"),
    name: stringField(item, "name", "displayName", "weapon"),
    nameTag: stringField(item, "nameTag", "nametag"),
    model: stringField(item, "model", "modelKey", "type"),
    wear: numberField(item, "wear", "paintwear"),
    statTrak: numberField(item, "statTrak", "stattrak"),
    equipped: [
      item.equipped === true ? "通用" : null,
      item.equippedCT === true ? "CT" : null,
      item.equippedT === true ? "T" : null,
      typeof item.team === "string" ? item.team : null,
      typeof item.slot === "string" ? item.slot : null,
    ].filter((entry): entry is string => Boolean(entry)),
    raw: item,
  }));
}
