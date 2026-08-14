import { NextResponse } from "next/server";
import { readHealth } from "@/lib/maintenance";

export async function GET() {
  const result = await readHealth();
  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
}
