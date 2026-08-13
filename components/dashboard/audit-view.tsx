"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, FileClock, RefreshCw, Search } from "lucide-react";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";
import { useApiRequest } from "@/hooks/use-api-request";
import { ApiError } from "@/lib/api-client";
import type { AuditEntry, AuditResult } from "@/lib/types";

const ACTIONS = [
  ["", "全部事件"],
  ["player_punishment", "玩家处罚"],
  ["admin_configuration_updated", "权限配置"],
  ["server_control", "服务器操作"],
  ["command", "RCON 命令"],
  ["command_error", "RCON 错误"],
] as const;

const ACTION_LABELS: Record<string, string> = {
  player_punishment: "玩家处罚",
  admin_configuration_updated: "权限配置更新",
  server_control: "服务器操作",
  command: "RCON 命令",
  command_error: "RCON 命令失败",
};

export function AuditView({ onUnauthorized }: { onUnauthorized: () => void }) {
  const request = useApiRequest(onUnauthorized);
  const [result, setResult] = useState<AuditResult>({ entries: [], malformed: 0 });
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const search = new URLSearchParams({ limit: "200" });
    if (action) search.set("action", action);
    if (appliedQuery) search.set("query", appliedQuery);
    try {
      setResult(
        await request<AuditResult>(`/api/audit?${search}`, { cache: "no-store" }),
      );
      setError("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [action, appliedQuery, request]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const counts = useMemo(() => {
    const values = new Map<string, number>();
    for (const entry of result.entries) {
      values.set(entry.action, (values.get(entry.action) ?? 0) + 1);
    }
    return values;
  }, [result.entries]);

  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 审计"
        title="操作审计"
        copy="检索玩家处罚、权限变更、服务器控制和 RCON 操作记录。"
      />
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="grid gap-3 border-b border-[var(--line)] p-4 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="form-input h-10"
            aria-label="事件类型"
          >
            {ACTIONS.map(([value, label]) => (
              <option key={value || "all"} value={value}>{label}</option>
            ))}
          </select>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedQuery(query.trim());
            }}
            className="flex h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-[#11171d] px-3 focus-within:border-[var(--accent)]"
          >
            <Search size={15} className="text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 SteamID、玩家名称、命令或操作"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            />
          </form>
          <button
            type="button"
            onClick={() => void load()}
            title="刷新审计日志"
            className="grid size-10 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-white"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
          <span>显示 {result.entries.length} 条</span>
          {action && <span>{ACTION_LABELS[action] ?? action}：{counts.get(action) ?? 0}</span>}
          {result.malformed > 0 && (
            <span className="flex items-center gap-1 text-[var(--warning)]">
              <AlertTriangle size={13} /> 已跳过 {result.malformed} 条损坏记录
            </span>
          )}
        </div>
        {error ? (
          <div className="p-5 text-sm text-[var(--danger)]">{error}</div>
        ) : loading && !result.entries.length ? (
          <div className="py-14 text-center text-sm text-[var(--muted)]">正在读取审计记录...</div>
        ) : result.entries.length ? (
          <div className="divide-y divide-[var(--line)]">
            {result.entries.map((entry, index) => (
              <AuditRow key={`${entry.at}-${entry.action}-${index}`} entry={entry} />
            ))}
          </div>
        ) : (
          <Empty icon={FileClock} text="没有匹配的审计记录" />
        )}
      </section>
    </>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const details = Object.fromEntries(
    Object.entries(entry).filter(([key]) => key !== "at" && key !== "action"),
  );
  return (
    <details className="group px-4 py-3.5">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className={`size-2 shrink-0 rounded-full ${entry.action.includes("error") ? "bg-[var(--danger)]" : entry.action === "server_control" ? "bg-[var(--warning)]" : "bg-[var(--accent)]"}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
          <span className="mt-1 block truncate text-xs text-[var(--muted)]">{auditSummary(entry)}</span>
        </span>
        <time className="hidden shrink-0 text-xs text-[var(--muted)] sm:block">
          {new Date(entry.at).toLocaleString("zh-CN")}
        </time>
        <ChevronDown size={15} className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
      </summary>
      <pre className="mono mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[#0c1014] p-3 text-[11px] leading-5 text-[#b8c6d3]">
        {JSON.stringify(details, null, 2)}
      </pre>
    </details>
  );
}

function auditSummary(entry: AuditEntry) {
  if (entry.action === "player_punishment") {
    const actions: Record<string, string> = { kick: "踢出", slay: "击杀", ban: "封禁", unban: "解封" };
    return `${actions[String(entry.operation)] ?? String(entry.operation)} ${String(entry.playerName ?? entry.steamId ?? "玩家")}`;
  }
  if (entry.action === "server_control") {
    const operations: Record<string, string> = { start: "启动", stop: "停止", restart: "重启" };
    return `${operations[String(entry.operation)] ?? String(entry.operation)}服务器`;
  }
  if (entry.command) return String(entry.command);
  if (entry.backupDirectory) return `备份：${String(entry.backupDirectory)}`;
  return "查看事件详情";
}
