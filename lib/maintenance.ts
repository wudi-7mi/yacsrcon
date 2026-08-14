import { stat, statfs } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  adminConfigurationSchema,
  readAdminConfiguration,
  runAdminHelper,
  writeAdminConfiguration,
} from "./admin-config.ts";
import { recentAudit } from "./audit.ts";
import { config } from "./config.ts";
import { listManagedCfg, mutateManagedCfg, readManagedCfg } from "./managed-cfg.ts";
import { readLatestMetric, readMonitoring } from "./metrics.ts";
import { readBans } from "./punishments.ts";
import { rcon } from "./rcon.ts";
import type {
  HealthResult,
  MaintenanceStatus,
  RecoveryExport,
  RecoveryResult,
} from "./types.ts";

const usage = z.object({
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});
const helperStatus = z.object({
  filesystem: z.object({
    totalBytes: z.number().int().nonnegative(),
    freeBytes: z.number().int().nonnegative(),
  }),
  cfgBackups: usage,
  adminBackups: usage,
});

const recoveryConfig = z.object({
  id: z.enum(["server", "boot", "common", "bots"]),
  content: z.string().max(128 * 1024),
});

export const recoveryBundleSchema = z
  .object({
    format: z.literal("yacsrcon-recovery-v1"),
    admins: adminConfigurationSchema,
    configs: z.array(recoveryConfig).length(4),
  })
  .superRefine((value, context) => {
    const ids = new Set(value.configs.map((item) => item.id));
    for (const id of ["server", "boot", "common", "bots"] as const) {
      if (!ids.has(id)) {
        context.addIssue({
          code: "custom",
          path: ["configs"],
          message: `恢复包缺少 ${id} 配置`,
        });
      }
    }
  });

async function applicationDataUsage() {
  const candidates = [
    config.DATABASE_PATH,
    config.SESSION_PATH,
    config.AUDIT_PATH,
    `${config.AUDIT_PATH}.1`,
    `${config.AUDIT_PATH}.2`,
    config.METRICS_PATH,
    config.ALERT_STATE_PATH,
  ];
  let files = 0;
  let bytes = 0;
  for (const candidate of candidates) {
    try {
      const metadata = await stat(/* turbopackIgnore: true */ candidate);
      if (metadata.isFile()) {
        files += 1;
        bytes += metadata.size;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return { files, bytes };
}

export async function readMaintenanceStatus(): Promise<MaintenanceStatus> {
  const { stdout } = await runAdminHelper("storage-status");
  const remote = helperStatus.parse(JSON.parse(stdout));
  const localFilesystem = await statfs(path.dirname(config.DATABASE_PATH));
  return {
    cfgBackups: remote.cfgBackups,
    adminBackups: remote.adminBackups,
    filesystems: {
      application: {
        totalBytes: Number(localFilesystem.blocks) * Number(localFilesystem.bsize),
        freeBytes: Number(localFilesystem.bavail) * Number(localFilesystem.bsize),
      },
      cs2: remote.filesystem,
    },
    applicationData: await applicationDataUsage(),
    cfgBackupLimit: config.CFG_BACKUP_LIMIT,
    health: await readHealth(),
  };
}

export async function readHealth(): Promise<HealthResult> {
  const latest = await readLatestMetric();
  const age = latest ? Date.now() - Date.parse(latest.at) : Number.POSITIVE_INFINITY;
  const monitoring = !latest ? "missing" : age > 90_000 ? "stale" : "ok";
  const rcon = !latest ? "unknown" : latest.connected ? "connected" : "disconnected";
  return {
    status: monitoring === "ok" && rcon === "connected" ? "ok" : "degraded",
    at: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    checks: { web: "ok", monitoring, rcon },
  };
}

export async function buildRecoveryExport(): Promise<RecoveryExport> {
  const warnings: string[] = [];
  const summaries = await listManagedCfg();
  const [admins, configs, monitoring, auditResult] = await Promise.all([
    readAdminConfiguration(),
    Promise.all(summaries.map((item) => readManagedCfg(item.id as "server" | "boot" | "common" | "bots"))),
    readMonitoring(24),
    recentAudit({ limit: 500 }),
  ]);
  let bans = null;
  try {
    bans = await readBans();
  } catch (error) {
    warnings.push(`封禁列表未导出：${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    format: "yacsrcon-recovery-v1",
    generatedAt: new Date().toISOString(),
    serverName: config.SERVER_NAME,
    admins,
    configs,
    bans,
    monitoring,
    audit: auditResult,
    warnings,
  };
}

export async function restoreRecoveryExport(value: unknown): Promise<RecoveryResult> {
  const bundle = recoveryBundleSchema.parse(value);
  const beforeAdmins = await readAdminConfiguration();
  const beforeConfigs = await Promise.all(
    bundle.configs.map((item) => readManagedCfg(item.id)),
  );
  const applied: Array<{
    before: (typeof beforeConfigs)[number];
    currentHash: string;
  }> = [];
  let adminsApplied = false;
  try {
    await writeAdminConfiguration(bundle.admins);
    adminsApplied = true;
    for (const target of bundle.configs) {
      const before = beforeConfigs.find((item) => item.id === target.id)!;
      const result = await mutateManagedCfg({
        operation: "write",
        id: target.id,
        content: target.content,
        expectedHash: before.hash,
        confirm: true,
      });
      applied.push({ before, currentHash: result.hash });
    }
  } catch (writeError) {
    const rollbackFailures: string[] = [];
    for (const item of applied.reverse()) {
      try {
        await mutateManagedCfg({
          operation: "write",
          id: item.before.id as "server" | "boot" | "common" | "bots",
          content: item.before.content,
          expectedHash: item.currentHash,
          confirm: true,
        });
      } catch (error) {
        rollbackFailures.push(
          `${item.before.filename}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (adminsApplied) {
      try {
        await writeAdminConfiguration(beforeAdmins);
      } catch (error) {
        rollbackFailures.push(
          `管理员配置: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (rollbackFailures.length) {
      throw new Error(
        `恢复失败且自动回滚不完整：${writeError instanceof Error ? writeError.message : String(writeError)}；${rollbackFailures.join("；")}`,
      );
    }
    throw new Error(
      `恢复失败，已还原原配置：${writeError instanceof Error ? writeError.message : String(writeError)}`,
    );
  }

  let reloadWarning: string | undefined;
  try {
    for (const command of ["css_groups_reload", "css_overrides_reload", "css_admins_reload"]) {
      await rcon.executeInternal(command);
    }
  } catch (error) {
    reloadWarning = error instanceof Error ? error.message : String(error);
  }
  return {
    ok: true,
    adminCount: Object.keys(bundle.admins.admins).length,
    configCount: bundle.configs.length,
    reloadWarning,
  };
}
