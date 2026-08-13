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
  ADMIN_HELPER_PATH: process.env.ADMIN_HELPER_PATH,
});

const storage = resolveStoragePaths(
  environment.DATABASE_PATH,
  environment.SESSION_PATH,
  environment.AUDIT_PATH,
);

export const config = {
  ...environment,
  DATABASE_PATH: storage.databasePath,
  SESSION_PATH: storage.sessionPath,
  AUDIT_PATH: storage.auditPath,
};
