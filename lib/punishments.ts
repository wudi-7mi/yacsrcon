import { z } from "zod";
import { runAdminHelper } from "./admin-config.ts";
import type { BanRecord } from "./types.ts";

const steamId = z.string().regex(/^7656119\d{10}$/);
const helperBan = z.object({
  steamId,
  playerName: z.string().nullable(),
  minutes: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});

type HelperBan = z.infer<typeof helperBan>;

export const punishmentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("kick"),
    confirm: z.literal(true),
    userid: z.string().regex(/^\d{1,10}$/),
    steamId,
    playerName: z.string().min(1).max(128),
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("slay"),
    confirm: z.literal(true),
    userid: z.string().regex(/^\d{1,10}$/),
    steamId,
    playerName: z.string().min(1).max(128),
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("ban"),
    confirm: z.literal(true),
    userid: z.string().regex(/^\d{1,10}$/).optional(),
    steamId,
    playerName: z.string().min(1).max(128).optional(),
    minutes: z.number().int().min(0).max(525_600),
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({ action: z.literal("unban"), confirm: z.literal(true), steamId }),
]);

export type Punishment = z.infer<typeof punishmentSchema>;

export function punishmentCommand(value: Punishment) {
  if (value.action === "kick") return `css_kick #${value.userid}`;
  if (value.action === "slay") return `css_slay #${value.userid}`;
  if (value.action === "unban") return `css_unban ${value.steamId}`;
  return value.minutes > 0
    ? `css_ban ${value.steamId} ${value.minutes}`
    : `css_ban ${value.steamId}`;
}

export function punishmentFailed(response: string) {
  return /couldn't|invalid ban length|already banned|expected usage|failed to|unknown command|command(?:\s+['"]?[^\r\n'"]+['"]?)?\s+(?:does not exist|not found)/i.test(
    response,
  );
}

export function punishmentSucceeded(value: Punishment, response: string) {
  if (punishmentFailed(response)) return false;
  if (value.action !== "ban") return true;

  return new RegExp(
    `with Steam ID ${value.steamId} has been banned(?: for \\d+ minutes?)?\\.`,
    "i",
  ).test(response);
}

export function normalizeBanRecords(
  rows: HelperBan[],
  now = new Date(),
): BanRecord[] {
  return rows.map((row) => {
    const createdAt = new Date(`${row.createdAt.replace(" ", "T")}Z`);
    const expiresAt =
      row.minutes > 0
        ? new Date(createdAt.getTime() + row.minutes * 60_000)
        : null;
    return {
      ...row,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
      expired: Boolean(expiresAt && expiresAt <= now),
    };
  });
}

export async function readBans(now = new Date()): Promise<BanRecord[]> {
  const { stdout } = await runAdminHelper("bans");
  const rows = z.array(helperBan).parse(JSON.parse(stdout));
  return normalizeBanRecords(rows, now);
}
