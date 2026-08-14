"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, CircleOff, PlugZap, RefreshCw, Settings2 } from "lucide-react";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";
import { useApiRequest } from "@/hooks/use-api-request";
import type { PluginCenterResult, PluginIntegration } from "@/lib/types";

const stateLabels = {
  loaded: "已加载",
  disabled: "已禁用",
  missing: "未安装",
} as const;

export function PluginCenterView({ onUnauthorized }: { onUnauthorized: () => void }) {
  const request = useApiRequest(onUnauthorized);
  const [data, setData] = useState<PluginCenterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await request<PluginCenterResult>("/api/plugins", { cache: "no-store" }));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return <>
    <PageTitle eyebrow="服务器管理 / 插件" title="插件中心" copy="集中查看当前服务器的特色插件，并进入已接入的专用管理功能。" />
    {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        <StatusCount label="已加载" value={data?.counts.loaded} tone="green" />
        <StatusCount label="已禁用" value={data?.counts.disabled} tone="amber" />
        <StatusCount label="未安装" value={data?.counts.missing} tone="gray" />
      </div>
      <button type="button" onClick={() => void load()} title="刷新插件状态" className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-white">
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
    {data?.plugins.length ? <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {data.plugins.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} />)}
    </div> : <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)]"><Empty icon={Boxes} text={loading ? "正在读取插件状态..." : "没有可识别的插件"} /></section>}
  </>;
}

function PluginCard({ plugin }: { plugin: PluginIntegration }) {
  const loaded = plugin.state === "loaded";
  return <article className="min-h-48 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
    <div className="flex items-start justify-between gap-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${loaded ? "bg-[#172513] text-[var(--accent)]" : plugin.state === "disabled" ? "bg-[#4a3215] text-[var(--warning)]" : "bg-[#202830] text-[var(--muted)]"}`}>
        {loaded ? <PlugZap size={17} /> : <CircleOff size={17} />}
      </span>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${loaded ? "border-[#3c6521] text-[var(--accent)]" : plugin.state === "disabled" ? "border-[#72551f] text-[var(--warning)]" : "border-[var(--line)] text-[var(--muted)]"}`}>{stateLabels[plugin.state]}</span>
    </div>
    <div className="mt-4 flex items-center gap-2"><h2 className="text-sm font-semibold">{plugin.name}</h2>{plugin.version && <span className="mono text-[10px] text-[var(--muted)]">v{plugin.version}</span>}</div>
    <p className="mt-2 min-h-10 text-xs leading-5 text-[var(--muted)]">{plugin.description}</p>
    <div className="mt-3 flex flex-wrap gap-1.5">{plugin.features.map((feature) => <span key={feature} className="rounded border border-[var(--line)] px-2 py-1 text-[10px] text-[var(--muted)]">{feature}</span>)}</div>
    <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3 text-[10px] text-[var(--muted)]"><Settings2 size={12} />{plugin.managed ? loaded ? "已接入专用管理" : "启用后可管理" : "计划接入"}</div>
  </article>;
}

function StatusCount({ label, value, tone }: { label: string; value?: number; tone: "green" | "amber" | "gray" }) {
  const colors = tone === "green" ? "border-[#3c6521] text-[var(--accent)]" : tone === "amber" ? "border-[#72551f] text-[var(--warning)]" : "border-[var(--line)] text-[var(--muted)]";
  return <span className={`rounded-md border px-2.5 py-1.5 ${colors}`}>{label} {value ?? "--"}</span>;
}
