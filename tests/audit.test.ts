import test from "node:test";
import assert from "node:assert/strict";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { redactAuditDetail } = await import("../lib/audit.ts");

test("redacts sensitive RCON command arguments and responses", () => {
  assert.deepEqual(
    redactAuditDetail({
      command: 'sv_password "private-value"',
      response: '"sv_password" = "private-value"',
      latencyMs: 12,
    }),
    {
      command: "sv_password [REDACTED]",
      response: "[REDACTED]",
      latencyMs: 12,
    },
  );
  assert.equal(
    redactAuditDetail({ command: "css_rcon sv_password hidden" }).command,
    "css_rcon [REDACTED]",
  );
  assert.equal(
    redactAuditDetail({ command: "set my_api_token hidden" }).command,
    "set [REDACTED]",
  );
});

test("keeps ordinary command audit details", () => {
  const detail = { command: "status", response: "players: 0" };
  assert.deepEqual(redactAuditDetail(detail), detail);
});
