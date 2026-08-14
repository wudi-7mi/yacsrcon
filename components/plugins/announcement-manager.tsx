"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, MessageSquareText, Palette, Plus, Save, Trash2 } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api-request";
import type { AnnouncementCondition, AnnouncementConfig, AnnouncementDocument, AnnouncementMessage } from "@/lib/types";

type MessageKind = keyof AnnouncementConfig;
const KINDS: Array<{ id: MessageKind; label: string; detail: string }> = [
  { id: "OnPlayerConnectMsgs", label: "玩家连接", detail: "玩家进入服务器后发送" },
  { id: "OnAdminConnectMsgs", label: "管理员连接", detail: "兼容旧版管理员连接消息" },
  { id: "OnRoundStartMsgs", label: "回合开始", detail: "每回合开始时广播" },
  { id: "OnCommandMsgs", label: "命令触发", detail: "玩家输入聊天命令后回复" },
  { id: "TimerMsgs", label: "定时广播", detail: "按固定秒数循环发送" },
];
const COLORS = ["GREEN", "RED", "YELLOW", "BLUE", "PURPLE", "ORANGE", "WHITE", "NORMAL", "GREY", "LIGHT_BLUE", "GOLD"];
const COLOR_CLASSES: Record<string, string> = {
  GREEN: "text-[#8ee64a]", RED: "text-[#ff7b85]", YELLOW: "text-[#f0d45c]", BLUE: "text-[#68a7ff]", PURPLE: "text-[#c58cff]",
  ORANGE: "text-[#f3a35c]", WHITE: "text-white", NORMAL: "text-white", GREY: "text-[#9ba8b4]", LIGHT_BLUE: "text-[#8fd7ff]", GOLD: "text-[#e6bd50]",
};

export function AnnouncementManager({
  onBack,
  onDirtyChange,
  onDraftChange,
  onUnauthorized,
}: {
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onDraftChange: (draft: string) => void;
  onUnauthorized: () => void;
}) {
  const request = useApiRequest(onUnauthorized);
  const [document, setDocument] = useState<AnnouncementDocument | null>(null);
  const [draft, setDraft] = useState<AnnouncementConfig | null>(null);
  const [kind, setKind] = useState<MessageKind>("OnPlayerConnectMsgs");
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingBack, setConfirmingBack] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const value = await request<AnnouncementDocument>("/api/plugins/announcements", { cache: "no-store" });
      setDocument(value);
      setDraft(structuredClone(value.config));
      setSelected(0);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const dirty = useMemo(() => Boolean(document && draft && JSON.stringify(document.config) !== JSON.stringify(draft)), [document, draft]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onDraftChange(dirty && draft ? JSON.stringify(draft, null, 2) : ""), [dirty, draft, onDraftChange]);
  useEffect(() => () => { onDirtyChange(false); onDraftChange(""); }, [onDirtyChange, onDraftChange]);

  const messages = draft?.[kind] ?? [];
  const message = messages[selected];
  function updateMessage(patch: Partial<AnnouncementMessage>) {
    if (!draft || !message) return;
    const next = structuredClone(draft);
    next[kind][selected] = { ...next[kind][selected], ...patch };
    setDraft(next);
  }
  function addMessage() {
    if (!draft) return;
    const next = structuredClone(draft);
    const base: AnnouncementMessage = kind === "OnCommandMsgs"
      ? { msg: "新的命令公告", cmd: "notice" }
      : kind === "TimerMsgs"
        ? { msg: "新的定时公告", timer: 60 }
        : kind === "OnPlayerConnectMsgs" || kind === "OnAdminConnectMsgs"
          ? { msg: "新的连接公告", delay: 3 }
          : { msg: "新的回合公告" };
    next[kind].push(base);
    setDraft(next);
    setSelected(next[kind].length - 1);
  }
  function removeMessage() {
    if (!draft || !message) return;
    const next = structuredClone(draft);
    next[kind].splice(selected, 1);
    setDraft(next);
    setSelected(Math.max(0, selected - 1));
  }
  async function save() {
    if (!document || !draft) return;
    setSaving(true);
    try {
      const result = await request<AnnouncementDocument>("/api/plugins/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "write", config: draft, expectedHash: document.hash, confirm: true }),
      });
      setDocument(result);
      setDraft(structuredClone(result.config));
      setConfirming(false);
      setNotice(result.reloadWarning ? `配置已保存，但热重载失败：${result.reloadWarning}` : "公告配置已保存并热重载。");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><button type="button" onClick={() => dirty ? setConfirmingBack(true) : onBack()} className="mb-3 flex items-center gap-1 text-xs text-[var(--muted)] hover:text-white"><ArrowLeft size={14} />返回插件中心</button><h1 className="text-2xl font-semibold">公告广播</h1><p className="mt-2 text-sm text-[var(--muted)]">编辑连接、回合、命令和定时消息，并预览聊天颜色。</p></div>
      <button type="button" disabled={!dirty || saving} onClick={() => setConfirming(true)} className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[#15200d] disabled:opacity-35"><Save size={14} />保存并重载</button>
    </div>
    {notice && <div className="mb-4 rounded-lg border border-[#3c6521] bg-[#172513] px-4 py-3 text-sm text-[var(--accent)]">{notice}</div>}
    {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{KINDS.map((item) => <button key={item.id} type="button" onClick={() => { setKind(item.id); setSelected(0); }} className={`shrink-0 rounded-md border px-3 py-2 text-xs ${kind === item.id ? "border-[var(--accent)] bg-[#172513] text-white" : "border-[var(--line)] text-[var(--muted)]"}`}>{item.label} <span className="ml-1 opacity-60">{draft?.[item.id].length ?? 0}</span></button>)}</div>
    <div className="grid min-h-[540px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><h2 className="text-sm font-semibold">{KINDS.find((item) => item.id === kind)?.label}</h2><p className="mt-1 text-[10px] text-[var(--muted)]">{KINDS.find((item) => item.id === kind)?.detail}</p></div><button type="button" onClick={addMessage} title="新增消息" className="grid size-8 place-items-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:text-white"><Plus size={15} /></button></div>
        <div className="max-h-[470px] overflow-y-auto p-2">{loading ? <p className="py-16 text-center text-xs text-[var(--muted)]">正在读取公告...</p> : messages.length ? messages.map((item, index) => <button key={`${kind}-${index}`} type="button" onClick={() => setSelected(index)} className={`mb-1 w-full rounded-md px-3 py-2.5 text-left text-xs last:mb-0 ${selected === index ? "bg-[var(--panel-soft)] text-white" : "text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}><span className="block truncate">{stripColors(item.msg)}</span><span className="mono mt-1 block truncate text-[10px] opacity-60">{item.cmd ? `!${item.cmd}` : item.timer ? `${item.timer} 秒` : item.delay != null ? `延迟 ${item.delay} 秒` : "立即发送"}</span></button>) : <div className="grid place-items-center gap-2 py-16 text-center text-xs text-[var(--muted)]"><MessageSquareText size={20} />暂无消息</div>}</div>
      </section>
      <section className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">{message ? <div className="space-y-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">消息编辑器</h2><button type="button" onClick={removeMessage} title="删除消息" className="grid size-8 place-items-center rounded-md border border-[#6a2930] text-[var(--danger)]"><Trash2 size={14} /></button></div>
        <label className="block"><span className="mb-2 block text-xs text-[var(--muted)]">消息正文</span><textarea value={message.msg} onChange={(event) => updateMessage({ msg: event.target.value })} rows={7} maxLength={4000} className="mono w-full resize-y rounded-lg border border-[var(--line)] bg-[#0c1014] p-3 text-sm outline-none focus:border-[var(--accent)]" /></label>
        <div><div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]"><Palette size={13} />插入颜色</div><div className="flex flex-wrap gap-1.5">{COLORS.map((color) => <button key={color} type="button" onClick={() => updateMessage({ msg: `${message.msg}[${color}]` })} className={`rounded border border-[var(--line)] px-2 py-1 text-[10px] ${COLOR_CLASSES[color]}`}>{color}</button>)}</div></div>
        <div className="rounded-lg border border-[var(--line)] bg-[#11171d] p-3"><p className="mb-2 text-[10px] text-[var(--muted)]">聊天预览</p><p className="text-sm leading-6"><ColorPreview value={message.msg} /></p></div>
        <div className="grid gap-4 sm:grid-cols-2">{(kind === "OnPlayerConnectMsgs" || kind === "OnAdminConnectMsgs") && <NumberField label="延迟秒数（-1 为默认）" value={message.delay ?? -1} min={-1} max={3600} onChange={(value) => updateMessage({ delay: value })} />}{kind === "OnCommandMsgs" && <TextField label="聊天命令" value={message.cmd ?? ""} prefix="!" onChange={(value) => updateMessage({ cmd: value })} />}{kind === "TimerMsgs" && <NumberField label="广播间隔（秒）" value={message.timer ?? 60} min={1} max={86400} onChange={(value) => updateMessage({ timer: value })} />}<label className="flex h-10 items-center gap-2 self-end rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)]"><input type="checkbox" checked={Boolean(message.admin)} onChange={(event) => updateMessage({ admin: event.target.checked })} className="accent-[var(--accent)]" />仅管理员可见</label></div>
        <div className="border-t border-[var(--line)] pt-4"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(message.cond)} onChange={(event) => updateMessage({ cond: event.target.checked ? { flag: "CS2AB_flag_1", op: 1, value: 1 } : undefined })} className="accent-[var(--accent)]" />启用条件</label>{message.cond && <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs text-[var(--muted)]">条件标志<select value={message.cond.flag} onChange={(event) => updateMessage({ cond: { ...message.cond!, flag: event.target.value as AnnouncementCondition["flag"] } })} className="mt-2 h-9 w-full rounded-md border border-[var(--line)] bg-[#11171d] px-2 text-white">{[1,2,3,4,5].map((number) => <option key={number}>CS2AB_flag_{number}</option>)}</select></label><label className="text-xs text-[var(--muted)]">比较方式<select value={message.cond.op} onChange={(event) => updateMessage({ cond: { ...message.cond!, op: Number(event.target.value) as 0|1|2|3 } })} className="mt-2 h-9 w-full rounded-md border border-[var(--line)] bg-[#11171d] px-2 text-white"><option value={0}>始终显示</option><option value={1}>等于</option><option value={2}>小于</option><option value={3}>大于</option></select></label><NumberField label="比较值" value={message.cond.value} min={-1000000} max={1000000} onChange={(value) => updateMessage({ cond: { ...message.cond!, value } })} /></div>}</div>
      </div> : <div className="grid min-h-[450px] place-items-center text-sm text-[var(--muted)]">选择或新增一条消息</div>}</section>
    </div>
    {confirming && <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]"><AlertTriangle size={18} /></span><div><h2 className="font-semibold">保存公告配置？</h2><p className="mt-1 text-sm text-[var(--muted)]">将写入持久配置和运行副本，随后通知公告插件热重载。</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setConfirming(false)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">取消</button><button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08] disabled:opacity-50">{saving ? "正在保存..." : "确认保存"}</button></div></div></div>}
    {confirmingBack && <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><h2 className="font-semibold">放弃公告草稿？</h2><p className="mt-2 text-sm text-[var(--muted)]">返回插件中心后，当前未保存内容将无法恢复。</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmingBack(false)} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">继续编辑</button><button type="button" onClick={onBack} className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08]">放弃并返回</button></div></div></div>}
  </>;
}

function TextField({ label, value, prefix, onChange }: { label: string; value: string; prefix?: string; onChange: (value: string) => void }) { return <label className="text-xs text-[var(--muted)]">{label}<span className="mt-2 flex h-10 items-center rounded-lg border border-[var(--line)] bg-[#11171d] px-3">{prefix && <span className="mr-1">{prefix}</span>}<input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-white outline-none" /></span></label>; }
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) { return <label className="text-xs text-[var(--muted)]">{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-white outline-none" /></label>; }
function stripColors(value: string) { return value.replace(/\[[A-Z_]+\]/g, "").replace(/[\u2028\u2029]/g, " "); }
function ColorPreview({ value }: { value: string }) {
  const result = value.split(/(\[[A-Z_]+\])/g).reduce<{ color: string; nodes: ReactNode[] }>((current, part, index) => {
    const token = part.match(/^\[([A-Z_]+)\]$/)?.[1];
    if (token) return { ...current, color: token };
    return {
      ...current,
      nodes: [...current.nodes, <span key={`${index}-${part.slice(0, 8)}`} className={COLOR_CLASSES[current.color] ?? "text-white"}>{part}</span>],
    };
  }, { color: "NORMAL", nodes: [] });
  return <>{result.nodes}</>;
}
