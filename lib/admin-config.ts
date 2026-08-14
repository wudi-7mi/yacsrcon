import { spawn } from "node:child_process";
import { z } from "zod";
import { config } from "./config.ts";
import type { AdminConfiguration } from "./types.ts";

const safeName = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[^\x00-\x1f]+$/);
const flag = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^@[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/);
const groupName = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^#[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/);
const immunity = z.number().int().min(0).max(999);

const adminSchema = z
  .object({
    identity: z.string().regex(/^7656119\d{10}$/),
    immunity: immunity.optional(),
    flags: z.array(flag).max(100).optional(),
    groups: z.array(groupName).max(20).optional(),
    command_overrides: z
      .record(z.string().min(1).max(80), z.boolean())
      .optional(),
  })
  .passthrough();

const groupSchema = z
  .object({
    flags: z.array(flag).max(100),
    immunity: immunity.optional(),
  })
  .passthrough();

export const adminConfigurationSchema = z
  .object({
    admins: z.record(safeName, adminSchema),
    groups: z.record(groupName, groupSchema),
    overrides: z.record(z.string(), z.unknown()),
  })
  .superRefine((value, context) => {
    for (const [name, admin] of Object.entries(value.admins)) {
      for (const group of admin.groups ?? []) {
        if (!value.groups[group]) {
          context.addIssue({
            code: "custom",
            path: ["admins", name, "groups"],
            message: `引用了不存在的权限组 ${group}`,
          });
        }
      }
    }
  });

export async function runAdminHelper(
  action:
    | "read"
    | "apply"
    | "bans"
    | "cfg"
    | "server-status"
    | "server-logs"
    | "server-start"
    | "server-stop"
    | "server-restart",
  input?: string,
) {
  return new Promise<{ stdout: string }>((resolve, reject) => {
    const child = spawn("sudo", ["-n", config.ADMIN_HELPER_PATH, action], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeoutMs = action.startsWith("server-") ? 25_000 : 5_000;
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > 1024 * 1024) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout });
      else
        reject(new Error(stderr.trim() || `管理员配置辅助程序退出：${code}`));
    });
    child.stdin.end(input);
  });
}

export async function readAdminConfiguration(): Promise<AdminConfiguration> {
  const { stdout } = await runAdminHelper("read");
  const value = JSON.parse(stdout);
  return adminConfigurationSchema.parse(value) as AdminConfiguration;
}

export async function writeAdminConfiguration(value: unknown) {
  const parsed = adminConfigurationSchema.parse(value);
  const { stdout } = await runAdminHelper("apply", JSON.stringify(parsed));
  return JSON.parse(stdout) as { backupDirectory: string };
}
