import "server-only";
import { z } from "zod";
import { runAdminHelper } from "./admin-config.ts";
import { rcon } from "./rcon.ts";
import type { AnnouncementDocument } from "./types.ts";

const conditionSchema = z.object({
  flag: z.enum(["CS2AB_flag_1", "CS2AB_flag_2", "CS2AB_flag_3", "CS2AB_flag_4", "CS2AB_flag_5"]),
  op: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  value: z.number().int().min(-1_000_000).max(1_000_000),
}).strict();
const baseMessage = z.object({
  msg: z.string().min(1).max(4000),
  admin: z.boolean().optional(),
  cond: conditionSchema.optional(),
}).passthrough();
const connectMessage = baseMessage.extend({ delay: z.number().min(-1).max(3600).optional() });
const commandMessage = baseMessage.extend({ cmd: z.string().min(1).max(32).regex(/^[a-zA-Z0-9_-]+$/) });
const timerMessage = baseMessage.extend({ timer: z.number().min(1).max(86400) });

export const announcementConfigSchema = z.object({
  OnPlayerConnectMsgs: z.array(connectMessage).max(200).default([]),
  OnAdminConnectMsgs: z.array(connectMessage).max(200).default([]),
  OnRoundStartMsgs: z.array(baseMessage).max(200).default([]),
  OnCommandMsgs: z.array(commandMessage).max(200).default([]),
  TimerMsgs: z.array(timerMessage).max(200).default([]),
}).strict();

export const announcementMutationSchema = z.object({
  operation: z.literal("write"),
  config: announcementConfigSchema,
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirm: z.literal(true),
});

async function announcementHelper(value: Record<string, unknown>) {
  const { stdout } = await runAdminHelper("plugin-config", JSON.stringify({ id: "announcements", ...value }));
  return JSON.parse(stdout) as AnnouncementDocument;
}

export async function readAnnouncements() {
  const result = await announcementHelper({ operation: "read" });
  return { ...result, config: announcementConfigSchema.parse(result.config) };
}

export async function writeAnnouncements(value: z.infer<typeof announcementMutationSchema>) {
  const result = await announcementHelper(value);
  let reloadWarning: string | undefined;
  try {
    const response = await rcon.executeInternal("css_abreload");
    if (/unknown command|does not exist|not found|error|failed/i.test(response)) {
      reloadWarning = response.trim() || "公告插件拒绝了热重载命令。";
    }
  } catch (error) {
    reloadWarning = error instanceof Error ? error.message : String(error);
  }
  return { ...result, config: announcementConfigSchema.parse(result.config), reloadWarning };
}
