import test from "node:test";
import assert from "node:assert/strict";
import { OperationTimeoutError, withTimeout } from "../lib/timeout.ts";

test("rejects a stalled operation and invokes timeout cleanup", async () => {
  let cleanedUp = false;
  await assert.rejects(
    withTimeout(
      new Promise<never>(() => undefined),
      10,
      "test operation",
      () => {
        cleanedUp = true;
      },
    ),
    OperationTimeoutError,
  );
  assert.equal(cleanedUp, true);
});

test("does not invoke cleanup for a completed operation", async () => {
  let cleanedUp = false;
  const result = await withTimeout(Promise.resolve("ok"), 100, "test", () => {
    cleanedUp = true;
  });
  assert.equal(result, "ok");
  assert.equal(cleanedUp, false);
});
