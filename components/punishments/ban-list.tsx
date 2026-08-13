import { Clock3, RefreshCw, ShieldOff } from "lucide-react";
import { Empty } from "@/components/dashboard/view-primitives";
import type { BanRecord } from "@/lib/types";

export function BanList({
  bans,
  loading,
  onRefresh,
  onUnban,
}: {
  bans: BanRecord[];
  loading: boolean;
  onRefresh: () => void;
  onUnban: (steamId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="font-semibold">封禁记录</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">SimpleAdmin 数据库</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          title="刷新封禁记录"
          className="rounded-md p-2 text-[var(--muted)] hover:text-white"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--muted)]">
          正在读取封禁记录...
        </p>
      ) : bans.length ? (
        <div className="divide-y divide-[var(--line)]">
          {bans.map((ban) => (
            <div
              key={ban.steamId}
              className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-center"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">
                  {ban.playerName ?? "离线玩家"}
                </span>
                <span className="mono mt-1 block text-[10px] text-[var(--muted)]">
                  {ban.steamId}
                </span>
              </span>
              <span
                className={`flex items-center gap-1.5 text-xs ${ban.expired ? "text-[var(--warning)]" : "text-[var(--muted)]"}`}
              >
                <Clock3 size={13} /> {formatBanDuration(ban)}
              </span>
              <button
                type="button"
                onClick={() => onUnban(ban.steamId)}
                className="flex h-8 items-center gap-1.5 text-xs text-[var(--danger)]"
              >
                <ShieldOff size={14} /> 解封
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={ShieldOff} text="当前没有封禁记录" />
      )}
    </section>
  );
}

function formatBanDuration(ban: BanRecord) {
  if (ban.minutes === 0) return "永久封禁";
  if (ban.expired) return "已到期待清理";
  if (!ban.expiresAt) return `${ban.minutes} 分钟`;
  return `至 ${new Date(ban.expiresAt).toLocaleString("zh-CN")}`;
}
