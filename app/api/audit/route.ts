import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { recentAudit } from "@/lib/audit";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  return NextResponse.json(await recentAudit());
}
