import crypto from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { config } from "./config.ts";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type SessionRecord = {
  expiresAt: number;
  credentialHash: string;
};
type SessionFile = { sessions: Record<string, SessionRecord> };
let mutationQueue: Promise<void> = Promise.resolve();

function sessionFile() {
  const database = path.resolve(config.DATABASE_PATH);
  return database.replace(/\.db$/, ".sessions.json");
}

function tokenHash(token: string) {
  return crypto
    .createHmac("sha256", config.AUTH_SECRET)
    .update(token)
    .digest("hex");
}

function credentialHash() {
  return crypto
    .createHmac("sha256", config.AUTH_SECRET)
    .update(`${config.ADMIN_USERNAME}\0${config.ADMIN_PASSWORD}`)
    .digest("hex");
}

async function readSessions(): Promise<SessionFile> {
  try {
    const parsed = JSON.parse(await readFile(sessionFile(), "utf8"));
    if (!parsed?.sessions || typeof parsed.sessions !== "object") {
      return { sessions: {} };
    }
    return parsed;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { sessions: {} };
    }
    throw error;
  }
}

async function writeSessions(value: SessionFile) {
  const file = sessionFile();
  const directory = path.dirname(file);
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, file);
    await chmod(file, 0o600);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

function mutate<T>(operation: () => Promise<T>) {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function prune(value: SessionFile, now = Date.now()) {
  for (const [hash, session] of Object.entries(value.sessions)) {
    if (
      !session ||
      session.expiresAt <= now ||
      session.credentialHash !== credentialHash()
    ) {
      delete value.sessions[hash];
    }
  }
}

export async function createSession() {
  return mutate(async () => {
    const value = await readSessions();
    prune(value);
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    value.sessions[tokenHash(token)] = {
      expiresAt,
      credentialHash: credentialHash(),
    };
    await writeSessions(value);
    return { token, expiresAt, maxAge: SESSION_TTL_MS / 1000 };
  });
}

export async function verifySession(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const value = await readSessions();
  const session = value.sessions[tokenHash(token)];
  return Boolean(
    session &&
    session.expiresAt > Date.now() &&
    session.credentialHash === credentialHash(),
  );
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  await mutate(async () => {
    const value = await readSessions();
    prune(value);
    delete value.sessions[tokenHash(token)];
    await writeSessions(value);
  });
}
