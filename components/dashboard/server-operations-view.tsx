"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Archive, CircleStop, Database, Download, HardDrive, Play, RefreshCw, RotateCcw, ServerCog, Terminal, Upload } from "lucide-react";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";
import { useApiRequest } from "@/hooks/use-api-request";
import { ApiError } from "@/lib/api-client";
import type { MaintenanceStatus, RecoveryExport, RecoveryResult, ServerLogResult } from "@/lib/types";

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
  const [maintenance, setMaintenance] = useState<MaintenanceStatus | null>(null);
  const [filter, setFilter] = useState<LogFilter>("all");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Operation | null>(null);
  const [executing, setExecuting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState<RecoveryExport | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [server, maintenanceStatus] = await Promise.all([
        request<ServerLogResult>(`/api/server?filter=${filter}`, { cache: "no-store" }),
        request<MaintenanceStatus>("/api/maintenance", { cache: "no-store" }),
      ]);
      setData(server);
      setMaintenance(maintenanceStatus);
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

  async function exportRecovery() {
    setExporting(true);
    try {
      const value = await request<RecoveryExport>("/api/maintenance/export", { cache: "no-store" });
      const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `yacsrcon-recovery-${value.generatedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(value.warnings.length ? `恢复包已导出，包含 ${value.warnings.length} 条警告。` : "恢复包已导出。");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExporting(false);
    }
  }

  async function selectRecovery(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("恢复包超过 2 MiB 限制。");
      return;
    }
    try {
      const value = JSON.parse(await file.text()) as RecoveryExport;
      if (value.format !== "yacsrcon-recovery-v1" || value.configs?.length !== 4 || !value.admins) {
        throw new Error("恢复包格式不受支持。");
      }
      setPendingRecovery(value);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "恢复包不是有效的 JSON。");
    }
  }

  async function restoreRecovery() {
    if (!pendingRecovery) return;
    setRestoring(true);
    try {
      const result = await request<RecoveryResult>("/api/maintenance/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "restore", confirm: true, bundle: pendingRecovery }),
      });
      setNotice(result.reloadWarning ? `配置已恢复，但热重载失败：${result.reloadWarning}` : "管理员与 CFG 配置已从恢复包应用。");
      setError("");
      setPendingRecovery(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRestoring(false);
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
      {maintenance && <section className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><HardDrive size={16} /> 存储与恢复</h2><p className="mt-1 text-xs text-[var(--muted)]">健康检查：{maintenance.health.status === "ok" ? "正常" : "异常"} · CFG 每项保留 {maintenance.cfgBackupLimit} 个版本</p></div><div className="flex gap-2"><label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)]"><Upload size={14} />应用恢复包<input type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void selectRecovery(event.target.files?.[0]); event.target.value = ""; }} /></label><button type="button" disabled={exporting} onClick={() => void exportRecovery()} className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)] disabled:opacity-40"><Download size={14} />{exporting ? "正在导出..." : "导出恢复包"}</button></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><StorageMetric icon={Database} label="应用数据" usage={maintenance.applicationData} /><StorageMetric icon={Archive} label="CFG 备份" usage={maintenance.cfgBackups} /><StorageMetric icon={Archive} label="管理员备份" usage={maintenance.adminBackups} /><DiskMetric label="应用磁盘可用" value={maintenance.filesystems.application} /><DiskMetric label="CS2 磁盘可用" value={maintenance.filesystems.cs2} /></div>
      </section>}
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
      {pendingRecovery && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]"><AlertTriangle size={18} /></span><div><h2 className="font-semibold">确认应用恢复包？</h2><p className="mt-1 text-sm text-[var(--muted)]">将覆盖 {Object.keys(pendingRecovery.admins.admins).length} 位管理员和 {pendingRecovery.configs.length} 个 CFG。当前配置会先自动备份。</p><p className="mt-2 text-xs text-[var(--muted)]">快照时间：{new Date(pendingRecovery.generatedAt).toLocaleString("zh-CN")}</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={restoring} onClick={() => setPendingRecovery(null)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">取消</button><button type="button" disabled={restoring} onClick={() => void restoreRecovery()} className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08] disabled:opacity-50">{restoring ? "正在恢复..." : "确认覆盖配置"}</button></div></div></div>
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function StorageMetric({ icon: Icon, label, usage }: { icon: typeof Database; label: string; usage: { files: number; bytes: number } }) {
  return <div className="rounded-lg border border-[var(--line)] bg-[#11171d] p-3"><div className="flex items-center justify-between text-xs text-[var(--muted)]"><span>{label}</span><Icon size={14} /></div><p className="mt-2 text-lg font-semibold">{formatBytes(usage.bytes)}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{usage.files} 个文件</p></div>;
}

function DiskMetric({ label, value }: { label: string; value: { totalBytes: number; freeBytes: number } }) {
  return <div className="rounded-lg border border-[var(--line)] bg-[#11171d] p-3"><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-2 text-lg font-semibold">{formatBytes(value.freeBytes)}</p><p className="mt-1 text-[10px] text-[var(--muted)]">共 {formatBytes(value.totalBytes)}</p></div>;
}
