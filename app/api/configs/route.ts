import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import {
  cfgIdSchema,
  cfgMutationSchema,
  listManagedCfg,
  mutateManagedCfg,
  readManagedCfg,
} from "@/lib/managed-cfg";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (!id) return NextResponse.json(await listManagedCfg());
    const parsed = cfgIdSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: "CFG 配置 ID 无效。" }, { status: 400 });
    }
    return NextResponse.json(await readManagedCfg(parsed.data));
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const parsed = cfgMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "CFG 操作参数无效或未经确认。" },
      { status: 400 },
    );
  }
  try {
    const result = await mutateManagedCfg(parsed.data);
    await audit("cfg_updated", {
      operation: parsed.data.operation,
      configId: parsed.data.id,
      filename: result.filename,
      backupId: result.backupId,
      hash: result.hash,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, 502);
  }
}
