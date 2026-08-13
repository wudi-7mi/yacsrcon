import assert from "node:assert/strict";
import test from "node:test";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { filterServerLogs, serverActionSchema } = await import(
  "../lib/server-control.ts"
);

test("server control requires a confirmed fixed action", () => {
  assert.equal(
    serverActionSchema.safeParse({ action: "restart", confirm: true }).success,
    true,
  );
  assert.equal(
    serverActionSchema.safeParse({ action: "restart", confirm: false }).success,
    false,
  );
  assert.equal(
    serverActionSchema.safeParse({ action: "daemon-reload", confirm: true })
      .success,
    false,
  );
});

test("filters fixed server log categories", () => {
  const lines = [
    "CounterStrikeSharp loaded 12 plugins",
    "Metamod:Source version 2.0",
    "Fatal error loading map",
    "Certificate renewed",
  ];
  assert.deepEqual(filterServerLogs(lines, "counterstrikesharp"), [lines[0]]);
  assert.deepEqual(filterServerLogs(lines, "metamod"), [lines[1]]);
  assert.deepEqual(filterServerLogs(lines, "errors"), [lines[2]]);
  assert.deepEqual(filterServerLogs(lines, "all"), lines);
});
