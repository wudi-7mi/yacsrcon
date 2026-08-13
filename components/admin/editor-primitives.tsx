import { CSS_PERMISSIONS } from "@/lib/admin-permissions";

export function TabButton({
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

export function FlagEditor({
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

export function CheckOption({
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

export function Field({
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
