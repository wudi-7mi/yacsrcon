import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { login } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const secure = forwardedProtocol
    ? forwardedProtocol === "https"
    : new URL(request.url).protocol === "https:";
  if (!(await login(String(username ?? ""), String(password ?? ""), secure))) {
    return unauthorized();
  }
  return NextResponse.json({ ok: true });
}
