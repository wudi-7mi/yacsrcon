import assert from "node:assert/strict";
import test from "node:test";

process.env.RCON_PASSWORD ??= "test-rcon-password";
process.env.ADMIN_PASSWORD ??= "test-admin-password";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters";

const { cfgIdSchema, cfgMutationSchema } = await import("../lib/managed-cfg.ts");

test("accepts only fixed CFG identifiers", () => {
  assert.equal(cfgIdSchema.safeParse("server").success, true);
  assert.equal(cfgIdSchema.safeParse("../../etc/passwd").success, false);
});

test("requires confirmation and a current content hash for CFG writes", () => {
  const valid = {
    operation: "write",
    id: "common",
    content: "hostname test\n",
    expectedHash: "a".repeat(64),
    confirm: true,
  };
  assert.equal(cfgMutationSchema.safeParse(valid).success, true);
  assert.equal(
    cfgMutationSchema.safeParse({ ...valid, confirm: false }).success,
    false,
  );
  assert.equal(
    cfgMutationSchema.safeParse({ ...valid, expectedHash: "stale" }).success,
    false,
  );
});
