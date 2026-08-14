import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { readMonitoring } from "@/lib/metrics";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const hours = Number(new URL(request.url).searchParams.get("hours") ?? "6");
  if (![1, 6, 12, 24].includes(hours)) {
    return NextResponse.json({ error: "监控时间范围无效。" }, { status: 400 });
  }
  return NextResponse.json(await readMonitoring(hours));
}
