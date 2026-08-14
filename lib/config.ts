import path from "node:path";
import { z } from "zod";
import { resolveStoragePaths } from "./storage-paths.ts";

const envSchema = z.object({
  RCON_HOST: z.string().default("127.0.0.1"),
  RCON_PORT: z.coerce.number().int().positive().default(27015),
  RCON_PASSWORD: z.string().min(1),
  RCON_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(4000),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().min(8),
  AUTH_SECRET: z.string().min(16),
  SERVER_NAME: z.string().default("CS2 Modded Server"),
  DATABASE_PATH: z.string().default("./data/yacsrcon.db"),
  SESSION_PATH: z.string().min(1).optional(),
  AUDIT_PATH: z.string().min(1).optional(),
  METRICS_PATH: z.string().min(1).optional(),
  ALERT_STATE_PATH: z.string().min(1).optional(),
  WEBHOOK_URL: z.string().url().refine((value) => /^https?:\/\//.test(value)).optional(),
  WEBHOOK_TOKEN: z.string().max(4096).optional(),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
  ALERT_DISCONNECT_SAMPLES: z.coerce.number().int().min(1).max(20).default(3),
  ALERT_HIGH_LATENCY_MS: z.coerce.number().int().min(50).max(30000).default(500),
  ALERT_HIGH_LATENCY_SAMPLES: z.coerce.number().int().min(1).max(20).default(3),
  ALERT_COOLDOWN_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
  CFG_BACKUP_LIMIT: z.coerce.number().int().min(5).max(200).default(50),
  AUDIT_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(64 * 1024)
    .max(100 * 1024 * 1024)
    .default(5 * 1024 * 1024),
  ADMIN_HELPER_PATH: z
    .string()
    .default("/usr/local/sbin/yacsrcon-admin-helper"),
});

const environment = envSchema.parse({
  RCON_HOST: process.env.RCON_HOST,
  RCON_PORT: process.env.RCON_PORT,
  RCON_PASSWORD: process.env.RCON_PASSWORD,
  RCON_TIMEOUT_MS: process.env.RCON_TIMEOUT_MS,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SERVER_NAME: process.env.SERVER_NAME,
  DATABASE_PATH: process.env.DATABASE_PATH,
  SESSION_PATH: process.env.SESSION_PATH,
  AUDIT_PATH: process.env.AUDIT_PATH,
  METRICS_PATH: process.env.METRICS_PATH,
  ALERT_STATE_PATH: process.env.ALERT_STATE_PATH,
  WEBHOOK_URL: process.env.WEBHOOK_URL || undefined,
  WEBHOOK_TOKEN: process.env.WEBHOOK_TOKEN || undefined,
  WEBHOOK_TIMEOUT_MS: process.env.WEBHOOK_TIMEOUT_MS,
  ALERT_DISCONNECT_SAMPLES: process.env.ALERT_DISCONNECT_SAMPLES,
  ALERT_HIGH_LATENCY_MS: process.env.ALERT_HIGH_LATENCY_MS,
  ALERT_HIGH_LATENCY_SAMPLES: process.env.ALERT_HIGH_LATENCY_SAMPLES,
  ALERT_COOLDOWN_MINUTES: process.env.ALERT_COOLDOWN_MINUTES,
  CFG_BACKUP_LIMIT: process.env.CFG_BACKUP_LIMIT,
  AUDIT_MAX_BYTES: process.env.AUDIT_MAX_BYTES,
  ADMIN_HELPER_PATH: process.env.ADMIN_HELPER_PATH,
});

const storage = resolveStoragePaths(
  environment.DATABASE_PATH,
  environment.SESSION_PATH,
  environment.AUDIT_PATH,
);
const database = path.parse(storage.databasePath);
const metricsPath = path.resolve(
  /* turbopackIgnore: true */
  environment.METRICS_PATH ??
    path.join(database.dir, `${database.name || "yacsrcon"}.metrics.jsonl`),
);
const alertStatePath = path.resolve(
  /* turbopackIgnore: true */
  environment.ALERT_STATE_PATH ??
    path.join(database.dir, `${database.name || "yacsrcon"}.alerts.json`),
);
if (new Set([...Object.values(storage), metricsPath, alertStatePath]).size !== 5) {
  throw new Error("Database, session, audit, metrics, and alert state paths must differ");
}

export const config = {
  ...environment,
  DATABASE_PATH: storage.databasePath,
  SESSION_PATH: storage.sessionPath,
  AUDIT_PATH: storage.auditPath,
  METRICS_PATH: metricsPath,
  ALERT_STATE_PATH: alertStatePath,
};
