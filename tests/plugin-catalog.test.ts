import assert from "node:assert/strict";
import test from "node:test";
import { buildPluginCenter } from "../lib/plugin-catalog.ts";

test("combines fixed plugin directories with runtime versions", () => {
  const result = buildPluginCenter(
    {
      active: ["CS2AnnouncementBroadcaster", "InventorySimulator"],
      disabled: ["MatchZy", "SharpTimer"],
    },
    [
      { name: "CS2 Announcement Broadcaster", version: "0.5.0", state: "LOADED" },
      { name: "InventorySimulator", version: "3.1.0", state: "LOADED" },
    ],
  );
  assert.equal(result.counts.loaded, 2);
  assert.equal(result.counts.disabled, 2);
  assert.equal(
    result.plugins.find((plugin) => plugin.id === "announcement-broadcaster")?.version,
    "0.5.0",
  );
  assert.equal(
    result.plugins.find((plugin) => plugin.id === "matchzy")?.state,
    "disabled",
  );
  assert.equal(
    result.plugins.find((plugin) => plugin.id === "simple-admin")?.state,
    "missing",
  );
});
