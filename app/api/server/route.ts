import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import {
  controlServer,
  readServerLogs,
  serverActionSchema,
  serverLogFilterSchema,
} from "@/lib/server-control";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const filter = serverLogFilterSchema.safeParse(
    new URL(request.url).searchParams.get("filter") ?? "all",
  );
  if (!filter.success) {
    return NextResponse.json({ error: "服务器日志筛选参数无效。" }, { status: 400 });
  }
  try {
    return NextResponse.json(await readServerLogs(filter.data));
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const parsed = serverActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "服务器操作无效或未经确认。" },
      { status: 400 },
    );
  }
  try {
    const status = await controlServer(parsed.data.action);
    await audit("server_control", {
      operation: parsed.data.action,
      running: status.running,
      pid: status.pid,
    });
    return NextResponse.json(status);
  } catch (error) {
    return errorResponse(error, 502);
  }
}
