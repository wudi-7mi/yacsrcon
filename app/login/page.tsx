"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Radio } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    try {
      await apiRequest<{ ok: true }>("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.push("/");
    } catch {
      setError("登录失败，请检查用户名、密码和网络连接");
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-[var(--accent)] text-[#15200d]">
            <Radio size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-[var(--accent)]">
              YACSRCON
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              CS2 服务器控制台
            </h1>
          </div>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-2xl shadow-black/20"
        >
          <div>
            <label className="mb-2 block text-sm text-[var(--muted)]">
              用户名
            </label>
            <input
              name="username"
              defaultValue="admin"
              className="w-full rounded-lg border border-[var(--line)] bg-[#0f1419] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-[var(--muted)]">
              密码
            </label>
            <input
              name="password"
              type="password"
              className="w-full rounded-lg border border-[var(--line)] bg-[#0f1419] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-[#15200d] disabled:opacity-50"
          >
            <LogIn size={17} />
            {loading ? "正在登录..." : "进入控制台"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          单服务器管理员访问
        </p>
      </div>
    </main>
  );
}
