"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, ExternalLink, RefreshCw, X } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api-request";
import type { InventoryItemSummary, InventorySimulatorResult } from "@/lib/types";

export function InventoryDrawer({ steamId, playerName, onClose, onUnauthorized }: { steamId: string; playerName?: string; onClose: () => void; onUnauthorized: () => void }) {
  const request = useApiRequest(onUnauthorized);
  const [result, setResult] = useState<InventorySimulatorResult | null>(null);
  const [tab, setTab] = useState<"equipped" | "inventory">("equipped");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await request<InventorySimulatorResult>(`/api/plugins/inventory?steamId=${encodeURIComponent(steamId)}`, { cache: "no-store" }));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [request, steamId]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const items = result?.[tab] ?? [];
  return <div className="fixed inset-0 z-40 bg-black/65" role="dialog" aria-modal="true" aria-label="玩家库存"><button type="button" aria-label="关闭库存" onClick={onClose} className="absolute inset-0 size-full cursor-default" /><aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-[var(--line)] bg-[#11171d] shadow-2xl">
    <header className="flex items-start gap-3 border-b border-[var(--line)] p-5"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#172513] text-[var(--accent)]"><Box size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{playerName || "玩家库存"}</span><span className="mono mt-1 block text-[10px] text-[var(--muted)]">{steamId}</span></span><button type="button" onClick={() => void load()} title="刷新库存" className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-white"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button><button type="button" onClick={onClose} title="关闭" className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-white"><X size={16} /></button></header>
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3"><div className="flex gap-1"><Tab active={tab === "equipped"} label={`已装备 ${result?.counts.equipped ?? 0}`} onClick={() => setTab("equipped")} /><Tab active={tab === "inventory"} label={`全部库存 ${result?.counts.inventory ?? 0}`} onClick={() => setTab("inventory")} /></div><a href={result?.serviceUrl ?? "https://inventory.cstrike.app"} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 text-xs text-[var(--muted)] hover:text-white">打开编辑器<ExternalLink size={13} /></a></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{error ? <div className="rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div> : loading && !result ? <div className="grid h-48 place-items-center text-sm text-[var(--muted)]">正在读取 Inventory Simulator...</div> : items.length ? <div className="space-y-2">{items.map((item, index) => <InventoryRow key={`${item.uid}-${index}`} item={item} />)}</div> : <div className="grid h-48 place-items-center text-center text-sm text-[var(--muted)]"><span><Box size={22} className="mx-auto mb-3" />此玩家没有公开的{tab === "equipped" ? "装备" : "库存"}数据</span></div>}</div>
    <footer className="border-t border-[var(--line)] px-5 py-3 text-[10px] text-[var(--muted)]">数据来源 inventory.cstrike.app · 玩家可在游戏内输入 !ws 刷新</footer>
  </aside></div>;
}

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-md px-2.5 py-1.5 text-xs ${active ? "bg-[var(--panel-soft)] text-white" : "text-[var(--muted)]"}`}>{label}</button>; }
function InventoryRow({ item }: { item: InventoryItemSummary }) {
  const title = item.nameTag || item.name || item.model || (item.itemId ? `物品 #${item.itemId}` : `库存项 ${item.uid}`);
  return <details className="group rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-3"><summary className="flex cursor-pointer list-none items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--panel-soft)] text-[var(--muted)]"><Box size={14} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{title}</span><span className="mono mt-1 block truncate text-[10px] text-[var(--muted)]">UID {item.uid}{item.model ? ` · ${item.model}` : ""}</span></span>{item.equipped.length > 0 && <span className="rounded border border-[#3c6521] px-1.5 py-1 text-[9px] text-[var(--accent)]">{item.equipped.join(" / ")}</span>}</summary><div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3 text-[10px] text-[var(--muted)]"><span>物品 ID：<b className="font-normal text-white">{item.itemId ?? "--"}</b></span><span>磨损：<b className="font-normal text-white">{item.wear ?? "--"}</b></span><span>名称标签：<b className="font-normal text-white">{item.nameTag ?? "--"}</b></span><span>StatTrak：<b className="font-normal text-white">{item.statTrak ?? "--"}</b></span></div><pre className="mono mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-[#0c1014] p-2 text-[9px] leading-4 text-[#9ba8b4]">{JSON.stringify(item.raw, null, 2)}</pre></details>;
}
