"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, History, RotateCcw, Save } from "lucide-react";
import { Empty, PageTitle } from "@/components/dashboard/view-primitives";
import { useApiRequest } from "@/hooks/use-api-request";
import { ApiError } from "@/lib/api-client";
import { buildCfgDiff, type CfgDiffLine } from "@/lib/cfg-diff";
import type { ManagedCfgDocument, ManagedCfgSummary, ManagedCfgVersion } from "@/lib/types";

export function ConfigView({
  onUnauthorized,
  onDirtyChange,
  onDraftChange,
}: {
  onUnauthorized: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onDraftChange: (draft: string) => void;
}) {
  const request = useApiRequest(onUnauthorized);
  const [files, setFiles] = useState<ManagedCfgSummary[]>([]);
  const [selectedId, setSelectedId] = useState("server");
  const [document, setDocument] = useState<ManagedCfgDocument | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<ManagedCfgVersion | null>(null);
  const dirty = document != null && draft !== document.content;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onDraftChange(dirty ? draft : ""), [dirty, draft, onDraftChange]);
  useEffect(() => () => {
    onDirtyChange(false);
    onDraftChange("");
  }, [onDirtyChange, onDraftChange]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  const loadDocument = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const value = await request<ManagedCfgDocument>(`/api/configs?id=${id}`, { cache: "no-store" });
      setDocument(value);
      setDraft(value.content);
      setSelectedId(id);
      setError("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const list = await request<ManagedCfgSummary[]>("/api/configs", { cache: "no-store" });
        setFiles(list);
        await loadDocument(list[0]?.id ?? "server");
      } catch (cause) {
        if (!(cause instanceof ApiError && cause.status === 401)) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDocument, request]);

  const diff = useMemo(() => buildCfgDiff(document?.content ?? "", draft), [document, draft]);

  async function save() {
    if (!document) return;
    setSaving(true);
    try {
      const value = await request<ManagedCfgDocument>("/api/configs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "write", id: document.id, content: draft, expectedHash: document.hash, confirm: true }),
      });
      await loadDocument(value.id);
      setShowDiff(false);
      setNotice(`已保存 ${value.filename}，原版本备份为 ${value.backupId}。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (!document || !restoreVersion) return;
    setSaving(true);
    try {
      const value = await request<ManagedCfgDocument>("/api/configs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "restore", id: document.id, backupId: restoreVersion.id, expectedHash: document.hash, confirm: true }),
      });
      setRestoreVersion(null);
      await loadDocument(value.id);
      setNotice(`已回滚 ${value.filename}，回滚前版本备份为 ${value.backupId}。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="服务器管理 / 配置" title="服务器配置文件" copy="编辑固定白名单内的持久 CFG，并管理自动备份与历史版本。" />
      {notice && <div className="mb-4 rounded-lg border border-[#3c6521] bg-[#172513] px-4 py-3 text-sm text-[var(--accent)]">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_290px]">
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-3"><h2 className="text-sm font-semibold">配置白名单</h2></div>
          <div className="p-2">
            {files.map((file) => (
              <button key={file.id} type="button" disabled={dirty && file.id !== selectedId} onClick={() => void loadDocument(file.id)} className={`mb-1 w-full rounded-lg px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-40 ${selectedId === file.id ? "bg-[var(--panel-soft)]" : "text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}>
                <span className="block text-sm text-white">{file.label}</span>
                <span className="mono mt-1 block text-[10px]">{file.filename}</span>
                <span className={`mt-1.5 flex items-center gap-1 text-[10px] ${file.persisted ? "text-[var(--accent)]" : "text-[var(--warning)]"}`}><Check size={11} /> {file.persisted ? "已持久化" : "首次保存后持久化"}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[#0a0e12]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div><h2 className="text-sm font-semibold">{document?.filename ?? "配置编辑器"}</h2><p className="mt-1 text-[10px] text-[var(--muted)]">最多 128 KiB，保存时同步持久源和当前运行副本</p></div>
            <div className="flex gap-2">
              <button type="button" disabled={!dirty || saving} onClick={() => { setDraft(document?.content ?? ""); setNotice(""); }} className="grid size-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] disabled:opacity-35" title="撤销草稿"><RotateCcw size={15} /></button>
              <button type="button" disabled={!dirty || saving} onClick={() => setShowDiff(true)} className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[#15200d] disabled:opacity-35"><Save size={14} /> 检查并保存</button>
            </div>
          </div>
          {loading ? <div className="py-24 text-center text-sm text-[var(--muted)]">正在读取配置...</div> : (
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} className="mono block h-[610px] w-full resize-y bg-transparent p-4 text-xs leading-6 text-[#c6d1db] outline-none" />
          )}
        </section>
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3"><History size={15} /><h2 className="text-sm font-semibold">版本历史</h2></div>
          {document?.history.length ? <div className="max-h-[650px] divide-y divide-[var(--line)] overflow-auto">
            {document.history.map((version) => <div key={version.id} className="px-4 py-3"><p className="text-xs">{new Date(version.createdAt).toLocaleString("zh-CN")}</p><p className="mono mt-1 text-[10px] text-[var(--muted)]">{version.hash.slice(0, 12)} · {version.size} B</p><button type="button" disabled={dirty} onClick={() => setRestoreVersion(version)} className="mt-2 flex items-center gap-1 text-xs text-[var(--warning)] disabled:opacity-35"><RotateCcw size={12} /> 回滚到此版本</button></div>)}
          </div> : <Empty icon={History} text="尚无历史备份" />}
        </section>
      </div>
      {showDiff && document && <ConfirmDiff filename={document.filename} diff={diff} saving={saving} onCancel={() => setShowDiff(false)} onConfirm={() => void save()} />}
      {restoreVersion && <ConfirmRestore version={restoreVersion} saving={saving} onCancel={() => setRestoreVersion(null)} onConfirm={() => void restore()} />}
    </>
  );
}

function ConfirmDiff({ filename, diff, saving, onCancel, onConfirm }: { filename: string; diff: CfgDiffLine[]; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/75 p-4"><div className="w-full max-w-3xl rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><h2 className="font-semibold">确认保存 {filename}</h2><p className="mt-1 text-sm text-[var(--muted)]">保存前将自动备份当前版本。绿色为新增，红色为删除。</p><pre className="mono mt-4 max-h-[430px] overflow-auto rounded-lg bg-[#0a0e12] p-3 text-xs leading-5">{diff.map((line, index) => <span key={index} className={`block ${line.kind === "add" ? "bg-[#172513] text-[var(--accent)]" : line.kind === "remove" ? "bg-[#29161a] text-[var(--danger)]" : "text-[var(--muted)]"}`}>{line.kind === "add" ? "+ " : line.kind === "remove" ? "- " : "  "}{line.text || " "}</span>)}</pre><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">继续编辑</button><button type="button" disabled={saving} onClick={onConfirm} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#15200d] disabled:opacity-50">{saving ? "正在保存..." : "确认保存"}</button></div></div></div>;
}

function ConfirmRestore({ version, saving, onCancel, onConfirm }: { version: ManagedCfgVersion; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/75 p-4"><div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]"><AlertTriangle size={18} /></span><div><h2 className="font-semibold">确认回滚配置？</h2><p className="mt-1 text-sm text-[var(--muted)]">将恢复 {new Date(version.createdAt).toLocaleString("zh-CN")} 的版本，当前版本会先自动备份。</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">取消</button><button type="button" disabled={saving} onClick={onConfirm} className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08] disabled:opacity-50">{saving ? "正在回滚..." : "确认回滚"}</button></div></div></div>;
}
