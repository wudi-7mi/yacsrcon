import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

export async function audit(action: string, detail: Record<string, unknown>) {
  const file = path.resolve(config.DATABASE_PATH.replace(/\.db$/, ".jsonl"));
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify({ at: new Date().toISOString(), action, ...detail }) + "\n");
}

export async function recentAudit(limit = 40) {
  const file = path.resolve(config.DATABASE_PATH.replace(/\.db$/, ".jsonl"));
  try {
    const text = await (await import("node:fs/promises")).readFile(file, "utf8");
    return text.trim().split("\n").filter(Boolean).slice(-limit).reverse().map((line) => JSON.parse(line));
  } catch { return []; }
}
