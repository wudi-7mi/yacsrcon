"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BellRing, Clock3, RefreshCw, Send, Signal, Users } from "lucide-react";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";
import { useApiRequest } from "@/hooks/use-api-request";
import type { AlertStatus, MetricSample, MonitoringResult } from "@/lib/types";

export function MonitoringView({ onUnauthorized }: { onUnauthorized: () => void }) {
  const request = useApiRequest(onUnauthorized);
  const [hours, setHours] = useState(6);
  const [data, setData] = useState<MonitoringResult | null>(null);
  const [alerts, setAlerts] = useState<AlertStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [monitoring, alertStatus] = await Promise.all([
        request<MonitoringResult>(`/api/monitoring?hours=${hours}`, { cache: "no-store" }),
        request<AlertStatus>("/api/alerts", { cache: "no-store" }),
      ]);
      setData(monitoring);
      setAlerts(alertStatus);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [hours, request]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const summary = data?.summary;
  async function testWebhook() {
    setTesting(true);
    try {
      await request("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "test", confirm: true }),
      });
      setNotice("Webhook 测试通知已发送。");
      setError("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setTesting(false);
    }
  }
  return <>
    <PageTitle eyebrow="服务器管理 / 监控" title="运行监控与告警" copy="查看最近 24 小时的在线人数、地图、RCON 延迟与断线趋势。" />
    {summary?.currentAlert && <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]"><AlertTriangle size={17} />{summary.currentAlert === "disconnected" ? "当前 RCON 连接中断，请检查服务器进程与网络。" : `当前 RCON 延迟超过 ${alerts?.thresholds.highLatencyMs ?? 500} ms。`}</div>}
    {notice && <div className="mb-4 rounded-lg border border-[#3c6521] bg-[#172513] px-4 py-3 text-sm text-[var(--accent)]">{notice}</div>}
    {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex rounded-lg border border-[var(--line)] p-1">{[1, 6, 12, 24].map((value) => <button key={value} type="button" onClick={() => setHours(value)} className={`h-8 rounded-md px-3 text-xs ${hours === value ? "bg-[var(--panel-soft)] text-white" : "text-[var(--muted)]"}`}>{value} 小时</button>)}</div>
      <button type="button" onClick={() => void load()} title="刷新监控数据" className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)]"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="可用率" value={summary ? `${summary.availabilityPercent}%` : "--"} icon={Signal} />
      <Metric label="断线次数" value={String(summary?.disconnects ?? 0)} icon={AlertTriangle} warning={Boolean(summary?.disconnects)} />
      <Metric label="平均 RCON 延迟" value={summary?.averageLatencyMs != null ? `${summary.averageLatencyMs} ms` : "--"} icon={Clock3} />
      <Metric label="峰值在线" value={String(summary?.peakPlayers ?? 0)} icon={Users} />
    </div>
    <section className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${alerts?.enabled ? "bg-[#172513] text-[var(--accent)]" : "bg-[#202830] text-[var(--muted)]"}`}><BellRing size={17} /></span>
          <div><h2 className="text-sm font-semibold">Webhook 告警</h2><p className="mt-1 text-xs text-[var(--muted)]">{alerts?.enabled ? `已连接 ${alerts.destination}` : "未配置 WEBHOOK_URL"}</p>{alerts?.lastSentAt && <p className="mt-1 text-[10px] text-[var(--muted)]">上次发送：{new Date(alerts.lastSentAt).toLocaleString("zh-CN")}</p>}</div>
        </div>
        <button type="button" disabled={!alerts?.enabled || testing} onClick={() => void testWebhook()} className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)] disabled:opacity-35"><Send size={14} />{testing ? "正在发送..." : "发送测试通知"}</button>
      </div>
      {alerts && <div className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] sm:grid-cols-2 xl:grid-cols-4"><span>断线阈值：{alerts.thresholds.disconnectSamples} 次</span><span>延迟阈值：{alerts.thresholds.highLatencyMs} ms</span><span>连续高延迟：{alerts.thresholds.highLatencySamples} 次</span><span>提醒冷却：{alerts.thresholds.cooldownMinutes} 分钟</span></div>}
    </section>
    {data?.samples.length ? <div className="mt-5 grid gap-5 xl:grid-cols-2"><TrendPanel title="在线人数" samples={data.samples} field="players" color="#8ee64a" suffix=" 人" /><TrendPanel title="RCON 延迟" samples={data.samples} field="latencyMs" color="#f0b952" suffix=" ms" /><MapTimeline samples={data.samples} /></div> : <section className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--panel)]"><Empty icon={Activity} text={loading ? "正在读取监控数据..." : "采样器刚启动，稍后将显示趋势"} /></section>}
  </>;
}

function Metric({ label, value, icon: Icon, warning }: { label: string; value: string; icon: typeof Activity; warning?: boolean }) {
  return <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4"><div className="flex items-center justify-between text-xs text-[var(--muted)]"><span>{label}</span><Icon size={15} /></div><p className={`mt-4 text-2xl font-semibold ${warning ? "text-[var(--warning)]" : "text-white"}`}>{value}</p></div>;
}

function TrendPanel({ title, samples, field, color, suffix }: { title: string; samples: MetricSample[]; field: "players" | "latencyMs"; color: string; suffix: string }) {
  const values = samples.map((sample) => field === "players" ? sample.players : sample.latencyMs ?? 0);
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => `${samples.length === 1 ? 0 : (index / (samples.length - 1)) * 100},${100 - (value / maximum) * 90}`).join(" ");
  const latest = values.at(-1) ?? 0;
  return <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2><span className="text-xs text-[var(--muted)]">当前 {latest}{suffix}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-48 w-full" aria-label={`${title}趋势图`}><line x1="0" y1="100" x2="100" y2="100" stroke="#2a3540" vectorEffect="non-scaling-stroke" /><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><TimeRange samples={samples} /></section>;
}

function MapTimeline({ samples }: { samples: MetricSample[] }) {
  const segments: Array<{ map: string; start: string; end: string }> = [];
  for (const sample of samples) {
    const map = sample.connected ? (sample.map ?? "未知地图") : "断线";
    const current = segments.at(-1);
    if (current?.map === map) current.end = sample.at;
    else segments.push({ map, start: sample.at, end: sample.at });
  }
  return <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 xl:col-span-2"><h2 className="text-sm font-semibold">地图与连接时间轴</h2><div className="mt-4 flex min-h-16 overflow-hidden rounded-lg border border-[var(--line)]">{segments.map((segment, index) => <div key={`${segment.start}-${index}`} className={`flex min-w-20 flex-1 items-center justify-center border-r border-[var(--line)] px-2 text-center text-xs last:border-0 ${segment.map === "断线" ? "bg-[#29161a] text-[var(--danger)]" : "bg-[#11171d] text-[var(--muted)]"}`} title={`${new Date(segment.start).toLocaleString("zh-CN")} - ${new Date(segment.end).toLocaleString("zh-CN")}`}>{segment.map}</div>)}</div></section>;
}

function TimeRange({ samples }: { samples: MetricSample[] }) {
  return <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]"><span>{new Date(samples[0].at).toLocaleTimeString("zh-CN")}</span><span>{new Date(samples.at(-1)!.at).toLocaleTimeString("zh-CN")}</span></div>;
}
