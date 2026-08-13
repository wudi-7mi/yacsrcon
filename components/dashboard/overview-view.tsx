import { Activity, Check, ChevronRight, Gamepad2, Map, Users, X } from "lucide-react";
import type { DashboardData } from "@/lib/types";
import { Empty } from "@/components/dashboard/view-primitives";
import type { DashboardTab } from "@/components/dashboard/types";

export function OverviewView({
  data,
  setDashboardTab,
}: {
  data: DashboardData;
  setDashboardTab: (t: DashboardTab) => void;
}) {
  const s = data.status;
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-[var(--muted)]">
            服务器管理 / 概览
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            服务器运行概览
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            查看实时运行状态，并在当前页面完成常用管理操作。
          </p>
        </div>
        <div
          className={`rounded-full border px-3 py-1.5 text-xs ${data.connected ? "border-[#3c6521] bg-[#172513] text-[var(--accent)]" : "border-[#6a2930] bg-[#29161a] text-[var(--danger)]"}`}
        >
          {data.connected ? "运行正常" : "连接不可用"}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="在线玩家"
          value={`${s?.players ?? 0}/${s?.maxPlayers ?? 0}`}
          icon={Users}
          accent
        />
        <Stat label="当前地图" value={s?.map ?? "--"} icon={Map} />
        <Stat label="游戏模式" value="动态模式" icon={Gamepad2} />
        <Stat
          label="RCON 延迟"
          value={data.latencyMs ? `${data.latencyMs}ms` : "--"}
          icon={Activity}
        />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <div>
              <h2 className="font-semibold">在线玩家</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                数据来自实时 status 响应
              </p>
            </div>
            <button
              onClick={() => setDashboardTab("players")}
              className="text-xs text-[var(--accent)]"
            >
              查看全部 <ChevronRight size={13} className="inline" />
            </button>
          </div>
          {data.players.length ? (
            <div className="divide-y divide-[var(--line)]">
              {data.players.slice(0, 5).map((player) => (
                <div
                  key={player.userid}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="max-w-[220px] truncate text-sm">
                      {player.name}
                    </p>
                    <p className="mono mt-1 text-[10px] text-[var(--muted)]">
                      {player.steamId}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {player.ping} ms
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={Users} text="当前没有玩家在线" />
          )}
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2 className="font-semibold">运行检查</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              通过 RCON 检测服务器运行组件
            </p>
          </div>
          <div className="space-y-4 p-5">
            <CheckLine label="RCON 认证" ok={data.connected} />
            <CheckLine
              label="CounterStrikeSharp"
              ok={/counterstrikesharp/i.test(data.meta)}
            />
            <CheckLine
              label="MatchZy"
              ok={data.plugins.some((p) => /matchzy/i.test(p.name))}
            />
            <CheckLine label="Metamod:Source" ok={/metamod/i.test(data.meta)} />
          </div>
        </section>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <Icon size={16} className="text-[var(--muted)]" />
      </div>
      <p
        className={`truncate text-2xl font-semibold ${accent ? "text-[var(--accent)]" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
function CheckLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      {ok ? (
        <Check size={17} className="text-[var(--accent)]" />
      ) : (
        <X size={17} className="text-[var(--danger)]" />
      )}
    </div>
  );
}
