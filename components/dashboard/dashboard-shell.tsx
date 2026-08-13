"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Clock3,
  LogOut,
  Map,
  Menu,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import AdminManager from "@/components/admin-manager";
import {
  ConsoleView,
  MapsView,
  OverviewView,
  PlayersView,
} from "@/components/dashboard/views";
import type { DashboardTab } from "@/components/dashboard/types";
import { useDashboardPolling } from "@/hooks/use-dashboard-polling";
import { useRconConsole } from "@/hooks/use-rcon-console";
import { useApiRequest } from "@/hooks/use-api-request";
import { QUICK_COMMANDS } from "@/lib/parse";
import type { ServerCatalog } from "@/lib/types";

export default function Dashboard({ catalog }: { catalog: ServerCatalog }) {
  const router = useRouter();
  const request = useApiRequest();
  const { data, loading, refresh } = useDashboardPolling();
  const refreshAfterCommand = useCallback(() => refresh(), [refresh]);
  const consoleSession = useRconConsole(refreshAfterCommand);
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [adminDirty, setAdminDirty] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<
    DashboardTab | "logout" | null
  >(null);

  function selectTab(next: DashboardTab) {
    if (tab === "admins" && adminDirty && next !== "admins") {
      setPendingDestination(next);
      return;
    }
    setTab(next);
    setMobileNav(false);
  }

  async function logout() {
    try {
      await request<{ ok: true }>("/api/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  }

  function requestLogout() {
    if (tab === "admins" && adminDirty) {
      setPendingDestination("logout");
      return;
    }
    void logout();
  }
  const nav = [
    { id: "overview", label: "服务器概览", icon: Activity },
    { id: "players", label: "玩家管理", icon: Users },
    { id: "maps", label: "地图与模式", icon: Map },
    { id: "admins", label: "管理员与权限", icon: ShieldCheck },
    { id: "console", label: "RCON 控制台", icon: Terminal },
  ] as const;
  return (
    <div className="min-h-screen bg-[#0e1318]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[#11171d]/95 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNav(!mobileNav)}
            className="rounded-md p-2 text-[var(--muted)] md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="grid size-8 place-items-center rounded-lg bg-[var(--accent)] text-[#15200d]">
            <RadioIcon />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--accent)]">
              YACSRCON
            </p>
            <p className="text-sm font-medium">
              {data.status?.hostname ?? "CS2 Modded Server"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`hidden items-center gap-2 text-xs sm:flex ${data.connected ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}
          >
            <span
              className={`size-2 rounded-full ${data.connected ? "bg-[var(--accent)]" : "bg-[var(--danger)]"}`}
            />
            {data.connected ? "RCON 已连接" : "连接已断开"}
          </span>
          <button
            onClick={() => void refresh()}
            className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-white"
            title="刷新"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={requestLogout}
            className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-white"
            title="退出登录"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px]">
        <aside
          className={`${mobileNav ? "block" : "hidden"} fixed inset-x-0 top-16 z-10 border-b border-[var(--line)] bg-[var(--panel)] p-3 md:static md:block md:w-64 md:shrink-0 md:border-0 md:bg-transparent md:p-6`}
        >
          <nav className="space-y-1">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  selectTab(id);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${tab === id ? "bg-[var(--panel-soft)] text-white" : "text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-white"}`}
              >
                <Icon size={17} />
                {label}
                {tab === id && (
                  <ChevronRight
                    size={15}
                    className="ml-auto text-[var(--accent)]"
                  />
                )}
              </button>
            ))}
          </nav>
          <div className="mt-8 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]">
            <p className="mb-2 flex items-center gap-2">
              <Server size={14} /> {data.status?.address ?? "127.0.0.1:27015"}
            </p>
            <p className="flex items-center gap-2">
              <Clock3 size={14} />{" "}
              {data.latencyMs ? `${data.latencyMs}ms 响应` : "等待服务器响应"}
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {tab === "overview" && (
            <OverviewView data={data} setDashboardTab={selectTab} />
          )}{" "}
          {tab === "players" && (
            <PlayersView data={data} onCommand={consoleSession.sendCommand} />
          )}{" "}
          {tab === "maps" && (
            <MapsView
              catalog={catalog}
              currentMap={data.status?.map ?? null}
              onCommand={consoleSession.sendCommand}
            />
          )}{" "}
          {tab === "admins" && (
            <AdminManager
              players={data.players}
              onDirtyChange={setAdminDirty}
            />
          )}{" "}
          {tab === "console" && (
            <ConsoleView
              command={consoleSession.command}
              setCommand={consoleSession.setCommand}
              output={consoleSession.output}
              onCommand={consoleSession.sendCommand}
            />
          )}
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">快捷命令</h2>
              <button
                onClick={() => selectTab("console")}
                className="text-xs text-[var(--muted)] hover:text-white"
              >
                打开控制台 <ChevronRight size={13} className="inline" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {QUICK_COMMANDS.map((item) => (
                <button
                  key={item.command}
                  onClick={() => void consoleSession.sendCommand(item.command)}
                  className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
      {consoleSession.confirmCommand && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-semibold">确认执行高风险命令</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  此命令可能中断玩家连接或改变服务器当前运行状态。
                </p>
              </div>
            </div>
            <code className="mono block rounded-lg bg-[#0c1014] p-3 text-sm text-[var(--accent)]">
              {consoleSession.confirmCommand}
            </code>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={consoleSession.cancelConfirmation}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
              >
                取消
              </button>
              <button
                onClick={consoleSession.confirmExecution}
                className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08]"
              >
                执行命令
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingDestination && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2 className="font-semibold">放弃未保存的管理员更改？</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  离开此页面后，当前管理员和权限组草稿将无法恢复。
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDestination(null)}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
              >
                继续编辑
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingDestination === "logout") {
                    setPendingDestination(null);
                    void logout();
                    return;
                  }
                  setTab(pendingDestination);
                  setPendingDestination(null);
                  setMobileNav(false);
                }}
                className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08]"
              >
                放弃并离开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function RadioIcon() {
  return <span className="text-[15px]">◉</span>;
}
