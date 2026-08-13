import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveStoragePaths } from "../lib/storage-paths.ts";

test("derives independent sidecar paths for any database extension", () => {
  const paths = resolveStoragePaths("/data/state.sqlite");
  assert.deepEqual(paths, {
    databasePath: "/data/state.sqlite",
    sessionPath: "/data/state.sessions.json",
    auditPath: "/data/state.jsonl",
  });
  assert.equal(new Set(Object.values(paths)).size, 3);
});

test("derives sidecar paths for extensionless and relative database paths", () => {
  const paths = resolveStoragePaths("./data/state");
  assert.equal(paths.databasePath, path.resolve("./data/state"));
  assert.equal(paths.sessionPath, path.resolve("./data/state.sessions.json"));
  assert.equal(paths.auditPath, path.resolve("./data/state.jsonl"));
});

test("rejects explicit storage path collisions", () => {
  assert.throws(
    () => resolveStoragePaths("/data/state.sqlite", "/data/state.sqlite"),
    /must resolve to different files/,
  );
  assert.throws(
    () =>
      resolveStoragePaths(
        "/data/state.sqlite",
        "/data/shared.json",
        "/data/shared.json",
      ),
    /must resolve to different files/,
  );
});
