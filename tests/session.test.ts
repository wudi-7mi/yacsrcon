import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = await mkdtemp(path.join(tmpdir(), "yacsrcon-session-test-"));
process.env.RCON_PASSWORD = "test-rcon-password";
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.AUTH_SECRET = "test-secret-at-least-32-characters";
process.env.DATABASE_PATH = path.join(directory, "yacsrcon.db");

const { createSession, revokeSession, verifySession } =
  await import("../lib/session.ts");

test("creates server-side sessions with strict permissions and revokes them", async () => {
  const session = await createSession();
  assert.equal(await verifySession(session.token), true);
  assert.equal(await verifySession(`${session.token}x`), false);

  const sessionPath = path.join(directory, "yacsrcon.sessions.json");
  assert.equal((await stat(sessionPath)).mode & 0o777, 0o600);

  await revokeSession(session.token);
  assert.equal(await verifySession(session.token), false);
});
