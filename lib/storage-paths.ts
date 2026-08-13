import path from "node:path";

export type StoragePaths = {
  databasePath: string;
  sessionPath: string;
  auditPath: string;
};

export function resolveStoragePaths(
  databasePath: string,
  sessionPath?: string,
  auditPath?: string,
): StoragePaths {
  const database = path.resolve(databasePath);
  const parsed = path.parse(database);
  const stem = parsed.name || parsed.base || "yacsrcon";
  const resolved = {
    databasePath: database,
    sessionPath: sessionPath
      ? path.resolve(sessionPath)
      : path.join(parsed.dir, `${stem}.sessions.json`),
    auditPath: auditPath
      ? path.resolve(auditPath)
      : path.join(parsed.dir, `${stem}.jsonl`),
  };

  if (new Set(Object.values(resolved)).size !== 3) {
    throw new Error(
      "DATABASE_PATH, SESSION_PATH, and AUDIT_PATH must resolve to different files",
    );
  }
  return resolved;
}
