import "server-only";
import { z } from "zod";
import { runAdminHelper } from "./admin-config.ts";
import { rcon } from "./rcon.ts";
import type { CustomVotesDocument } from "./types.ts";

const commandName = z.string().min(1).max(32).regex(/^[a-zA-Z0-9_-]+$/);
const optionSchema = z.object({
  Text: z.string().min(1).max(200),
  Commands: z.array(z.string().trim().min(1).max(500).refine((value) => !/[\r\n\0]/.test(value))).min(1).max(20),
}).strict();
const permissionSchema = z.object({
  RequiresAll: z.boolean(),
  Permissions: z.array(z.string().regex(/^[@#][a-zA-Z0-9_./-]{1,127}$/)).max(50),
}).strict();
const voteSchema = z.object({
  Command: commandName,
  CommandAliases: z.array(commandName).max(20),
  Description: z.string().min(1).max(500),
  TimeToVote: z.number().min(5).max(600),
  Options: z.record(z.string().min(1).max(64), optionSchema).refine((value) => Object.keys(value).length >= 2 && Object.keys(value).length <= 20, "每个投票需要 2 到 20 个选项。"),
  DefaultOption: z.string().min(1).max(64),
  Style: z.enum(["center", "chat"]),
  MinVotePercentage: z.number().int().min(-1).max(100),
  Permission: permissionSchema,
}).strict().refine((vote) => Object.hasOwn(vote.Options, vote.DefaultOption), { message: "默认选项必须存在。", path: ["DefaultOption"] });

export const customVotesConfigSchema = z.object({
  CustomVotesEnabled: z.boolean(),
  VoteCooldown: z.number().min(0).max(86400),
  ChatPrefix: z.string().max(200),
  ForceStyle: z.enum(["none", "center", "chat"]),
  CustomVotes: z.array(voteSchema).max(100),
  ConfigVersion: z.literal(2),
}).strict().superRefine((config, context) => {
  const names = new Set<string>();
  config.CustomVotes.forEach((vote, voteIndex) => {
    [vote.Command, ...vote.CommandAliases].forEach((name, nameIndex) => {
      const normalized = name.toLowerCase();
      if (names.has(normalized)) {
        context.addIssue({ code: "custom", message: `命令 ${name} 重复。`, path: ["CustomVotes", voteIndex, nameIndex ? "CommandAliases" : "Command"] });
      }
      names.add(normalized);
    });
  });
});

export const customVotesMutationSchema = z.object({
  operation: z.literal("write"),
  config: customVotesConfigSchema,
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirm: z.literal(true),
});

async function customVotesHelper(value: Record<string, unknown>) {
  const { stdout } = await runAdminHelper("plugin-config", JSON.stringify({ id: "custom-votes", ...value }));
  return JSON.parse(stdout) as CustomVotesDocument;
}

export async function readCustomVotes() {
  const result = await customVotesHelper({ operation: "read" });
  return { ...result, config: customVotesConfigSchema.parse(result.config) };
}

export async function writeCustomVotes(value: z.infer<typeof customVotesMutationSchema>) {
  const result = await customVotesHelper(value);
  let reloadWarning: string | undefined;
  try {
    const response = await rcon.executeInternal("css_reload_cfg");
    const commandMissing = /unknown command|command[^\r\n]*does not exist/i.test(response);
    const customVotesFailure = response.split(/\r?\n/).some((line) =>
      /custom[ -]?votes/i.test(line) && /not found|error|failed|exception/i.test(line),
    );
    if (commandMissing || customVotesFailure) {
      reloadWarning = response.trim() || "CounterStrikeSharp 拒绝了配置重载命令。";
    }
  } catch (error) {
    reloadWarning = error instanceof Error ? error.message : String(error);
  }
  return { ...result, config: customVotesConfigSchema.parse(result.config), reloadWarning };
}
