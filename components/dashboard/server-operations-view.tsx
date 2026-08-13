"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CircleStop, Play, RefreshCw, RotateCcw, ServerCog, Terminal } from "lucide-react";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";
import { useApiRequest } from "@/hooks/use-api-request";
import { ApiError } from "@/lib/api-client";
import type { ServerLogResult } from "@/lib/types";

type Operation = "start" | "stop" | "restart";
type LogFilter = "all" | "errors" | "counterstrikesharp" | "metamod";

const FILTERS: Array<[LogFilter, string]> = [
  ["all", "全部日志"],
  ["errors", "错误"],
  ["counterstrikesharp", "CounterStrikeSharp"],
  ["metamod", "Metamod"],
];

export function ServerOperationsView({ onUnauthorized }: { onUnauthorized: () => void }) {
  const request = useApiRequest(onUnauthorized);
  const [data, setData] = useState<ServerLogResult | null>(null);
  const [filter, setFilter] = useState<LogFilter>("all");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Operation | null>(null);
  const [executing, setExecuting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await request<ServerLogResult>(`/api/server?filter=${filter}`, { cache: "no-store" }));
      setError("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [filter, request]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function execute(operation: Operation) {
    setExecuting(true);
    try {
      await request("/api/server", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: operation, confirm: true }),
      });
      const labels = { start: "启动", stop: "停止", restart: "重启" };
      setNotice(`服务器${labels[operation]}操作已完成。`);
      setError("");
      setPending(null);
      await load();
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 401)) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setExecuting(false);
    }
  }

  const status = data?.status;
  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 运维"
        title="服务器进程与日志"
        copy="管理固定部署的 CS2 进程，并查看经过脱敏的服务器日志。"
      />
      {notice && <div className="mb-4 rounded-lg border border-[#3c6521] bg-[#172513] px-4 py-3 text-sm text-[var(--accent)]">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${status?.running ? "bg-[#172513] text-[var(--accent)]" : "bg-[#29161a] text-[var(--danger)]"}`}>
              <ServerCog size={19} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">CS2 专用服务器</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${status?.running ? "border-[#3c6521] text-[var(--accent)]" : "border-[#6a2930] text-[var(--danger)]"}`}>
                  {loading && !status ? "读取中" : status?.running ? "运行中" : "已停止"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
                <span>PID：{status?.pid ?? "--"}</span>
                <span>启动时间：{status?.startedAt ? new Date(status.startedAt).toLocaleString("zh-CN") : "--"}</span>
                <span>运行时长：{formatUptime(status?.uptimeSeconds)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ControlButton icon={Play} label="启动" disabled={Boolean(status?.running)} onClick={() => setPending("start")} />
            <ControlButton icon={RotateCcw} label="重启" warning disabled={!status?.running} onClick={() => setPending("restart")} />
            <ControlButton icon={CircleStop} label="停止" danger disabled={!status?.running} onClick={() => setPending("stop")} />
          </div>
        </div>
      </section>
      <section className="mt-5 overflow-hidden rounded-lg border border-[var(--line)] bg-[#0a0e12]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium"><Terminal size={15} /> 服务器日志</span>
          <div className="flex items-center gap-2">
            <select value={filter} onChange={(event) => setFilter(event.target.value as LogFilter)} className="form-input h-9 w-auto py-1.5">
              {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" onClick={() => void load()} title="刷新服务器日志" className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-white">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        {data?.lines.length ? (
          <pre className="mono h-[480px] overflow-auto whitespace-pre-wrap p-4 text-[11px] leading-5 text-[#b8c6d3]">{data.lines.join("\n")}</pre>
        ) : (
          <Empty icon={Terminal} text={loading ? "正在读取服务器日志..." : "当前筛选没有匹配日志"} />
        )}
      </section>
      {pending && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]"><AlertTriangle size={18} /></span>
              <div>
                <h2 className="font-semibold">确认{pending === "start" ? "启动" : pending === "stop" ? "停止" : "重启"}服务器？</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{pending === "start" ? "将启动固定部署目录中的 CS2 服务器。" : "在线玩家会立即断开连接，未完成的对局状态可能丢失。"}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={executing} onClick={() => setPending(null)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">取消</button>
              <button type="button" disabled={executing} onClick={() => void execute(pending)} className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08] disabled:opacity-50">{executing ? "正在执行..." : "确认操作"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ControlButton({ icon: Icon, label, onClick, disabled, danger, warning }: { icon: typeof Play; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; warning?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-35 ${danger ? "border-[#6a2930] text-[var(--danger)]" : warning ? "border-[#72551f] text-[var(--warning)]" : "border-[var(--line)] text-[var(--muted)] hover:text-white"}`}><Icon size={14} /> {label}</button>;
}

function formatUptime(seconds: number | null | undefined) {
  if (seconds == null) return "--";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days} 天` : "", hours ? `${hours} 小时` : "", `${minutes} 分钟`].filter(Boolean).join(" ");
}
