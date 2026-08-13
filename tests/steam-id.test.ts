import test from "node:test";
import assert from "node:assert/strict";
import { toSteamId64 } from "../lib/steam-id.ts";

test("normalizes common Steam identities to SteamID64", () => {
  assert.equal(toSteamId64("76561197960265731"), "76561197960265731");
  assert.equal(toSteamId64("[U:1:3]"), "76561197960265731");
  assert.equal(toSteamId64("STEAM_1:1:1"), "76561197960265731");
});
