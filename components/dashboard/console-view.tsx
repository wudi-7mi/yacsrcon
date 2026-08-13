"use client";

import { Copy, Send, Terminal } from "lucide-react";
import { PageTitle } from "@/components/dashboard/view-primitives";

export function ConsoleView({
  command,
  setCommand,
  output,
  onCommand,
}: {
  command: string;
  setCommand: (v: string) => void;
  output: string;
  onCommand: (c: string) => void;
}) {
  return (
    <>
      <PageTitle
        eyebrow="服务器管理 / 控制台"
        title="RCON 控制台"
        copy="直接向服务器发送命令，并查看原始响应。"
      />
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#0a0e12]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Terminal size={15} /> 实时会话
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(output)}
            className="text-[var(--muted)] hover:text-white"
            title="复制输出"
          >
            <Copy size={15} />
          </button>
        </div>
        <pre className="mono h-[430px] overflow-auto whitespace-pre-wrap p-5 text-xs leading-6 text-[#b8c6d3]">
          {output}
        </pre>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCommand(command);
          }}
          className="flex gap-2 border-t border-[var(--line)] p-3"
        >
          <span className="mono self-center text-sm text-[var(--accent)]">
            $
          </span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="status"
            className="mono min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#46525e]"
          />
          <button
            className="grid size-9 place-items-center rounded-lg bg-[var(--accent)] text-[#15200d]"
            title="执行命令"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
}
