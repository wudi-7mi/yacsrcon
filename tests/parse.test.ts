import test from "node:test";
import assert from "node:assert/strict";
import { parsePlayers, parsePlugins, parseStatus } from "../lib/parse.ts";

test("parses a Source status summary", () => {
  const result = parseStatus(
    "hostname : Test Server\nudp/ip : 127.0.0.1:27015\nmap : de_dust2\nplayers : 3 humans, 1 bots (32 max)",
  );
  assert.equal(result.hostname, "Test Server");
  assert.equal(result.map, "de_dust2");
  assert.equal(result.players, 3);
  assert.equal(result.maxPlayers, 32);
  assert.equal(result.bots, 1);
});

test("falls back to the primary spawngroup for the current CS2 map", () => {
  const result = parseStatus(
    "@ Current : game\nloaded spawngroup(  1)  : SV:  [1: de_dust2 | main lump | mapload]",
  );
  assert.equal(result.map, "de_dust2");
});

test("parses player rows and plugin rows", () => {
  const players = parsePlayers(
    '# 2  "Player One"  STEAM_1:1:123  04:12  34  0  active  127.0.0.1:27005',
  );
  assert.equal(players.length, 1);
  assert.equal(players[0].name, "Player One");
  assert.equal(players[0].ping, 34);
  const plugins = parsePlugins("  1 [CS2] CounterStrikeSharp 1.0.371 | RUN");
  assert.equal(plugins.length, 1);
  assert.match(plugins[0].name, /CounterStrikeSharp/);
});

test("parses CounterStrikeSharp plugin list rows", () => {
  const plugins = parsePlugins(
    '[#1:LOADED]: "CS2Rcon" (1.2.0) by LordFetznschaedl\n' +
      '[#2:LOADED]: "GameModeManager" (1.0.62) by Striker-Nick',
  );
  assert.deepEqual(plugins, [
    { name: "CS2Rcon", version: "1.2.0", state: "LOADED" },
    { name: "GameModeManager", version: "1.0.62", state: "LOADED" },
  ]);
});
