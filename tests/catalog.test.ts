import test from "node:test";
import assert from "node:assert/strict";
// The sync script stays directly executable by Node and does not emit types.
// @ts-expect-error importing the tested JavaScript entry point is intentional.
import { buildServerCatalog } from "../scripts/sync-server-catalog.mjs";
import { HIGH_RISK_COMMANDS } from "../lib/parse.ts";

const manager = {
  GameModes: {
    Default: {
      Name: "Competitive",
      Config: "comp.cfg",
      DefaultMap: "de_inferno",
      MapGroups: ["mg_comp", "mg_workshop"],
    },
    List: [],
    MapGroupFile: "gamemodes_server.txt",
  },
};

const mapGroups = `
"GameModes_Server.txt"
{
  "mapgroups"
  {
    "mg_comp"
    {
      "maps"
      {
        "de_inferno" ""
      }
    }
    "mg_workshop"
    {
      "maps"
      {
        "workshop/3256988376/de_warden" ""
      }
    }
  }
}
`;

test("builds modes and map commands from GameModeManager and VDF", () => {
  const catalog = buildServerCatalog(manager, mapGroups);
  assert.equal(catalog.modes.length, 1);
  assert.equal(catalog.modes[0].displayNameZh, "竞技模式");
  assert.equal(catalog.modes[0].config, "comp.cfg");
  assert.deepEqual(catalog.modes[0].maps, [
    { name: "de_inferno", command: "changelevel de_inferno" },
    {
      name: "de_warden",
      workshopId: "3256988376",
      command: "host_workshop_map 3256988376",
    },
  ]);
});

test("requires confirmation for both standard and Workshop map changes", () => {
  assert.match("changelevel de_inferno", HIGH_RISK_COMMANDS);
  assert.match("host_workshop_map 3256988376", HIGH_RISK_COMMANDS);
});
