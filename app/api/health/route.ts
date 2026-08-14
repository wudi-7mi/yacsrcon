import { NextResponse } from "next/server";
import { readHealth } from "@/lib/maintenance";

export async function GET() {
  try {
    const result = await readHealth();
    return NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        at: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        checks: { web: "ok", monitoring: "error", rcon: "unknown" },
      },
      { status: 503 },
    );
  }
}
