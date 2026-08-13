"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Skull, UserMinus, Users } from "lucide-react";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";
import { BanList } from "@/components/punishments/ban-list";
import { OfflineBanPanel } from "@/components/punishments/offline-ban-panel";
import { PunishmentDialog } from "@/components/punishments/punishment-dialog";
import type { ActionTarget } from "@/components/punishments/types";
import { useApiRequest } from "@/hooks/use-api-request";
import { ApiError } from "@/lib/api-client";
import { toSteamId64 } from "@/lib/steam-id";
import type { BanRecord, DashboardData } from "@/lib/types";

export function PlayersView({
  data,
  onUnauthorized,
  onRefresh,
}: {
  data: DashboardData;
  onUnauthorized: () => void;
  onRefresh: () => void;
}) {
  const request = useApiRequest(onUnauthorized);
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [loadingBans, setLoadingBans] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState<ActionTarget | null>(null);

  const loadBans = useCallback(async () => {
    setLoadingBans(true);
    try {
      setBans(
        await request<BanRecord[]>("/api/punishments", { cache: "no-store" }),
      );
      setError("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoadingBans(false);
    }
  }, [request]);

  useEffect(() => {
    const timer = setTimeout(() => void loadBans(), 0);
    return () => clearTimeout(timer);
  }, [loadBans]);

  async function execute(payload: Record<string, unknown>) {
    const result = await request<{ ok: true; warning?: string }>(
      "/api/punishments",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, confirm: true }),
      },
    );
    setNotice(result.warning ?? "操作已执行。");
    setError("");
    await loadBans();
    onRefresh();
  }

  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 玩家与封禁"
        title="玩家处罚与封禁"
        copy="管理在线玩家，并查看 SimpleAdmin 的持久化封禁记录。"
      />
      {notice && (
        <div className="mb-4 rounded-lg border border-[#3c6521] bg-[#172513] px-4 py-3 text-sm text-[var(--accent)]">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="font-semibold">在线玩家</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {data.players.length} 名玩家在线
          </p>
        </div>
        {data.players.length ? (
          <div className="divide-y divide-[var(--line)]">
            {data.players.map((player) => {
              const steamId = toSteamId64(player.steamId);
              const manageable = /^7656119\d{10}$/.test(steamId);
              return (
                <div
                  key={player.userid}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_90px_180px_auto] md:items-center"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {player.name}
                    </span>
                    <span className="mono mt-1 block text-[10px] text-[var(--muted)] md:hidden">
                      {player.steamId}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {player.ping} ms
                  </span>
                  <span className="mono hidden truncate text-xs text-[var(--muted)] md:block">
                    {steamId}
                  </span>
                  <span className="flex flex-wrap gap-2 md:justify-end">
                    <ActionButton
                      icon={Skull}
                      label="击杀"
                      disabled={!manageable}
                      onClick={() => setTarget({ action: "slay", player })}
                    />
                    <ActionButton
                      icon={UserMinus}
                      label="踢出"
                      disabled={!manageable}
                      onClick={() => setTarget({ action: "kick", player })}
                    />
                    <ActionButton
                      icon={Ban}
                      label="封禁"
                      danger
                      disabled={!manageable}
                      onClick={() => setTarget({ action: "ban", player })}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon={Users} text="当前没有玩家在线" />
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <OfflineBanPanel
          onBan={(steamId) => setTarget({ action: "ban", steamId })}
        />
        <BanList
          bans={bans}
          loading={loadingBans}
          onRefresh={() => void loadBans()}
          onUnban={(steamId) => setTarget({ action: "unban", steamId })}
        />
      </div>

      {target && (
        <PunishmentDialog
          target={target}
          onClose={() => setTarget(null)}
          onConfirm={async (payload) => {
            await execute(payload);
            setTarget(null);
          }}
        />
      )}
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: typeof Ban;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs disabled:opacity-35 ${danger ? "border-[#6a2930] text-[var(--danger)]" : "border-[var(--line)] text-[var(--muted)] hover:text-white"}`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}
