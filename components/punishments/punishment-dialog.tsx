"use client";

import { useMemo, useState } from "react";
import { toSteamId64 } from "@/lib/steam-id";
import type { ActionTarget } from "@/components/punishments/types";

const durationOptions = [
  { label: "30 分钟", value: 30 },
  { label: "2 小时", value: 120 },
  { label: "1 天", value: 1_440 },
  { label: "7 天", value: 10_080 },
  { label: "永久", value: 0 },
] as const;

const reasonOptions = ["违反服务器规则", "恶意行为", "作弊嫌疑", "其他"];

export function PunishmentDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: ActionTarget;
  onClose: () => void;
  onConfirm: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const action = target.action;
  const steamId = target.player
    ? toSteamId64(target.player.steamId)
    : target.steamId!;
  const [minutes, setMinutes] = useState(120);
  const [customMinutes, setCustomMinutes] = useState("");
  const [reason, setReason] = useState(reasonOptions[0]);
  const [customReason, setCustomReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const finalMinutes = customMinutes ? Number(customMinutes) : minutes;
  const finalReason = reason === "其他" ? customReason.trim() : reason;
  const title =
    action === "kick"
      ? "确认踢出玩家"
      : action === "slay"
        ? "确认击杀玩家"
        : action === "unban"
          ? "确认解除封禁"
          : "确认封禁玩家";

  const payload = useMemo(() => {
    if (action === "unban") return { action, steamId };
    const common = {
      action,
      userid: target.player?.userid,
      steamId,
      playerName: target.player?.name,
      reason: finalReason || undefined,
    };
    return action === "ban" ? { ...common, minutes: finalMinutes } : common;
  }, [action, finalMinutes, finalReason, steamId, target.player]);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onConfirm(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="mono mt-2 text-xs text-[var(--muted)]">
          {target.player?.name ?? steamId} · {steamId}
        </p>
        {action === "ban" && (
          <div className="mt-5">
            <p className="mb-2 text-xs text-[var(--muted)]">封禁时长</p>
            <div className="grid grid-cols-3 gap-2">
              {durationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setMinutes(option.value);
                    setCustomMinutes("");
                  }}
                  className={`h-9 rounded-lg border text-xs ${!customMinutes && minutes === option.value ? "border-[var(--accent)] bg-[#172513] text-white" : "border-[var(--line)] text-[var(--muted)]"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              max="525600"
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              className="form-input mt-3"
              placeholder="自定义分钟数"
            />
          </div>
        )}
        {action !== "unban" && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-[var(--muted)]">原因（仅审计记录）</p>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="form-input"
            >
              {reasonOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            {reason === "其他" && (
              <input
                value={customReason}
                maxLength={200}
                onChange={(event) => setCustomReason(event.target.value)}
                className="form-input mt-3"
                placeholder="输入原因"
              />
            )}
          </div>
        )}
        {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            disabled={
              saving ||
              (action === "ban" &&
                (!Number.isInteger(finalMinutes) ||
                  finalMinutes < 0 ||
                  finalMinutes > 525_600))
            }
            onClick={() => void submit()}
            className="rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "正在执行..." : "确认执行"}
          </button>
        </div>
      </div>
    </div>
  );
}
