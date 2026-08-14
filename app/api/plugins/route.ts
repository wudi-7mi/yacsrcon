import { NextResponse } from "next/server";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { readPluginCenter } from "@/lib/plugin-management";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    return NextResponse.json(await readPluginCenter());
  } catch (error) {
    return errorResponse(error, 502);
  }
}
