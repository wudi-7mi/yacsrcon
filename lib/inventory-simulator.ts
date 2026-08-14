import "server-only";
import { normalizeEquippedV5, normalizeInventoryItems } from "./inventory-normalize.ts";
import type { InventorySimulatorResult } from "./types.ts";

export const INVENTORY_SERVICE_URL = "https://inventory.cstrike.app";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

async function fetchJson(path: string) {
  const response = await fetch(`${INVENTORY_SERVICE_URL}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Inventory Simulator 返回 HTTP ${response.status}。`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("Inventory Simulator 响应超过大小限制。");
  const body = await response.text();
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) throw new Error("Inventory Simulator 响应超过大小限制。");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Inventory Simulator 返回了无效 JSON。");
  }
}

export async function readPlayerInventory(steamId: string): Promise<InventorySimulatorResult> {
  const [inventoryPayload, equippedPayload] = await Promise.all([
    fetchJson(`/api/inventory/${steamId}.json`),
    fetchJson(`/api/equipped/v5/${steamId}.json`),
  ]);
  const inventory = normalizeInventoryItems(inventoryPayload);
  const equipped = normalizeEquippedV5(equippedPayload);
  return {
    steamId,
    serviceUrl: INVENTORY_SERVICE_URL,
    inventory,
    equipped,
    counts: { inventory: inventory.length, equipped: equipped.length },
  };
}
