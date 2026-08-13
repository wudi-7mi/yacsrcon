import { z } from "zod";
import { runAdminHelper } from "./admin-config.ts";
import type { ServerLogResult, ServerProcessStatus } from "./types.ts";

const processStatus = z.object({
  running: z.boolean(),
  pid: z.number().int().positive().nullable(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  uptimeSeconds: z.number().int().nonnegative().nullable(),
  management: z.literal("fixed-script"),
});

const logResult = z.object({
  status: processStatus,
  lines: z.array(z.string()).max(500),
});

export const serverActionSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
  confirm: z.literal(true),
});

export const serverLogFilterSchema = z.enum([
  "all",
  "errors",
  "counterstrikesharp",
  "metamod",
]);

export type ServerAction = z.infer<typeof serverActionSchema>["action"];
export type ServerLogFilter = z.infer<typeof serverLogFilterSchema>;

export function filterServerLogs(lines: string[], filter: ServerLogFilter) {
  if (filter === "all") return lines;
  const pattern =
    filter === "errors"
      ? /error|exception|fatal|failed|unable|couldn't|crash/i
      : filter === "counterstrikesharp"
        ? /counterstrikesharp|\[css\]|simpleadmin|plugin/i
        : /metamod|meta\s+(?:list|version)|sourcehook/i;
  return lines.filter((line) => pattern.test(line));
}

export async function readServerStatus(): Promise<ServerProcessStatus> {
  const { stdout } = await runAdminHelper("server-status");
  return processStatus.parse(JSON.parse(stdout));
}

export async function readServerLogs(
  filter: ServerLogFilter = "all",
): Promise<ServerLogResult> {
  const { stdout } = await runAdminHelper("server-logs");
  const result = logResult.parse(JSON.parse(stdout));
  return { ...result, lines: filterServerLogs(result.lines, filter) };
}

export async function controlServer(
  action: ServerAction,
): Promise<ServerProcessStatus> {
  const { stdout } = await runAdminHelper(`server-${action}`);
  return processStatus.parse(JSON.parse(stdout));
}
