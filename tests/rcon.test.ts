import test from "node:test";
import assert from "node:assert/strict";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { RconService } = await import("../lib/rcon.ts");

function fakeClient(execute: (command: string) => Promise<string>) {
  const connection = {
    destroyed: false,
    destroy() {
      this.destroyed = true;
    },
  };
  return {
    connected: true,
    authenticated: true,
    connection,
    authenticate: async () => true,
    execute,
    isConnected() {
      return this.connected;
    },
    isAuthenticated() {
      return this.authenticated;
    },
  };
}

test("releases the command queue and reconnects after a stalled command", async () => {
  const stalled = fakeClient(() => new Promise(() => undefined));
  const recovered = fakeClient(async (command) => `ok:${command}`);
  const clients = [stalled, recovered];
  const service = new RconService({
    timeoutMs: 10,
    createClient: () => clients.shift()!,
    auditEvent: async () => true,
  });

  const first = service.execute("stalled");
  const second = service.execute("status");

  await assert.rejects(first, /timed out.*outcome may be unknown/i);
  assert.equal(await second, "ok:status");
  assert.equal(stalled.connection.destroyed, true);
});

test("audit storage failure does not change a successful command result", async () => {
  const client = fakeClient(async () => "command completed");
  const service = new RconService({
    timeoutMs: 100,
    createClient: () => client,
    auditEvent: async () => {
      throw new Error("disk full");
    },
  });

  assert.equal(await service.execute("status"), "command completed");
  assert.equal(client.connection.destroyed, false);
});
