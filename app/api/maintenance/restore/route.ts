import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { audit } from "@/lib/audit";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { restoreRecoveryExport } from "@/lib/maintenance";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const maximum = 4 * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > maximum) {
    return NextResponse.json({ error: "可恢复配置超过 4 MiB 限制。" }, { status: 413 });
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        return NextResponse.json({ error: "可恢复配置超过 4 MiB 限制。" }, { status: 413 });
      }
      chunks.push(value);
    }
  }
  const bodyBytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bodyBytes);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "恢复包不是有效的 JSON。" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("operation" in body) ||
    body.operation !== "restore" ||
    !("confirm" in body) ||
    body.confirm !== true ||
    !("bundle" in body)
  ) {
    return NextResponse.json(
      { error: "恢复操作无效或未经确认。" },
      { status: 400 },
    );
  }
  try {
    const result = await restoreRecoveryExport(body.bundle);
    await audit("recovery_restore", {
      adminCount: result.adminCount,
      configCount: result.configCount,
      reloadWarning: result.reloadWarning,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "恢复包内容无效。" },
        { status: 400 },
      );
    }
    return errorResponse(error, 502);
  }
}
