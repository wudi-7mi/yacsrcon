"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Ban,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Gamepad2,
  LogOut,
  Map,
  Menu,
  Play,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldCheck,
  Terminal,
  Users,
  X,
} from "lucide-react";
import type { DashboardData, ServerCatalog } from "@/lib/types";
import { QUICK_COMMANDS } from "@/lib/parse";
import AdminManager from "@/components/admin-manager";

const initial: DashboardData = {
  connected: false,
  latencyMs: null,
  status: null,
  players: [],
  plugins: [],
  meta: "",
};
type Tab = "overview" | "players" | "maps" | "admins" | "console";

export default function Dashboard({ catalog }: { catalog: ServerCatalog }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("overview");
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("$ 已连接到 RCON\n");
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [confirm, setConfirm] = useState<{ command: string } | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard", {
        cache: "no-store",
        signal,
      });
      if (response.ok) setData(await response.json());
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setData((current) => ({
          ...current,
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      controller = new AbortController();
      await refresh(controller.signal);
      if (!stopped) timer = setTimeout(poll, 15000);
    };
    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);
  async function sendCommand(value = command, confirmed = false) {
    const cmd = value.trim();
    if (!cmd) return;
    setCommand("");
    const response = await fetch("/api/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: cmd, confirm: confirmed }),
    });
    const body = await response.json();
    if (body.requiresConfirmation) {
      setConfirm({ command: cmd });
      return;
    }
    setOutput(
      (old) => `${old}\n$ ${cmd}\n${body.response ?? body.error ?? ""}`,
    );
    refresh();
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
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              router.push("/login");
            }}
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
                  setTab(id);
                  setMobileNav(false);
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
          {tab === "overview" && <Overview data={data} setTab={setTab} />}{" "}
          {tab === "players" && <Players data={data} onCommand={sendCommand} />}{" "}
          {tab === "maps" && (
            <Maps
              catalog={catalog}
              currentMap={data.status?.map ?? null}
              onCommand={sendCommand}
            />
          )}{" "}
          {tab === "admins" && <AdminManager players={data.players} />}{" "}
          {tab === "console" && (
            <Console
              command={command}
              setCommand={setCommand}
              output={output}
              onCommand={sendCommand}
            />
          )}
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">快捷命令</h2>
              <button
                onClick={() => setTab("console")}
                className="text-xs text-[var(--muted)] hover:text-white"
              >
                打开控制台 <ChevronRight size={13} className="inline" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {QUICK_COMMANDS.map((item) => (
                <button
                  key={item.command}
                  onClick={() => sendCommand(item.command)}
                  className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
      {confirm && (
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
              {confirm.command}
            </code>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const cmd = confirm.command;
                  setConfirm(null);
                  sendCommand(cmd, true);
                }}
                className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08]"
              >
                执行命令
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
function Overview({
  data,
  setTab,
}: {
  data: DashboardData;
  setTab: (t: Tab) => void;
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
              onClick={() => setTab("players")}
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
function Empty({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="grid place-items-center gap-2 py-12 text-center text-sm text-[var(--muted)]">
      <Icon size={22} />
      {text}
    </div>
  );
}
function Players({
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
function Maps({
  catalog,
  currentMap,
  onCommand,
}: {
  catalog: ServerCatalog;
  currentMap: string | null;
  onCommand: (c: string) => void;
}) {
  const [selectedModeId, setSelectedModeId] = useState(
    catalog.modes[0]?.id ?? "",
  );
  const [modeQuery, setModeQuery] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const selectedMode =
    catalog.modes.find((mode) => mode.id === selectedModeId) ??
    catalog.modes[0];
  const visibleModes = useMemo(() => {
    const query = modeQuery.trim().toLowerCase();
    if (!query) return catalog.modes;
    return catalog.modes.filter((mode) =>
      [mode.name, mode.displayNameZh, mode.config].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [catalog.modes, modeQuery]);
  const visibleMaps = useMemo(() => {
    const query = mapQuery.trim().toLowerCase();
    if (!selectedMode) return [];
    if (!query) return selectedMode.maps;
    return selectedMode.maps.filter((map) =>
      [map.name, map.workshopId ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [mapQuery, selectedMode]);

  if (!selectedMode) {
    return <Empty icon={Map} text="服务器目录中没有可用模式" />;
  }

  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 地图与模式"
        title="地图与模式"
        copy="从 GameModeManager 的实际配置中选择模式和地图。"
      />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">游戏模式</h2>
              <span className="text-xs text-[var(--muted)]">
                {catalog.modes.length} 个
              </span>
            </div>
            <label className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-[var(--muted)] focus-within:border-[var(--accent)]">
              <Search size={14} />
              <input
                value={modeQuery}
                onChange={(event) => setModeQuery(event.target.value)}
                placeholder="搜索模式或 CFG"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-2">
            {visibleModes.length ? (
              visibleModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setSelectedModeId(mode.id);
                    setMapQuery("");
                  }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left last:mb-0 ${selectedMode.id === mode.id ? "bg-[var(--panel-soft)] text-white" : "text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-white"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {mode.displayNameZh}
                    </span>
                    <span className="mono mt-0.5 block truncate text-[10px] text-[var(--muted)]">
                      {mode.name} · {mode.config}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className={
                      selectedMode.id === mode.id
                        ? "text-[var(--accent)]"
                        : "text-[var(--muted)]"
                    }
                  />
                </button>
              ))
            ) : (
              <p className="px-3 py-8 text-center text-xs text-[var(--muted)]">
                没有匹配的模式
              </p>
            )}
          </div>
        </section>
        <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">
                  {selectedMode.displayNameZh}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {selectedMode.name} · {selectedMode.config}
                </p>
              </div>
              <button
                onClick={() => onCommand(`exec ${selectedMode.config}`)}
                className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[#15200d]"
              >
                <Play size={14} /> 载入此模式
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
              <span>
                默认地图：
                <strong className="mono font-normal text-white">
                  {selectedMode.defaultMap ?? "由服务器决定"}
                </strong>
              </span>
              <span>
                地图组：
                <strong className="mono font-normal text-white">
                  {selectedMode.mapGroups.join(", ") || "无"}
                </strong>
              </span>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">可用地图</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  当前模式共 {selectedMode.maps.length} 张
                </p>
              </div>
              <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-[var(--muted)] focus-within:border-[var(--accent)] sm:w-56">
                <Search size={14} />
                <input
                  value={mapQuery}
                  onChange={(event) => setMapQuery(event.target.value)}
                  placeholder="搜索地图或 Workshop ID"
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[var(--muted)]"
                />
              </label>
            </div>
            {visibleMaps.length ? (
              <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {visibleMaps.map((map) => {
                  const isCurrent = currentMap === map.name;
                  return (
                    <button
                      key={map.workshopId ?? map.name}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onCommand(map.command)}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${isCurrent ? "border-[var(--accent)] bg-[#172513] text-white" : "border-[var(--line)] bg-[#11171d] hover:border-[var(--accent)]"}`}
                    >
                      <span className="min-w-0">
                        <span className="mono block truncate text-xs">
                          {map.name}
                        </span>
                        {map.workshopId && (
                          <span className="mt-1 block text-[10px] text-[var(--muted)]">
                            Workshop · {map.workshopId}
                          </span>
                        )}
                      </span>
                      {isCurrent ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--accent)]">
                          <Check size={13} /> 当前
                        </span>
                      ) : (
                        <ChevronRight
                          size={14}
                          className="shrink-0 text-[var(--muted)]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--line)] py-12 text-center text-xs text-[var(--muted)]">
                {selectedMode.maps.length
                  ? "没有匹配的地图"
                  : "此模式的地图组中没有地图"}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function Console({
  command,
  setCommand,
  output,
  onCommand,
}: {
  command: string;
  setCommand: (v: string) => void;
  output: string;
  onCommand: (c: string) => void;
}) {
  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 控制台"
        title="RCON 控制台"
        copy="直接向服务器发送命令，并查看原始响应。"
      />
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#0a0e12]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Terminal size={15} /> 实时会话
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(output)}
            className="text-[var(--muted)] hover:text-white"
            title="复制输出"
          >
            <Copy size={15} />
          </button>
        </div>
        <pre className="mono h-[430px] overflow-auto whitespace-pre-wrap p-5 text-xs leading-6 text-[#b8c6d3]">
          {output}
        </pre>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCommand(command);
          }}
          className="flex gap-2 border-t border-[var(--line)] p-3"
        >
          <span className="mono self-center text-sm text-[var(--accent)]">
            $
          </span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="status"
            className="mono min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#46525e]"
          />
          <button
            className="grid size-9 place-items-center rounded-lg bg-[var(--accent)] text-[#15200d]"
            title="执行命令"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
}
function PageTitle({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-[var(--muted)]">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{copy}</p>
    </div>
  );
}
