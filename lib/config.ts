import { z } from "zod";

const envSchema = z.object({
  RCON_HOST: z.string().default("127.0.0.1"),
  RCON_PORT: z.coerce.number().int().positive().default(27015),
  RCON_PASSWORD: z.string().min(1),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().min(8),
  AUTH_SECRET: z.string().min(16),
  SERVER_NAME: z.string().default("CS2 Modded Server"),
  DATABASE_PATH: z.string().default("./data/yacsrcon.db"),
  ADMIN_HELPER_PATH: z
    .string()
    .default("/usr/local/sbin/yacsrcon-admin-helper"),
});

export const config = envSchema.parse({
  RCON_HOST: process.env.RCON_HOST,
  RCON_PORT: process.env.RCON_PORT,
  RCON_PASSWORD: process.env.RCON_PASSWORD,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SERVER_NAME: process.env.SERVER_NAME,
  DATABASE_PATH: process.env.DATABASE_PATH,
  ADMIN_HELPER_PATH: process.env.ADMIN_HELPER_PATH,
});
