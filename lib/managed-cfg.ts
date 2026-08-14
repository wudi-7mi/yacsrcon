import { z } from "zod";
import { runAdminHelper } from "./admin-config.ts";
import { config } from "./config.ts";
import type { ManagedCfgDocument, ManagedCfgSummary } from "./types.ts";

export const cfgIdSchema = z.enum(["server", "boot", "common", "bots"]);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const cfgMutationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("write"),
    id: cfgIdSchema,
    content: z.string().max(128 * 1024),
    expectedHash: hashSchema,
    confirm: z.literal(true),
  }),
  z.object({
    operation: z.literal("restore"),
    id: cfgIdSchema,
    backupId: z.string().regex(/^\d{8}T\d{6}\.\d{6}Z$/),
    expectedHash: hashSchema,
    confirm: z.literal(true),
  }),
]);

async function cfgHelper(value: Record<string, unknown>) {
  const { stdout } = await runAdminHelper(
    "cfg",
    JSON.stringify({ ...value, retention: config.CFG_BACKUP_LIMIT }),
  );
  return JSON.parse(stdout) as unknown;
}

export async function listManagedCfg(): Promise<ManagedCfgSummary[]> {
  return (await cfgHelper({ operation: "list" })) as ManagedCfgSummary[];
}

export async function readManagedCfg(
  id: z.infer<typeof cfgIdSchema>,
): Promise<ManagedCfgDocument> {
  return (await cfgHelper({ operation: "read", id })) as ManagedCfgDocument;
}

export async function mutateManagedCfg(
  value: z.infer<typeof cfgMutationSchema>,
): Promise<ManagedCfgDocument> {
  return (await cfgHelper(value)) as ManagedCfgDocument;
}
