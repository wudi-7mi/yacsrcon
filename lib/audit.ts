import { appendFile, chmod, mkdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";
import type { AuditEntry, AuditResult } from "./types.ts";

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

let writeQueue = Promise.resolve();

async function rotateAudit(file: string, incomingBytes: number) {
  let currentBytes = 0;
  try {
    currentBytes = (await stat(file)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (currentBytes + incomingBytes <= config.AUDIT_MAX_BYTES) return;

  for (const [source, destination] of [
    [`${file}.1`, `${file}.2`],
    [file, `${file}.1`],
  ] as const) {
    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export async function audit(action: string, detail: Record<string, unknown>) {
  const file = config.AUDIT_PATH;
  const line = `${JSON.stringify({ ...redactAuditDetail(detail), at: new Date().toISOString(), action })}\n`;
  const write = writeQueue.then(async () => {
    try {
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await rotateAudit(file, Buffer.byteLength(line));
      await appendFile(file, line, { encoding: "utf8", mode: 0o600 });
      await chmod(file, 0o600);
      return true;
    } catch (error) {
      console.error("Audit write failed:", error);
      return false;
    }
  });
  writeQueue = write.then(
    () => undefined,
    () => undefined,
  );
  return write;
}

export function parseAuditText(text: string): AuditResult {
  let malformed = 0;
  const entries: AuditEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as AuditEntry;
      if (!entry || typeof entry.at !== "string" || typeof entry.action !== "string") {
        malformed += 1;
        continue;
      }
      if (["kick", "slay", "ban", "unban"].includes(entry.action)) {
        entry.operation = entry.action;
        entry.action = "player_punishment";
      }
      entries.push(entry);
    } catch {
      malformed += 1;
    }
  }
  return { entries, malformed };
}

export async function recentAudit({
  limit = 100,
  action,
  query,
}: {
  limit?: number;
  action?: string;
  query?: string;
} = {}): Promise<AuditResult> {
  const file = config.AUDIT_PATH;
  try {
    const texts = await Promise.all(
      [`${file}.2`, `${file}.1`, file].map(async (candidate) => {
        try {
          return await readFile(/* turbopackIgnore: true */ candidate, "utf8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
          throw error;
        }
      }),
    );
    const parsed = parseAuditText(texts.join("\n"));
    const needle = query?.trim().toLocaleLowerCase();
    parsed.entries = parsed.entries
      .filter((entry) => !action || entry.action === action)
      .filter(
        (entry) =>
          !needle || JSON.stringify(entry).toLocaleLowerCase().includes(needle),
      )
      .slice(-limit)
      .reverse();
    return parsed;
  } catch {
    return { entries: [], malformed: 0 };
  }
}
