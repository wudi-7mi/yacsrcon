import type { Player, PluginInfo, ServerStatus } from "./types";

export function parseStatus(raw: string): ServerStatus {
  const hostname =
    raw.match(/hostname\s*:\s*(.+)/i)?.[1]?.trim() ?? "CS2 Server";
  const address = raw.match(/udp\/ip\s*:\s*([^\s]+)/i)?.[1] ?? "unknown";
  const map =
    raw.match(/map\s*:\s*([^\s]+)/i)?.[1] ??
    raw.match(
      /loaded spawngroup\(\s*1\s*\)\s*:\s*SV:\s*\[\s*1:\s*([^\s|\]]+)/i,
    )?.[1] ??
    "unknown";
  const playerLine = raw.match(
    /players\s*:\s*(\d+)\s+humans?,?\s*(\d+)\s+bots?/i,
  );
  const summary = raw.match(/players\s*:\s*(\d+)\s+\((\d+)\s+max\)/i);
  const maxPlayers = raw.match(/\((\d+)\s+max\)/i);
  return {
    hostname,
    address,
    map,
    players: Number(playerLine?.[1] ?? summary?.[1] ?? 0),
    maxPlayers: Number(summary?.[2] ?? maxPlayers?.[1] ?? 0),
    bots: Number(playerLine?.[2] ?? 0),
    version: raw.match(/version\s*:\s*(.+)/i)?.[1]?.trim(),
    raw,
  };
}

export function parsePlayers(raw: string): Player[] {
  const players: Player[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(
      /^#\s*(\d+)\s+(?:\d+\s+)?("[^"]+"|\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\S+)(?:\s+\S+)?\s+(\S+)\s*$/,
    );
    if (match)
      players.push({
        userid: match[1],
        name: match[2].replace(/^"|"$/g, ""),
        steamId: match[3],
        time: match[4],
        ping: Number(match[5]),
        loss: Number(match[6]),
        state: match[7],
        address: match[8],
      });
  }
  return players;
}

export function parsePlugins(raw: string): PluginInfo[] {
  return raw.split(/\r?\n/).flatMap((line) => {
    const cssMatch = line.match(
      /^\s*\[#\d+:([^\]]+)\]:\s+"([^"]+)"\s+\(([^)]+)\)/,
    );
    if (cssMatch) {
      return [
        {
          name: cssMatch[2],
          version: cssMatch[3],
          state: cssMatch[1],
        },
      ];
    }

    const legacyMatch = line.match(
      /^\s*(?:\[?\s*\d+\s*\]?)\s+(.+?)(?:\s+\|\s+(.+))?$/,
    );
    if (!legacyMatch) return [];
    const version = legacyMatch[1].match(/\bv?(\d+(?:\.\d+)+)\b/)?.[1];
    return [
      {
        name: legacyMatch[1].replace(/\bv?\d+(?:\.\d+)+\b/, "").trim(),
        version,
        state: legacyMatch[2]?.trim(),
      },
    ];
  });
}

export const QUICK_COMMANDS = [
  { label: "重启回合", command: "mp_restartgame 1", tone: "amber" },
  { label: "暂停比赛", command: "mp_pause_match", tone: "slate" },
  { label: "继续比赛", command: "mp_unpause_match", tone: "slate" },
  { label: "添加 CT BOT", command: "bot_add_ct", tone: "green" },
  { label: "添加 T BOT", command: "bot_add_t", tone: "green" },
  { label: "移除所有 BOT", command: "bot_kick", tone: "red" },
] as const;

export const HIGH_RISK_COMMANDS =
  /^(quit|exit|changelevel|host_workshop_map|map|exec|banid|banip|kick|mp_restartgame|mp_pause_match|sv_password)\b/i;
