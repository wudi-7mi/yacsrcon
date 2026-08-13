import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { isAuthenticated } from "@/lib/auth";
import {
  punishmentCommand,
  punishmentSchema,
  punishmentSucceeded,
  readBans,
} from "@/lib/punishments";
import { rcon } from "@/lib/rcon";
import { toSteamId64 } from "@/lib/steam-id";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    return NextResponse.json(await readBans());
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    const value = punishmentSchema.parse(await request.json());
    if (value.action !== "unban" && value.userid) {
      const player = (await rcon.players()).find(
        (candidate) => candidate.userid === value.userid,
      );
      if (
        !player ||
        toSteamId64(player.steamId) !== value.steamId ||
        (value.playerName && player.name !== value.playerName)
      ) {
        return NextResponse.json(
          { error: "玩家已离线或身份信息发生变化，请刷新后重试。" },
          { status: 409 },
        );
      }
    }

    const command = punishmentCommand(value);
    const response = await rcon.execute(command);
    if (!punishmentSucceeded(value, response)) {
      return NextResponse.json(
        { error: response.trim() || "SimpleAdmin 未能执行处罚。" },
        { status: 502 },
      );
    }
    await audit("player_punishment", {
      action: value.action,
      steamId: value.steamId,
      playerName: "playerName" in value ? value.playerName : undefined,
      userid: "userid" in value ? value.userid : undefined,
      minutes: "minutes" in value ? value.minutes : undefined,
      reason: "reason" in value ? value.reason : undefined,
    });
    return NextResponse.json({ ok: true, response });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "处罚参数无效。" },
        { status: 400 },
      );
    }
    return errorResponse(error, 502);
  }
}
