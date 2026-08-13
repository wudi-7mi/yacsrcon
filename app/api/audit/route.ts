import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { recentAudit } from "@/lib/audit";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  action: z.string().trim().max(80).optional(),
  query: z.string().trim().max(200).optional(),
});

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return unauthorized();
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "审计筛选参数无效。" }, { status: 400 });
  }
  return NextResponse.json(await recentAudit(parsed.data));
}
