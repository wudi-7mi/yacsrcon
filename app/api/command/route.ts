import { NextResponse } from "next/server";
import { badRequest, errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { rcon } from "@/lib/rcon";
import { HIGH_RISK_COMMANDS } from "@/lib/parse";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();

  const { command, confirm } = await request.json();
  const value = String(command ?? "").trim();
  if (!value || value.length > 500) return badRequest("Invalid command");
  if (HIGH_RISK_COMMANDS.test(value) && confirm !== true) {
    return NextResponse.json(
      { error: "Confirmation required", requiresConfirmation: true },
      { status: 409 },
    );
  }

  try {
    return NextResponse.json({ response: await rcon.execute(value) });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
