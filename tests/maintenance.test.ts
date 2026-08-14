import assert from "node:assert/strict";
import test from "node:test";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { recoveryBundleSchema } = await import("../lib/maintenance.ts");

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
