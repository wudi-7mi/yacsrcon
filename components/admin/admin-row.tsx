import { ChevronDown, Shield, Trash2 } from "lucide-react";
import {
  CheckOption,
  Field,
  FlagEditor,
} from "@/components/admin/editor-primitives";
import type { CssAdmin } from "@/lib/types";

export function AdminRow({
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
