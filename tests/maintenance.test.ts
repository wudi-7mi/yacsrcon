import assert from "node:assert/strict";
import test from "node:test";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const {
  readHealth,
  recoveryBundleSchema,
  reloadResponseFailed,
} = await import("../lib/maintenance.ts");
const { recoveryPayloadFromExport } = await import("../lib/recovery-payload.ts");

const admins = { admins: {}, groups: {}, overrides: {} };
const configs = ["server", "boot", "common", "bots"].map((id) => ({
  id,
  content: `// ${id}\n`,
}));

test("accepts a recovery bundle with every managed CFG", () => {
  const result = recoveryBundleSchema.safeParse({
    format: "yacsrcon-recovery-v1",
    admins,
    configs,
  });
  assert.equal(result.success, true);
});

test("rejects recovery bundles with duplicated or arbitrary CFG identifiers", () => {
  assert.equal(
    recoveryBundleSchema.safeParse({
      format: "yacsrcon-recovery-v1",
      admins,
      configs: [configs[0], configs[0], configs[2], configs[3]],
    }).success,
    false,
  );
  assert.equal(
    recoveryBundleSchema.safeParse({
      format: "yacsrcon-recovery-v1",
      admins,
      configs: [...configs.slice(0, 3), { id: "../../etc/passwd", content: "x" }],
    }).success,
    false,
  );
});

test("extracts only restorable data from a diagnostic recovery export", () => {
  const exported = {
    format: "yacsrcon-recovery-v1" as const,
    generatedAt: "2026-08-14T00:00:00.000Z",
    serverName: "Test server",
    admins,
    configs: configs.map((config) => ({
      ...config,
      label: config.id,
      filename: `${config.id}.cfg`,
      hash: "hash",
      persisted: true,
      modifiedAt: "2026-08-14T00:00:00.000Z",
      history: [{
        id: "backup",
        createdAt: "2026-08-13T00:00:00.000Z",
        size: 10,
        hash: "backup-hash",
      }],
    })),
    bans: [],
    monitoring: {
      samples: [],
      summary: {
        availabilityPercent: 100,
        disconnects: 0,
        averageLatencyMs: 10,
        peakPlayers: 0,
        currentAlert: null,
      },
    },
    audit: {
      entries: [],
      total: 0,
      hasMore: false,
      malformed: 0,
    },
    warnings: [],
  };

  const payload = recoveryPayloadFromExport(exported);
  assert.deepEqual(Object.keys(payload), ["format", "admins", "configs"]);
  assert.deepEqual(payload.configs, configs);
  assert.equal(recoveryBundleSchema.safeParse(payload).success, true);
});

test("recognizes textual RCON reload failures", () => {
  assert.equal(reloadResponseFailed('Unknown command "css_admins_reload"'), true);
  assert.equal(reloadResponseFailed("Command does not exist"), true);
  assert.equal(reloadResponseFailed("Admin cache reloaded successfully"), false);
});

test("reports metric storage failures as structured degraded health", async () => {
  const result = await readHealth(async () => {
    throw new Error("EACCES");
  });
  assert.equal(result.status, "degraded");
  assert.deepEqual(result.checks, {
    web: "ok",
    monitoring: "error",
    rcon: "unknown",
  });
});
