import { NextResponse } from "next/server";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { readPlayerInventory } from "@/lib/inventory-simulator";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const steamId = new URL(request.url).searchParams.get("steamId") ?? "";
  if (!/^7656119\d{10}$/.test(steamId)) {
    return NextResponse.json({ error: "请输入有效的 SteamID64。" }, { status: 400 });
  }
  try {
    return NextResponse.json(await readPlayerInventory(steamId));
  } catch (error) {
    return errorResponse(error, 502);
  }
}
