import { Ban, Users } from "lucide-react";
import type { DashboardData } from "@/lib/types";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";

export function PlayersView({
  data,
  onCommand,
}: {
  data: DashboardData;
  onCommand: (c: string) => void;
}) {
  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 玩家"
        title="玩家管理"
        copy="查看当前在线玩家，并执行针对玩家的管理操作。"
      />
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="grid grid-cols-[1fr_110px_170px_120px] border-b border-[var(--line)] px-5 py-3 text-[11px] uppercase tracking-wider text-[var(--muted)]">
          <span>玩家</span>
          <span>延迟</span>
          <span>SteamID</span>
          <span>操作</span>
        </div>
        {data.players.length ? (
          data.players.map((p) => (
            <div
              key={p.userid}
              className="grid grid-cols-[1fr_110px_170px_120px] items-center border-b border-[var(--line)] px-5 py-4 text-sm last:border-0"
            >
              <span className="truncate pr-4">{p.name}</span>
              <span className="text-[var(--muted)]">{p.ping} ms</span>
              <span className="mono truncate text-xs text-[var(--muted)]">
                {p.steamId}
              </span>
              <button
                onClick={() => onCommand(`kickid ${p.userid}`)}
                className="flex items-center gap-1 text-xs text-[var(--danger)]"
              >
                <Ban size={14} /> 踢出
              </button>
            </div>
          ))
        ) : (
          <Empty icon={Users} text="当前没有玩家在线" />
        )}
      </div>
    </>
  );
}
