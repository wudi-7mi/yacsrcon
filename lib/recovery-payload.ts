import type { RecoveryExport, RecoveryPayload } from "./types.ts";

export function recoveryPayloadFromExport(value: RecoveryExport): RecoveryPayload {
  return {
    format: value.format,
    admins: value.admins,
    configs: value.configs.map((item) => ({
      id: item.id,
      content: item.content,
    })),
  };
}
