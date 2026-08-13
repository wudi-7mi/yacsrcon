import test from "node:test";
import assert from "node:assert/strict";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { parseAuditText, redactAuditDetail } = await import("../lib/audit.ts");

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

test("keeps valid audit entries when a JSONL line is damaged", () => {
  assert.deepEqual(
    parseAuditText(
      '{"at":"2026-08-13T00:00:00.000Z","action":"command"}\nnot-json\n' +
        '{"at":"2026-08-13T00:01:00.000Z","action":"player_punishment","steamId":"76561190000000001"}\n',
    ),
    {
      entries: [
        { at: "2026-08-13T00:00:00.000Z", action: "command" },
        {
          at: "2026-08-13T00:01:00.000Z",
          action: "player_punishment",
          steamId: "76561190000000001",
        },
      ],
      malformed: 1,
    },
  );
});

test("normalizes legacy punishment actions for filtering", () => {
  assert.deepEqual(
    parseAuditText(
      '{"at":"2026-08-13T00:00:00.000Z","action":"ban","steamId":"76561190000000001"}\n',
    ).entries[0],
    {
      at: "2026-08-13T00:00:00.000Z",
      action: "player_punishment",
      operation: "ban",
      steamId: "76561190000000001",
    },
  );
});
