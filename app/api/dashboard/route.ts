import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { rcon } from "@/lib/rcon";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  return NextResponse.json(await rcon.dashboard());
}
