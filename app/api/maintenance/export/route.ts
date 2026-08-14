import { audit } from "@/lib/audit";
import { errorResponse, unauthorized } from "@/lib/api-response";
import { isAuthenticated } from "@/lib/auth";
import { buildRecoveryExport } from "@/lib/maintenance";

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  try {
    const value = await buildRecoveryExport();
    await audit("recovery_export", {
      configCount: value.configs.length,
      adminCount: Object.keys(value.admins.admins).length,
      warningCount: value.warnings.length,
    });
    const date = value.generatedAt.slice(0, 10);
    return new Response(`${JSON.stringify(value, null, 2)}\n`, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="yacsrcon-recovery-${date}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
