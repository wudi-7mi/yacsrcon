"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Field } from "@/components/admin/editor-primitives";
import { toSteamId64 } from "@/lib/steam-id";
import type { CssAdmin, Player } from "@/lib/types";

export function AddAdminDialog({
  players,
  groups,
  existingNames,
  existingIds,
  onClose,
  onAdd,
}: {
  players: Player[];
  groups: string[];
  existingNames: Set<string>;
  existingIds: Set<string>;
  onClose: () => void;
  onAdd: (name: string, admin: CssAdmin) => void;
}) {
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("");
  const [group, setGroup] = useState(groups[0] ?? "");
  const valid =
    name.trim().length > 0 &&
    name.trim().length <= 64 &&
    /^7656119\d{10}$/.test(identity) &&
    !existingNames.has(name.trim()) &&
    !existingIds.has(identity) &&
    Boolean(group);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">添加游戏管理员</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              选择在线玩家，或手动输入 SteamID64。
            </p>
          </div>
          <button type="button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>
        {players.length > 0 && (
          <Field label="从在线玩家选择" className="mb-4">
            <select
              className="form-input"
              defaultValue=""
              onChange={(event) => {
                const player = players.find(
                  (item) => item.userid === event.target.value,
                );
                if (player) {
                  setName(player.name);
                  setIdentity(toSteamId64(player.steamId));
                }
              }}
            >
              <option value="">选择玩家...</option>
              {players.map((player) => (
                <option key={player.userid} value={player.userid}>
                  {player.name} · {player.steamId}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="显示名称">
            <input
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              className="form-input"
              placeholder="玩家名称"
            />
          </Field>
          <Field label="SteamID64">
            <input
              value={identity}
              onChange={(event) => setIdentity(event.target.value.trim())}
              className="form-input mono"
              placeholder="7656119..."
            />
          </Field>
        </div>
        <Field label="权限组" className="mt-4">
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="form-input"
          >
            {groups.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        {existingNames.has(name.trim()) && (
          <p className="mt-3 text-xs text-[var(--danger)]">
            管理员名称已存在。
          </p>
        )}
        {existingIds.has(identity) && (
          <p className="mt-3 text-xs text-[var(--danger)]">
            SteamID64 已经是管理员。
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onAdd(name.trim(), { identity, groups: [group] })}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#15200d] disabled:opacity-40"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  saving,
  onCancel,
  onConfirm,
}: {
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 className="font-semibold">确认保存管理员配置</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              系统会先备份三个管理员配置文件，再原子写入并重新加载
              CounterStrikeSharp 管理员。
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08]"
          >
            {saving ? "正在保存..." : "确认保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
