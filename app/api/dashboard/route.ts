import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { rcon } from "@/lib/rcon";
export async function GET() { if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); return NextResponse.json(await rcon.dashboard()); }
