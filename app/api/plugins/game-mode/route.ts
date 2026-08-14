import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { executeGameModeAction, gameModeActionSchema, readGameModeManager } from "@/lib/game-mode-manager";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    return NextResponse.json(await readGameModeManager());
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const parsed = gameModeActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "模式管理操作无效。" }, { status: 400 });
  }
  try {
    const result = await executeGameModeAction(parsed.data);
    await audit("plugin_control", { plugin: "gamemode-manager", operation: parsed.data.action, command: result.command });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, 502);
  }
}
