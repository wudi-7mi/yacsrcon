"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock3, Flame, Play, RefreshCw, Settings2, Vote } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api-request";
import { GAME_SETTINGS } from "@/lib/game-settings";
import type { GameModeManagerStatus, PluginActionResult } from "@/lib/types";

type PendingAction = { label: string; payload: Record<string, unknown> };

export function GameModeManager({ onBack, onUnauthorized }: { onBack: () => void; onUnauthorized: () => void }) {
  const request = useApiRequest(onUnauthorized);
  const [status, setStatus] = useState<GameModeManagerStatus | null>(null);
  const [duration, setDuration] = useState(60);
  const [maxExtends, setMaxExtends] = useState(0);
  const [timeLimit, setTimeLimit] = useState(600);
  const [includeModes, setIncludeModes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const value = await request<GameModeManagerStatus>("/api/plugins/game-mode", { cache: "no-store" });
      setStatus(value);
      setDuration(value.rtv.duration);
      setMaxExtends(value.rtv.maxExtends);
      setIncludeModes(value.rtv.includeModes);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  async function execute() {
    if (!pending) return;
    setRunning(true);
    try {
      const result = await request<PluginActionResult>("/api/plugins/game-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...pending.payload, confirm: true }),
      });
      setNotice(result.response.trim() || `${pending.label}已执行。`);
      setError("");
      setPending(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPending(null);
    } finally {
      setRunning(false);
    }
  }

  const availableSettings = useMemo(() => new Set(status?.settings ?? []), [status?.settings]);
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-xs text-[var(--muted)] hover:text-white"><ArrowLeft size={14} />返回插件中心</button><h1 className="text-2xl font-semibold">模式与 RTV</h1><p className="mt-2 text-sm text-[var(--muted)]">控制 GameModeManager 的即时投票、暖场和配对设置。</p></div><button type="button" onClick={() => void load()} title="刷新插件配置" className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-white"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button></div>
    {notice && <div className="mb-4 rounded-lg border border-[#3c6521] bg-[#172513] px-4 py-3 text-sm text-[var(--accent)]">{notice}</div>}
    {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
    <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Vote size={16} className="text-[var(--accent)]" />Rock The Vote</h2><p className="mt-1 text-xs text-[var(--muted)]">配置文件默认值，操作会立即作用于当前服务器进程。</p></div><StateBadge enabled={status?.rtv.enabled} /></div>
        <div className="grid gap-4 sm:grid-cols-3"><NumberField label="投票时长（秒）" value={duration} min={5} max={600} onChange={setDuration} action={() => setPending({ label: "更新 RTV 时长", payload: { action: "rtv-duration", duration } })} /><NumberField label="最大延长次数" value={maxExtends} min={0} max={20} onChange={setMaxExtends} action={() => setPending({ label: "更新最大延长次数", payload: { action: "rtv-max-extends", maxExtends } })} /><div className="flex flex-col justify-end gap-2"><ActionButton label={status?.rtv.enabled ? "停用 RTV" : "启用 RTV"} onClick={() => setPending({ label: status?.rtv.enabled ? "停用 RTV" : "启用 RTV", payload: { action: "rtv-enabled", enabled: !status?.rtv.enabled } })} /><ActionButton label={status?.rtv.endOfMapVote ? "关闭地图结束投票" : "开启地图结束投票"} onClick={() => setPending({ label: "切换地图结束投票", payload: { action: "rtv-end-vote", enabled: !status?.rtv.endOfMapVote } })} /></div></div>
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-4"><label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)]"><input type="checkbox" checked={includeModes} onChange={(event) => setIncludeModes(event.target.checked)} className="accent-[var(--accent)]" />同时投票选择模式</label><button type="button" onClick={() => setPending({ label: "立即开始 RTV 投票", payload: { action: "rtv-start", duration, includeModes } })} className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[#15200d]"><Play size={14} />立即开始投票</button></div>
      </section>
      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Flame size={16} className="text-[var(--warning)]" />暖场与时间限制</h2><p className="mt-1 text-xs text-[var(--muted)]">暖场命令只在插件配置启用后注册。</p></div><StateBadge enabled={status?.warmup.enabled} /></div>
        {!status?.warmup.enabled && <div className="mb-4 rounded-lg border border-[#72551f] bg-[#2a2113] px-3 py-2 text-xs text-[var(--warning)]">当前 GameModeManager 配置未启用暖场，启动和结束命令会被服务器拒绝。</div>}
        <div className="grid grid-cols-2 gap-2"><ActionButton label="开始暖场" onClick={() => setPending({ label: "开始暖场", payload: { action: "warmup-start" } })} /><ActionButton label="结束暖场" onClick={() => setPending({ label: "结束暖场", payload: { action: "warmup-end" } })} /></div>
        <div className="mt-4 border-t border-[var(--line)] pt-4"><NumberField label="强制轮换时间（秒）" value={timeLimit} min={0} max={86400} onChange={setTimeLimit} action={() => setPending({ label: "启用时间限制", payload: { action: "timelimit", enabled: true, seconds: timeLimit } })} /><button type="button" onClick={() => setPending({ label: "停用时间限制", payload: { action: "timelimit", enabled: false } })} className="mt-2 h-9 w-full rounded-lg border border-[var(--line)] text-xs text-[var(--muted)] hover:text-white">停用时间限制</button></div>
      </section>
    </div>
    <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)]"><div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-5"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Settings2 size={16} />服务器设置</h2><p className="mt-1 text-xs text-[var(--muted)]">仅显示同时存在启用和停用 CFG 的固定设置。操作直接执行对应 CFG。</p></div><span className="text-xs text-[var(--muted)]">{status?.settings.length ?? 0} 项</span></div><div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">{GAME_SETTINGS.filter(([id]) => availableSettings.has(id)).map(([id, label]) => <div key={id} className="flex min-h-16 items-center gap-3 bg-[var(--panel)] px-4 py-3"><span className="min-w-0 flex-1"><span className="block text-xs font-medium">{label}</span><span className="mono mt-1 block text-[10px] text-[var(--muted)]">{id}</span></span><button type="button" onClick={() => setPending({ label: `启用${label}`, payload: { action: "setting", setting: id, enabled: true } })} className="rounded-md border border-[#3c6521] px-2 py-1.5 text-[10px] text-[var(--accent)]">启用</button><button type="button" onClick={() => setPending({ label: `停用${label}`, payload: { action: "setting", setting: id, enabled: false } })} className="rounded-md border border-[var(--line)] px-2 py-1.5 text-[10px] text-[var(--muted)]">停用</button></div>)}</div></section>
    {pending && <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]"><AlertTriangle size={18} /></span><div><h2 className="font-semibold">确认{pending.label}？</h2><p className="mt-1 text-sm text-[var(--muted)]">该操作会立即应用到正在运行的 CS2 服务器。</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={running} onClick={() => setPending(null)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">取消</button><button type="button" disabled={running} onClick={() => void execute()} className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08] disabled:opacity-50">{running ? "正在执行..." : "确认执行"}</button></div></div></div>}
  </>;
}

function StateBadge({ enabled }: { enabled?: boolean }) { return <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${enabled ? "border-[#3c6521] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]"}`}>{enabled == null ? "读取中" : enabled ? "配置已启用" : "配置未启用"}</span>; }
function ActionButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-white">{label}</button>; }
function NumberField({ label, value, min, max, onChange, action }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; action: () => void }) { return <label className="block text-xs text-[var(--muted)]">{label}<span className="mt-2 flex h-9 overflow-hidden rounded-lg border border-[var(--line)] bg-[#11171d]"><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent px-3 text-white outline-none" /><button type="button" onClick={action} title={`应用${label}`} className="grid w-10 place-items-center border-l border-[var(--line)] text-[var(--muted)] hover:text-white"><Clock3 size={14} /></button></span></label>; }
