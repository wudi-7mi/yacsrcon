import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { errorResponse, unauthorized } from "@/lib/api-response";
import {
  readAdminConfiguration,
  writeAdminConfiguration,
} from "@/lib/admin-config";
import { audit } from "@/lib/audit";
import { isAuthenticated } from "@/lib/auth";
import { rcon } from "@/lib/rcon";

export async function GET() {
  if (!(await isAuthenticated())) {
    return unauthorized();
  }
  try {
    return NextResponse.json(await readAdminConfiguration());
  } catch (error) {
    return errorResponse(error, 502);
  }
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return unauthorized();
  }
  try {
    const before = await readAdminConfiguration();
    const value = await request.json();
    const result = await writeAdminConfiguration(value);
    let reloadWarning: string | undefined;
    try {
      for (const command of [
        "css_groups_reload",
        "css_overrides_reload",
        "css_admins_reload",
      ]) {
        const response = await rcon.executeInternal(command);
        if (/unknown command|error|failed/i.test(response)) {
          throw new Error(`${command}: ${response.trim()}`);
        }
      }
    } catch (error) {
      reloadWarning = error instanceof Error ? error.message : String(error);
    }
    await audit("admin_configuration_updated", {
      adminCountBefore: Object.keys(before.admins).length,
      adminCountAfter: Object.keys(value?.admins ?? {}).length,
      groupCountBefore: Object.keys(before.groups).length,
      groupCountAfter: Object.keys(value?.groups ?? {}).length,
      backupDirectory: result.backupDirectory,
      reloadWarning,
    });
    return NextResponse.json({ ok: true, ...result, reloadWarning });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : 502;
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message
        : error instanceof Error
          ? error.message
          : String(error);
    return NextResponse.json({ error: message }, { status });
  }
}
