import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { customVotesMutationSchema, readCustomVotes, writeCustomVotes } from "@/lib/custom-votes";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    return NextResponse.json(await readCustomVotes());
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const parsed = customVotesMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "自定义投票配置无效。" }, { status: 400 });
  }
  try {
    const result = await writeCustomVotes(parsed.data);
    await audit("plugin_configuration_updated", {
      plugin: "custom-votes",
      voteCount: result.config.CustomVotes.length,
      backupId: result.backupId,
      reloadWarning: result.reloadWarning,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, 502);
  }
}
