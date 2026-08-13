"use client";

import { useState } from "react";
import { ChevronDown, Shield, Trash2 } from "lucide-react";
import { Field, FlagEditor } from "@/components/admin/editor-primitives";
import type { CssAdminGroup } from "@/lib/types";

export function GroupRow({
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
