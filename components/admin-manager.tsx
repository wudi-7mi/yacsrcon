"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Plus,
  Save,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { CSS_PERMISSIONS } from "@/lib/admin-permissions";
import { toSteamId64 } from "@/lib/steam-id";
import type {
  AdminConfiguration,
  CssAdmin,
  CssAdminGroup,
  Player,
} from "@/lib/types";

type Notice = { tone: "success" | "error"; text: string };
const emptyConfig: AdminConfiguration = {
  admins: {},
  groups: {},
  overrides: {},
};

export default function AdminManager({ players }: { players: Player[] }) {
  const [config, setConfig] = useState<AdminConfiguration>(emptyConfig);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [section, setSection] = useState<"admins" | "groups">("admins");
  const [editingAdmin, setEditingAdmin] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admins", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "读取管理员配置失败");
      setConfig(body);
      setBaseline(JSON.stringify(body));
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const dirty = baseline !== "" && JSON.stringify(config) !== baseline;
  const duplicateIdentities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const admin of Object.values(config.admins)) {
      counts.set(admin.identity, (counts.get(admin.identity) ?? 0) + 1);
    }
    return new Set(
      [...counts].filter(([, count]) => count > 1).map(([id]) => id),
    );
  }, [config.admins]);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admins", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "保存管理员配置失败");
      setBaseline(JSON.stringify(config));
      setConfirmSave(false);
      setNotice({
        tone: body.reloadWarning ? "error" : "success",
        text: body.reloadWarning
          ? `配置已保存，但管理员重载失败：${body.reloadWarning}`
          : "配置已保存并通知 CounterStrikeSharp 重新加载。",
      });
    } catch (error) {
      setConfirmSave(false);
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  }

  function updateAdmin(name: string, admin: CssAdmin) {
    setConfig((current) => ({
      ...current,
      admins: { ...current.admins, [name]: admin },
    }));
  }

  function updateGroup(name: string, group: CssAdminGroup) {
    setConfig((current) => ({
      ...current,
      groups: { ...current.groups, [name]: group },
    }));
  }

  function renameGroup(previous: string, next: string) {
    const name = next.trim();
    if (
      name === previous ||
      !/^#[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(name) ||
      config.groups[name]
    ) {
      return false;
    }
    setConfig((current) => {
      const groups: AdminConfiguration["groups"] = {};
      for (const [groupName, group] of Object.entries(current.groups)) {
        groups[groupName === previous ? name : groupName] = group;
      }
      const admins = Object.fromEntries(
        Object.entries(current.admins).map(([adminName, admin]) => [
          adminName,
          {
            ...admin,
            groups: admin.groups?.map((group) =>
              group === previous ? name : group,
            ),
          },
        ]),
      );
      return { ...current, groups, admins };
    });
    setEditingGroup(name);
    return true;
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-[var(--muted)]">
            服务器管理 / 管理员与权限
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            游戏管理员与权限
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            管理 CounterStrikeSharp 管理员、权限组和免疫等级。
          </p>
        </div>
        <button
          type="button"
          disabled={!dirty || saving || duplicateIdentities.size > 0}
          onClick={() => setConfirmSave(true)}
          className="flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[#15200d] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={16} /> 保存更改
        </button>
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${notice.tone === "success" ? "border-[#3c6521] bg-[#172513] text-[var(--accent)]" : "border-[#6a2930] bg-[#29161a] text-[var(--danger)]"}`}
        >
          {notice.tone === "success" ? (
            <Check size={17} />
          ) : (
            <AlertTriangle size={17} />
          )}
          <span>{notice.text}</span>
        </div>
      )}
      {dirty && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#5d4925] bg-[#251e12] px-4 py-3 text-xs text-[var(--warning)]">
          <span>有尚未保存的更改</span>
          <button
            type="button"
            onClick={() => void load()}
            className="text-white"
          >
            放弃更改
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-[var(--line)]">
        <TabButton
          active={section === "admins"}
          onClick={() => setSection("admins")}
        >
          管理员 {Object.keys(config.admins).length}
        </TabButton>
        <TabButton
          active={section === "groups"}
          onClick={() => setSection("groups")}
        >
          权限组 {Object.keys(config.groups).length}
        </TabButton>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--muted)]">
          正在读取管理员配置...
        </div>
      ) : section === "admins" ? (
        <section>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs hover:border-[var(--accent)]"
            >
              <UserPlus size={15} /> 添加管理员
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(config.admins).map(([name, admin]) => (
              <AdminRow
                key={name}
                name={name}
                admin={admin}
                groups={Object.keys(config.groups)}
                expanded={editingAdmin === name}
                duplicate={duplicateIdentities.has(admin.identity)}
                onToggle={() =>
                  setEditingAdmin(editingAdmin === name ? null : name)
                }
                onChange={(value) => updateAdmin(name, value)}
                onDelete={() => {
                  setConfig((current) => {
                    const admins = { ...current.admins };
                    delete admins[name];
                    return { ...current, admins };
                  });
                  setEditingAdmin(null);
                }}
              />
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                let index = 1;
                let name = "#custom/group";
                while (config.groups[name]) name = `#custom/group-${++index}`;
                setConfig((current) => ({
                  ...current,
                  groups: {
                    ...current.groups,
                    [name]: { flags: [], immunity: 0 },
                  },
                }));
                setEditingGroup(name);
              }}
              className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs hover:border-[var(--accent)]"
            >
              <Plus size={15} /> 新建权限组
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(config.groups).map(([name, group]) => (
              <GroupRow
                key={name}
                name={name}
                group={group}
                expanded={editingGroup === name}
                inUse={Object.values(config.admins).some((admin) =>
                  admin.groups?.includes(name),
                )}
                onToggle={() =>
                  setEditingGroup(editingGroup === name ? null : name)
                }
                onChange={(value) => updateGroup(name, value)}
                onRename={(value) => renameGroup(name, value)}
                onDelete={() => {
                  setConfig((current) => {
                    const groups = { ...current.groups };
                    delete groups[name];
                    return { ...current, groups };
                  });
                  setEditingGroup(null);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {addOpen && (
        <AddAdminDialog
          players={players}
          groups={Object.keys(config.groups)}
          existingNames={new Set(Object.keys(config.admins))}
          existingIds={
            new Set(Object.values(config.admins).map((admin) => admin.identity))
          }
          onClose={() => setAddOpen(false)}
          onAdd={(name, admin) => {
            updateAdmin(name, admin);
            setEditingAdmin(name);
            setAddOpen(false);
          }}
        />
      )}
      {confirmSave && (
        <ConfirmDialog
          saving={saving}
          onCancel={() => setConfirmSave(false)}
          onConfirm={() => void save()}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-sm ${active ? "border-[var(--accent)] text-white" : "border-transparent text-[var(--muted)]"}`}
    >
      {children}
    </button>
  );
}

function AdminRow({
  name,
  admin,
  groups,
  expanded,
  duplicate,
  onToggle,
  onChange,
  onDelete,
}: {
  name: string;
  admin: CssAdmin;
  groups: string[];
  expanded: boolean;
  duplicate: boolean;
  onToggle: () => void;
  onChange: (value: CssAdmin) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-[var(--panel)] ${duplicate ? "border-[var(--danger)]" : "border-[var(--line)]"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--panel-soft)] text-[var(--accent)]">
          <Shield size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="mono mt-1 block text-[10px] text-[var(--muted)]">
            {admin.identity}
          </span>
        </span>
        <span className="hidden text-xs text-[var(--muted)] sm:block">
          {admin.groups?.join(", ") || "直接授权"}
        </span>
        <ChevronDown
          size={16}
          className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-[var(--line)] p-4">
          {duplicate && (
            <p className="mb-3 text-xs text-[var(--danger)]">
              此 SteamID64 已被其他管理员使用。
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SteamID64">
              <input
                value={admin.identity}
                onChange={(event) =>
                  onChange({ ...admin, identity: event.target.value.trim() })
                }
                className="form-input mono"
              />
            </Field>
            <Field label="个人免疫等级">
              <input
                type="number"
                min="0"
                max="999"
                value={admin.immunity ?? ""}
                placeholder="继承权限组"
                onChange={(event) =>
                  onChange({
                    ...admin,
                    immunity:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
                className="form-input"
              />
            </Field>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs text-[var(--muted)]">所属权限组</p>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <CheckOption
                  key={group}
                  checked={admin.groups?.includes(group) ?? false}
                  label={group}
                  onChange={(checked) =>
                    onChange({
                      ...admin,
                      groups: checked
                        ? [...(admin.groups ?? []), group]
                        : (admin.groups ?? []).filter((item) => item !== group),
                    })
                  }
                />
              ))}
            </div>
          </div>
          <FlagEditor
            className="mt-4"
            flags={admin.flags ?? []}
            label="个人附加权限"
            onChange={(flags) =>
              onChange({ ...admin, flags: flags.length ? flags : undefined })
            }
          />
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 text-xs text-[var(--danger)]"
            >
              <Trash2 size={14} /> 删除管理员
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRow({
  name,
  group,
  expanded,
  inUse,
  onToggle,
  onChange,
  onRename,
  onDelete,
}: {
  name: string;
  group: CssAdminGroup;
  expanded: boolean;
  inUse: boolean;
  onToggle: () => void;
  onChange: (value: CssAdminGroup) => void;
  onRename: (name: string) => boolean;
  onDelete: () => void;
}) {
  const [nameDraft, setNameDraft] = useState(name);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid size-9 place-items-center rounded-lg bg-[var(--panel-soft)] text-[var(--accent)]">
          <Shield size={16} />
        </span>
        <span className="mono min-w-0 flex-1 truncate text-sm">{name}</span>
        <span className="text-xs text-[var(--muted)]">
          {group.flags.length} 项权限 · 免疫 {group.immunity ?? 0}
        </span>
        <ChevronDown
          size={16}
          className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-[var(--line)] p-4">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="权限组名称">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  if (!onRename(nameDraft)) setNameDraft(name);
                }}
                className="form-input mono"
              />
            </Field>
            <Field label="免疫等级">
              <input
                type="number"
                min="0"
                max="999"
                value={group.immunity ?? 0}
                onChange={(event) =>
                  onChange({ ...group, immunity: Number(event.target.value) })
                }
                className="form-input"
              />
            </Field>
          </div>
          <FlagEditor
            className="mt-4"
            flags={group.flags}
            label="权限"
            onChange={(flags) => onChange({ ...group, flags })}
          />
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={inUse}
              onClick={onDelete}
              title={inUse ? "仍有管理员使用此权限组" : "删除权限组"}
              className="flex items-center gap-2 text-xs text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Trash2 size={14} /> 删除权限组
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlagEditor({
  flags,
  label,
  onChange,
  className = "",
}: {
  flags: string[];
  label: string;
  onChange: (flags: string[]) => void;
  className?: string;
}) {
  const known = new Set(CSS_PERMISSIONS.map((item) => item.flag));
  const custom = flags.filter((item) => !known.has(item as never));
  return (
    <div className={className}>
      <p className="mb-2 text-xs text-[var(--muted)]">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {CSS_PERMISSIONS.map((permission) => (
          <CheckOption
            key={permission.flag}
            checked={flags.includes(permission.flag)}
            label={permission.label}
            hint={permission.flag}
            onChange={(checked) =>
              onChange(
                checked
                  ? [...flags, permission.flag]
                  : flags.filter((item) => item !== permission.flag),
              )
            }
          />
        ))}
      </div>
      <Field label="自定义权限（每行一个）" className="mt-3">
        <textarea
          rows={3}
          value={custom.join("\n")}
          onChange={(event) => {
            const next = event.target.value
              .split(/\s+/)
              .map((item) => item.trim())
              .filter(Boolean);
            onChange([
              ...flags.filter((item) => known.has(item as never)),
              ...next,
            ]);
          }}
          className="form-input mono resize-y"
          placeholder="@custom/prac"
        />
      </Field>
    </div>
  );
}

function CheckOption({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${checked ? "border-[#3c6521] bg-[#172513]" : "border-[var(--line)] bg-[#11171d]"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[#8ee64a]"
      />
      <span className="min-w-0 text-xs">
        <span className="block">{label}</span>
        {hint && (
          <span className="mono mt-0.5 block truncate text-[9px] text-[var(--muted)]">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function AddAdminDialog({
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

function ConfirmDialog({
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
