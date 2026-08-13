import type { Player } from "@/lib/types";

export type PlayerAction = "kick" | "slay" | "ban" | "unban";

export type ActionTarget = {
  action: PlayerAction;
  player?: Player;
  steamId?: string;
};
