"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Backpack, ExternalLink, Search, Users } from "lucide-react";
import { InventoryDrawer } from "@/components/plugins/inventory-drawer";
import { useApiRequest } from "@/hooks/use-api-request";
import { toSteamId64 } from "@/lib/steam-id";
import type { DashboardData } from "@/lib/types";

export function InventoryManager({ onBack, onUnauthorized }: { onBack: () => void; onUnauthorized: () => void }) {
  const request = useApiRequest(onUnauthorized);
  const [players, setPlayers] = useState<DashboardData["players"]>([]);
  const [steamId, setSteamId] = useState("");
  const [target, setTarget] = useState<{ steamId: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const value = await request<DashboardData>("/api/dashboard", { cache: "no-store" });
      setPlayers(value.players);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  function lookup() {
    const normalized = toSteamId64(steamId.trim());
    if (!/^7656119\d{10}$/.test(normalized)) { setError("请输入有效的 SteamID64、Steam2 或 Steam3 ID。"); return; }
    setError("");
    setTarget({ steamId: normalized });
  }
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-xs text-[var(--muted)] hover:text-white"><ArrowLeft size={14} />返回插件中心</button><h1 className="text-2xl font-semibold">玩家库存</h1><p className="mt-2 text-sm text-[var(--muted)]">查看 Inventory Simulator 的公开库存和当前装备。</p></div><a href="https://inventory.cstrike.app" target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)] hover:text-white">官方编辑器<ExternalLink size={14} /></a></div>
    {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
    <section className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><h2 className="text-sm font-semibold">查找玩家</h2><form onSubmit={(event) => { event.preventDefault(); lookup(); }} className="mt-3 flex max-w-2xl gap-2"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-[var(--muted)] focus-within:border-[var(--accent)]"><Search size={15} /><input value={steamId} onChange={(event) => setSteamId(event.target.value)} placeholder="SteamID64 / Steam2 / Steam3" className="mono min-w-0 flex-1 bg-transparent text-xs text-white outline-none" /></label><button type="submit" className="h-10 rounded-lg bg-[var(--accent)] px-4 text-xs font-semibold text-[#15200d]">查看库存</button></form></section>
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]"><div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Users size={15} />在线玩家</h2><p className="mt-1 text-xs text-[var(--muted)]">选择玩家查看公开库存</p></div><span className="text-xs text-[var(--muted)]">{players.length} 人</span></div>{loading ? <div className="py-14 text-center text-sm text-[var(--muted)]">正在读取在线玩家...</div> : players.length ? <div className="divide-y divide-[var(--line)]">{players.map((player) => { const id = toSteamId64(player.steamId); const valid = /^7656119\d{10}$/.test(id); return <div key={player.userid} className="flex items-center gap-3 px-5 py-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--panel-soft)] text-[var(--muted)]"><Backpack size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm">{player.name}</span><span className="mono mt-1 block text-[10px] text-[var(--muted)]">{id}</span></span><button type="button" disabled={!valid} onClick={() => setTarget({ steamId: id, name: player.name })} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white disabled:opacity-35">查看库存</button></div>; })}</div> : <div className="py-14 text-center text-sm text-[var(--muted)]">当前没有玩家在线</div>}</section>
    {target && <InventoryDrawer steamId={target.steamId} playerName={target.name} onClose={() => setTarget(null)} onUnauthorized={onUnauthorized} />}
  </>;
}
