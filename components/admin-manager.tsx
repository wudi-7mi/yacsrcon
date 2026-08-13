"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Plus,
  Save,
  UserPlus,
} from "lucide-react";
import {
  AddAdminDialog,
  AdminRow,
  ConfirmDialog,
  GroupRow,
  TabButton,
} from "@/components/admin/editor-components";
import {
  createGroup,
  deleteAdmin,
  deleteGroup,
  findDuplicateIdentities,
  renameGroup,
  updateAdmin,
  updateGroup,
} from "@/lib/admin-editor";
import { useApiRequest } from "@/hooks/use-api-request";
import { ApiError } from "@/lib/api-client";
import type {
  AdminConfiguration,
  Player,
} from "@/lib/types";

type Notice = { tone: "success" | "error"; text: string };
const emptyConfig: AdminConfiguration = {
  admins: {},
  groups: {},
  overrides: {},
};

export default function AdminManager({
  players,
  onDirtyChange,
  onDraftChange,
  onUnauthorized,
}: {
  players: Player[];
  onDirtyChange?: (dirty: boolean) => void;
  onDraftChange?: (draft: AdminConfiguration | null) => void;
  onUnauthorized?: () => void;
}) {
  const request = useApiRequest(onUnauthorized);
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
      const body = await request<AdminConfiguration>("/api/admins", {
        cache: "no-store",
      });
      setConfig(body);
      setBaseline(JSON.stringify(body));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const dirty = baseline !== "" && JSON.stringify(config) !== baseline;
  const duplicateIdentities = useMemo(
    () => findDuplicateIdentities(config),
    [config],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onDraftChange?.(dirty ? config : null);
    return () => onDraftChange?.(null);
  }, [config, dirty, onDraftChange]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const body = await request<{ reloadWarning?: string }>("/api/admins", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
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
      if (error instanceof ApiError && error.status === 401) return;
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  }

  function renameAdminGroup(previous: string, next: string) {
    const renamed = renameGroup(config, previous, next);
    if (!renamed) return false;
    setConfig(renamed);
    setEditingGroup(next.trim());
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
                onChange={(value) =>
                  setConfig((current) => updateAdmin(current, name, value))
                }
                onDelete={() => {
                  setConfig((current) => deleteAdmin(current, name));
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
                const created = createGroup(config);
                setConfig(created.config);
                setEditingGroup(created.name);
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
                onChange={(value) =>
                  setConfig((current) => updateGroup(current, name, value))
                }
                onRename={(value) => renameAdminGroup(name, value)}
                onDelete={() => {
                  setConfig((current) => deleteGroup(current, name) ?? current);
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
            setConfig((current) => updateAdmin(current, name, admin));
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
