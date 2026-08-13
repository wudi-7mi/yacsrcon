#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseVdf } from "@node-steam/vdf";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultGameRoot = "/home/steam/cs2/game/csgo";

export const MODE_NAMES_ZH = {
  "Gun Game": "枪械升级",
  Deathmatch: "死亡竞赛",
  Competitive: "竞技模式",
  Wingman: "搭档模式",
  "Practice Mode": "练习模式",
  Prefire: "预瞄练习",
  Retakes: "回防模式",
  Executes: "战术执行",
  "Awp Only": "仅限 AWP",
  "1v1 Arenas": "1v1 竞技场",
  Aim: "瞄准练习",
  Bhop: "连跳",
  Surf: "滑翔",
  "Kreedz Climbing": "KZ 攀爬",
  "Capture The Flag": "夺旗模式",
  "Hide N Seek": "躲猫猫",
  Soccer: "足球模式",
  Course: "闯关模式",
  Deathrun: "死亡奔跑",
  Minigames: "小游戏",
  ScoutzKnivez: "鸟狙与匕首",
  "One In The Chamber": "一发入魂",
  "Battle Ball": "战斗球",
  "Battle Royale": "大逃杀",
  Casual: "休闲模式",
  "Casual (1.6)": "经典 1.6 休闲",
  "Competitive (Valve)": "Valve 竞技",
  "Deathmatch FFA (Valve)": "Valve 自由死亡竞赛",
  "Arms Race (Valve)": "Valve 军备竞赛",
  "Wingman (Valve)": "Valve 搭档模式",
  "Retakes (Valve)": "Valve 回防模式",
  "Competitive 45°": "45° 竞技",
};

function slug(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function workshopMap(value) {
  const match = String(value).match(/^workshop\/(\d+)\/([^/]+)$/i);
  if (!match) return null;
  return {
    name: match[2],
    workshopId: match[1],
    command: `host_workshop_map ${match[1]}`,
  };
}

function normalMap(value) {
  return { name: String(value), command: `changelevel ${value}` };
}

export function buildServerCatalog(gameModeManager, gameModesVdf) {
  const gameModes = gameModeManager?.GameModes;
  if (!gameModes?.Default || !Array.isArray(gameModes.List)) {
    throw new Error("GameModeManager 配置中缺少 GameModes.Default/List");
  }

  const parsed = parseVdf(gameModesVdf);
  const root =
    parsed.GameModes_Server ??
    parsed["GameModes_Server.txt"] ??
    Object.values(parsed).find(
      (value) => value && typeof value === "object" && value.mapgroups,
    ) ??
    parsed;
  const groups = root.mapgroups;
  if (!groups || typeof groups !== "object") {
    throw new Error("gamemodes_server.txt 中缺少 mapgroups");
  }

  const sourceModes = [gameModes.Default, ...gameModes.List];
  const seenIds = new Map();
  const modes = sourceModes.map((mode) => {
    const baseId = slug(`${mode.Name}-${mode.Config}`) || "mode";
    const count = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, count + 1);
    const id = count ? `${baseId}-${count + 1}` : baseId;
    const mapGroups = Array.isArray(mode.MapGroups) ? mode.MapGroups : [];
    const maps = [];
    const seenMaps = new Set();

    for (const groupName of mapGroups) {
      const groupMaps = groups[groupName]?.maps;
      if (!groupMaps || typeof groupMaps !== "object") continue;
      for (const mapPath of Object.keys(groupMaps)) {
        const map = workshopMap(mapPath) ?? normalMap(mapPath);
        const key = map.workshopId ? `workshop:${map.workshopId}` : map.name;
        if (!seenMaps.has(key)) {
          seenMaps.add(key);
          maps.push(map);
        }
      }
    }

    return {
      id,
      name: String(mode.Name),
      displayNameZh: MODE_NAMES_ZH[mode.Name] ?? String(mode.Name),
      config: String(mode.Config),
      defaultMap: mode.DefaultMap ? String(mode.DefaultMap) : null,
      mapGroups,
      maps,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: {
      gameModeManager: "GameModeManager.json",
      mapGroups: gameModes.MapGroupFile ?? "gamemodes_server.txt",
    },
    modes,
  };
}

async function readSource(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "EACCES") throw error;
    try {
      return execFileSync("sudo", ["-n", "-u", "steam", "cat", path], {
        encoding: "utf8",
      });
    } catch {
      throw new Error(
        `无法读取 ${path}；请确认当前用户可通过 sudo -u steam 读取服务器配置`,
      );
    }
  }
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}

async function main() {
  const managerPath = resolve(
    option(
      "--manager",
      `${defaultGameRoot}/addons/counterstrikesharp/configs/plugins/GameModeManager/GameModeManager.json`,
    ),
  );
  const mapGroupsPath = resolve(
    option("--map-groups", `${defaultGameRoot}/gamemodes_server.txt`),
  );
  const outputPath = resolve(
    option("--output", `${projectRoot}/config/server-catalog.json`),
  );

  const [managerText, mapGroupsText] = await Promise.all([
    readSource(managerPath),
    readSource(mapGroupsPath),
  ]);
  const catalog = buildServerCatalog(JSON.parse(managerText), mapGroupsText);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`已同步 ${catalog.modes.length} 个模式到 ${outputPath}`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
