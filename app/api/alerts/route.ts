import { NextResponse } from "next/server";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { getAlertStatus, sendTestWebhook } from "@/lib/alerts";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  return NextResponse.json(await getAlertStatus());
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const value = await request.json().catch(() => null);
  if (value?.operation !== "test" || value?.confirm !== true) {
    return NextResponse.json(
      { error: "Webhook 测试操作无效或未经确认。" },
      { status: 400 },
    );
  }
  try {
    await sendTestWebhook();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
