"use client";

import { useState } from "react";
import { Ban } from "lucide-react";

export function OfflineBanPanel({
  onBan,
}: {
  onBan: (steamId: string) => void;
}) {
  const [steamId, setSteamId] = useState("");
  const valid = /^7656119\d{10}$/.test(steamId);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <h2 className="font-semibold">离线玩家封禁</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        使用 SteamID64 封禁未在线的玩家。
      </p>
      <label className="mt-5 block">
        <span className="mb-2 block text-xs text-[var(--muted)]">SteamID64</span>
        <input
          value={steamId}
          onChange={(event) => setSteamId(event.target.value.trim())}
          className="form-input mono"
          placeholder="7656119..."
        />
      </label>
      <button
        type="button"
        disabled={!valid}
        onClick={() => onBan(steamId)}
        className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--danger)] text-xs font-semibold text-white disabled:opacity-35"
      >
        <Ban size={14} /> 设置封禁
      </button>
    </section>
  );
}
