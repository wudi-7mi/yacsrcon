"use client";

import { useState } from "react";
import { AlertTriangle, Copy, LogIn } from "lucide-react";

export function SessionExpiredDialog({
  draft,
  onDiscard,
  onReauthenticate,
}: {
  draft: string;
  onDiscard: () => void;
  onReauthenticate: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onReauthenticate(username, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setLoading(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setError("");
    } catch {
      setError("无法访问剪贴板，请重新登录后继续保存草稿。");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 className="font-semibold">会话已过期</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              管理员草稿仍保留在当前页面。重新登录后可以继续编辑和保存。
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs text-[var(--muted)]">
              用户名
            </span>
            <input
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              className="form-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-[var(--muted)]">
              密码
            </span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              className="form-input"
            />
          </label>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-sm font-semibold text-[#15200d] disabled:opacity-40"
          >
            <LogIn size={16} />
            {loading ? "正在登录..." : "重新登录并继续"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-[var(--line)] pt-4">
          <button
            type="button"
            onClick={() => void copyDraft()}
            className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs"
          >
            <Copy size={14} /> {copied ? "已复制草稿" : "复制草稿 JSON"}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-3 py-2 text-xs text-[var(--danger)]"
          >
            放弃草稿并前往登录
          </button>
        </div>
      </div>
    </div>
  );
}
