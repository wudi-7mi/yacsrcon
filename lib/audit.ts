import { appendFile, chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";

const SENSITIVE_COMMAND =
  /(?:rcon_password|sv_password|(?:^|[\s_.-])(?:password|token|secret|api[_-]?key)(?=$|[\s_.-]))/i;

export function redactAuditDetail(detail: Record<string, unknown>) {
  const result = { ...detail };
  if (
    typeof result.command === "string" &&
    SENSITIVE_COMMAND.test(result.command.trim())
  ) {
    const commandName = result.command.trim().split(/\s+/)[0];
    result.command = `${commandName} [REDACTED]`;
    if ("response" in result) result.response = "[REDACTED]";
  }
  return result;
}

export async function audit(action: string, detail: Record<string, unknown>) {
  const file = path.resolve(config.DATABASE_PATH.replace(/\.db$/, ".jsonl"));
  try {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await appendFile(
      file,
      `${JSON.stringify({ at: new Date().toISOString(), action, ...redactAuditDetail(detail) })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await chmod(file, 0o600);
    return true;
  } catch (error) {
    console.error("Audit write failed:", error);
    return false;
  }
}

export async function recentAudit(limit = 40) {
  const file = path.resolve(config.DATABASE_PATH.replace(/\.db$/, ".jsonl"));
  try {
    const text = await (
      await import("node:fs/promises")
    ).readFile(file, "utf8");
    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
