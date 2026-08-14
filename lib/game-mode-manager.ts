import "server-only";
import { z } from "zod";
import { runAdminHelper } from "./admin-config.ts";
import { GAME_SETTINGS } from "./game-settings.ts";
import { rcon } from "./rcon.ts";
import type { GameModeManagerStatus, PluginActionResult } from "./types.ts";

const settingIds = GAME_SETTINGS.map(([id]) => id) as [string, ...string[]];
export const gameModeActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rtv-enabled"), enabled: z.boolean(), confirm: z.literal(true) }).strict(),
  z.object({ action: z.literal("rtv-duration"), duration: z.number().int().min(5).max(600), confirm: z.literal(true) }).strict(),
  z.object({ action: z.literal("rtv-max-extends"), maxExtends: z.number().int().min(0).max(20), confirm: z.literal(true) }).strict(),
  z.object({ action: z.literal("rtv-end-vote"), enabled: z.boolean(), confirm: z.literal(true) }).strict(),
  z.object({ action: z.literal("rtv-start"), duration: z.number().int().min(5).max(600), includeModes: z.boolean(), confirm: z.literal(true) }).strict(),
  z.object({ action: z.literal("timelimit"), enabled: z.boolean(), seconds: z.number().int().min(0).max(86400).optional(), confirm: z.literal(true) }).strict(),
  z.object({ action: z.enum(["warmup-start", "warmup-end"]), confirm: z.literal(true) }).strict(),
  z.object({ action: z.literal("setting"), setting: z.enum(settingIds), enabled: z.boolean(), confirm: z.literal(true) }).strict(),
]);

const statusSchema = z.object({
  version: z.number().int(),
  rtv: z.object({ enabled: z.boolean(), duration: z.number(), maxExtends: z.number().int(), endOfMapVote: z.boolean(), includeModes: z.boolean() }),
  warmup: z.object({ enabled: z.boolean(), time: z.number(), modes: z.array(z.object({ name: z.string(), config: z.string() })) }),
  settings: z.array(z.enum(settingIds)),
});

export async function readGameModeManager() {
  const { stdout } = await runAdminHelper("game-mode");
  return statusSchema.parse(JSON.parse(stdout)) as GameModeManagerStatus;
}

export async function executeGameModeAction(value: z.infer<typeof gameModeActionSchema>): Promise<PluginActionResult> {
  let command: string;
  switch (value.action) {
    case "rtv-enabled": command = `css_rtv_enabled ${value.enabled}`; break;
    case "rtv-duration": command = `css_rtv_duration ${value.duration}`; break;
    case "rtv-max-extends": command = `css_rtv_max_extends ${value.maxExtends}`; break;
    case "rtv-end-vote": command = `css_rtv_end_of_map_vote ${value.enabled}`; break;
    case "rtv-start": command = `css_rtv_start_vote ${value.duration} ${value.includeModes}`; break;
    case "timelimit": command = `css_timelimit ${value.enabled}${value.seconds == null ? "" : ` ${value.seconds}`}`; break;
    case "warmup-start": command = "css_startwarmup"; break;
    case "warmup-end": command = "css_endwarmup"; break;
    case "setting": command = `exec settings/${value.enabled ? "enable" : "disable"}_${value.setting}.cfg`; break;
  }
  const response = await rcon.executeInternal(command);
  if (/unknown command|does not exist|not found|expected usage|invalid|error|failed/i.test(response)) {
    throw new Error(response.trim() || "GameModeManager 拒绝了操作。");
  }
  return { ok: true, command, response };
}
