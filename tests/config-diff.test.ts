import assert from "node:assert/strict";
import test from "node:test";
import { buildCfgDiff } from "../lib/cfg-diff.ts";

test("shows removed and added CFG lines around unchanged context", () => {
  const result = buildCfgDiff("a\nb\nc\n", "a\nchanged\nc\n");
  assert.equal(result.some((line) => line.kind === "remove" && line.text === "b"), true);
  assert.equal(result.some((line) => line.kind === "add" && line.text === "changed"), true);
});
