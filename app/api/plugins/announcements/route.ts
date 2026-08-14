import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { announcementMutationSchema, readAnnouncements, writeAnnouncements } from "@/lib/announcements";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    return NextResponse.json(await readAnnouncements());
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const parsed = announcementMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "公告配置无效。" }, { status: 400 });
  }
  try {
    const result = await writeAnnouncements(parsed.data);
    await audit("plugin_configuration_updated", {
      plugin: "announcement-broadcaster",
      messageCount: Object.values(result.config).reduce((sum, messages) => sum + messages.length, 0),
      backupId: result.backupId,
      reloadWarning: result.reloadWarning,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, 502);
  }
}
