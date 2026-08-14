"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Plus, Save, Trash2, Vote } from "lucide-react";
import { useApiRequest } from "@/hooks/use-api-request";
import type { CustomVote, CustomVotesConfig, CustomVotesDocument } from "@/lib/types";

const newVote = (): CustomVote => ({
  Command: "newvote",
  CommandAliases: [],
  Description: "新的服务器投票",
  TimeToVote: 30,
  Options: {
    Yes: { Text: "{Green}同意", Commands: ["say 投票已通过"] },
    No: { Text: "{Red}反对", Commands: ["say 投票未通过"] },
  },
  DefaultOption: "No",
  Style: "chat",
  MinVotePercentage: -1,
  Permission: { RequiresAll: false, Permissions: [] },
});

export function CustomVotesManager({
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
  const [document, setDocument] = useState<CustomVotesDocument | null>(null);
  const [draft, setDraft] = useState<CustomVotesConfig | null>(null);
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
      const value = await request<CustomVotesDocument>("/api/plugins/custom-votes", { cache: "no-store" });
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

  const vote = draft?.CustomVotes[selected];
  function updateGlobal(patch: Partial<CustomVotesConfig>) {
    if (draft) setDraft({ ...draft, ...patch });
  }
  function updateVote(patch: Partial<CustomVote>) {
    if (!draft || !vote) return;
    const next = structuredClone(draft);
    next.CustomVotes[selected] = { ...next.CustomVotes[selected], ...patch };
    setDraft(next);
  }
  function addVote() {
    if (!draft) return;
    const next = structuredClone(draft);
    const used = new Set(next.CustomVotes.map((item) => item.Command));
    const value = newVote();
    let suffix = 1;
    while (used.has(value.Command)) value.Command = `newvote${suffix++}`;
    next.CustomVotes.push(value);
    setDraft(next);
    setSelected(next.CustomVotes.length - 1);
  }
  function removeVote() {
    if (!draft || !vote) return;
    const next = structuredClone(draft);
    next.CustomVotes.splice(selected, 1);
    setDraft(next);
    setSelected(Math.max(0, selected - 1));
  }
  function addOption() {
    if (!vote) return;
    let suffix = 1;
    let name = "Option";
    while (Object.hasOwn(vote.Options, name)) name = `Option${suffix++}`;
    updateVote({ Options: { ...vote.Options, [name]: { Text: "新选项", Commands: ["say 新选项获胜"] } } });
  }
  function updateOption(name: string, nextName: string, text: string, commands: string[]) {
    if (!vote || !nextName || (name !== nextName && Object.hasOwn(vote.Options, nextName))) return;
    const entries = Object.entries(vote.Options).map(([key, value]) => key === name ? [nextName, { ...value, Text: text, Commands: commands }] : [key, value]);
    updateVote({ Options: Object.fromEntries(entries), DefaultOption: vote.DefaultOption === name ? nextName : vote.DefaultOption });
  }
  function removeOption(name: string) {
    if (!vote || Object.keys(vote.Options).length <= 2) return;
    const options = Object.fromEntries(Object.entries(vote.Options).filter(([key]) => key !== name));
    updateVote({ Options: options, DefaultOption: vote.DefaultOption === name ? Object.keys(options)[0] : vote.DefaultOption });
  }
  async function save() {
    if (!document || !draft) return;
    setSaving(true);
    try {
      const result = await request<CustomVotesDocument>("/api/plugins/custom-votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "write", config: draft, expectedHash: document.hash, confirm: true }),
      });
      setDocument(result);
      setDraft(structuredClone(result.config));
      setConfirming(false);
      setNotice(result.reloadWarning ? `配置已保存，但热重载失败：${result.reloadWarning}` : "投票配置已保存并热重载。");
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
      <div><button type="button" onClick={() => dirty ? setConfirmingBack(true) : onBack()} className="mb-3 flex items-center gap-1 text-xs text-[var(--muted)] hover:text-white"><ArrowLeft size={14} />返回插件中心</button><h1 className="text-2xl font-semibold">自定义投票</h1><p className="mt-2 text-sm text-[var(--muted)]">构建聊天投票，并设置获胜选项执行的服务器命令。</p></div>
      <button type="button" disabled={!dirty || saving} onClick={() => setConfirming(true)} className="flex h-9 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[#15200d] disabled:opacity-35"><Save size={14} />保存并重载</button>
    </div>
    {notice && <div className="mb-4 rounded-lg border border-[#3c6521] bg-[#172513] px-4 py-3 text-sm text-[var(--accent)]">{notice}</div>}
    {error && <div className="mb-4 rounded-lg border border-[#6a2930] bg-[#29161a] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}
    <section className="mb-4 grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 md:grid-cols-4">
      <Toggle label="启用自定义投票" checked={draft?.CustomVotesEnabled ?? false} onChange={(checked) => updateGlobal({ CustomVotesEnabled: checked })} />
      <NumberField label="全局冷却（秒）" value={draft?.VoteCooldown ?? 60} min={0} max={86400} onChange={(value) => updateGlobal({ VoteCooldown: value })} />
      <TextField label="聊天前缀" value={draft?.ChatPrefix ?? ""} onChange={(value) => updateGlobal({ ChatPrefix: value })} />
      <SelectField label="强制显示方式" value={draft?.ForceStyle ?? "none"} options={[['none', '跟随投票'], ['center', '屏幕中央'], ['chat', '聊天栏']]} onChange={(value) => updateGlobal({ ForceStyle: value as CustomVotesConfig["ForceStyle"] })} />
    </section>
    <div className="grid min-h-[560px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><h2 className="text-sm font-semibold">投票列表</h2><p className="mt-1 text-[10px] text-[var(--muted)]">{draft?.CustomVotes.length ?? 0} 个投票</p></div><button type="button" onClick={addVote} title="新增投票" className="grid size-8 place-items-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:text-white"><Plus size={15} /></button></div>
        <div className="max-h-[500px] overflow-y-auto p-2">{loading ? <p className="py-16 text-center text-xs text-[var(--muted)]">正在读取投票...</p> : draft?.CustomVotes.length ? draft.CustomVotes.map((item, index) => <button key={`${item.Command}-${index}`} type="button" onClick={() => setSelected(index)} className={`mb-1 w-full rounded-md px-3 py-2.5 text-left last:mb-0 ${selected === index ? "bg-[var(--panel-soft)] text-white" : "text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}><span className="mono block text-xs">!{item.Command}</span><span className="mt-1 block truncate text-[10px] opacity-60">{item.Description}</span></button>) : <div className="grid place-items-center gap-2 py-16 text-xs text-[var(--muted)]"><Vote size={20} />暂无投票</div>}</div>
      </section>
      <section className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">{vote ? <div className="space-y-5">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">投票编辑器</h2><p className="mt-1 text-[10px] text-[var(--muted)]">玩家输入 <span className="mono text-white">!{vote.Command}</span> 发起</p></div><button type="button" onClick={removeVote} title="删除投票" className="grid size-8 place-items-center rounded-md border border-[#6a2930] text-[var(--danger)]"><Trash2 size={14} /></button></div>
        <div className="grid gap-4 sm:grid-cols-2"><TextField label="触发命令（不含 !）" value={vote.Command} onChange={(value) => updateVote({ Command: value })} /><TextField label="命令别名（逗号分隔）" value={vote.CommandAliases.join(", ")} onChange={(value) => updateVote({ CommandAliases: splitList(value) })} /></div>
        <TextField label="投票说明" value={vote.Description} onChange={(value) => updateVote({ Description: value })} />
        <div className="grid gap-4 sm:grid-cols-3"><NumberField label="投票时长（秒）" value={vote.TimeToVote} min={5} max={600} onChange={(value) => updateVote({ TimeToVote: value })} /><NumberField label="最低通过率（-1 为 50%）" value={vote.MinVotePercentage} min={-1} max={100} onChange={(value) => updateVote({ MinVotePercentage: value })} /><SelectField label="显示方式" value={vote.Style} options={[["chat", "聊天栏"], ["center", "屏幕中央"]]} onChange={(value) => updateVote({ Style: value as CustomVote["Style"] })} /></div>
        <div className="border-t border-[var(--line)] pt-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-semibold">投票选项</h3><p className="mt-1 text-[10px] text-[var(--muted)]">获胜后按顺序执行命令，每行一条。</p></div><button type="button" onClick={addOption} className="flex h-8 items-center gap-1 rounded-md border border-[var(--line)] px-2 text-xs text-[var(--muted)] hover:text-white"><Plus size={13} />添加选项</button></div>
          <div className="space-y-3">{Object.entries(vote.Options).map(([name, option]) => <OptionEditor key={name} name={name} text={option.Text} commands={option.Commands} isDefault={vote.DefaultOption === name} canDelete={Object.keys(vote.Options).length > 2} onDefault={() => updateVote({ DefaultOption: name })} onChange={(nextName, text, commands) => updateOption(name, nextName, text, commands)} onDelete={() => removeOption(name)} />)}</div>
        </div>
        <div className="border-t border-[var(--line)] pt-5"><h3 className="text-xs font-semibold">发起权限</h3><div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]"><TextField label="权限标识（逗号分隔，留空为所有人）" value={vote.Permission.Permissions.join(", ")} onChange={(value) => updateVote({ Permission: { ...vote.Permission, Permissions: splitList(value) } })} /><Toggle label="需要满足全部权限" checked={vote.Permission.RequiresAll} onChange={(checked) => updateVote({ Permission: { ...vote.Permission, RequiresAll: checked } })} /></div></div>
      </div> : <div className="grid min-h-[480px] place-items-center text-sm text-[var(--muted)]">选择或新增一个投票</div>}</section>
    </div>
    {confirming && <Confirm title="保存投票配置？" copy="将写入持久配置和运行副本，并让 CounterStrikeSharp 重新读取插件配置。" busy={saving} onCancel={() => setConfirming(false)} onConfirm={() => void save()} />}
    {confirmingBack && <Confirm title="放弃投票草稿？" copy="返回插件中心后，当前未保存内容将无法恢复。" onCancel={() => setConfirmingBack(false)} onConfirm={onBack} confirmLabel="放弃并返回" />}
  </>;
}

function OptionEditor({ name, text, commands, isDefault, canDelete, onDefault, onChange, onDelete }: { name: string; text: string; commands: string[]; isDefault: boolean; canDelete: boolean; onDefault: () => void; onChange: (name: string, text: string, commands: string[]) => void; onDelete: () => void }) {
  const [nextName, setNextName] = useState(name);
  return <div className="rounded-lg border border-[var(--line)] bg-[#11171d] p-3"><div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]"><label className="block text-xs text-[var(--muted)]">选项键<input value={nextName} onChange={(event) => setNextName(event.target.value)} onBlur={() => nextName.trim() ? onChange(nextName.trim(), text, commands) : setNextName(name)} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-white outline-none focus:border-[var(--accent)]" /></label><TextField label="显示文本" value={text} onChange={(value) => onChange(name, value, commands)} /><div className="flex items-end gap-1"><button type="button" onClick={onDefault} title="设为默认选项" className={`grid size-10 place-items-center rounded-lg border ${isDefault ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]"}`}><CheckCircle2 size={15} /></button><button type="button" disabled={!canDelete} onClick={onDelete} title="删除选项" className="grid size-10 place-items-center rounded-lg border border-[#6a2930] text-[var(--danger)] disabled:opacity-30"><Trash2 size={14} /></button></div></div><label className="mt-3 block text-xs text-[var(--muted)]">获胜后执行的命令<textarea value={commands.join("\n")} onChange={(event) => onChange(name, text, event.target.value.split(/\r?\n/).filter(Boolean))} rows={3} className="mono mt-2 w-full resize-y rounded-lg border border-[var(--line)] bg-[#0c1014] p-3 text-xs text-white outline-none focus:border-[var(--accent)]" /></label></div>;
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs text-[var(--muted)]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-white outline-none focus:border-[var(--accent)]" /></label>; }
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) { return <label className="block text-xs text-[var(--muted)]">{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-white outline-none focus:border-[var(--accent)]" /></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) { return <label className="block text-xs text-[var(--muted)]">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[#11171d] px-3 text-white outline-none">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[var(--accent)]" />{label}</label>; }
function Confirm({ title, copy, busy, confirmLabel = "确认保存", onCancel, onConfirm }: { title: string; copy: string; busy?: boolean; confirmLabel?: string; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4a3215] text-[var(--warning)]"><AlertTriangle size={18} /></span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{copy}</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm">取消</button><button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-[var(--warning)] px-4 py-2 text-sm font-semibold text-[#251a08] disabled:opacity-50">{busy ? "正在保存..." : confirmLabel}</button></div></div></div>; }
function splitList(value: string) { return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean); }
