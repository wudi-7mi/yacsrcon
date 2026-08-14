import { NextResponse } from "next/server";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { readMaintenanceStatus } from "@/lib/maintenance";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    return NextResponse.json(await readMaintenanceStatus());
  } catch (error) {
    return errorResponse(error, 502);
  }
}
