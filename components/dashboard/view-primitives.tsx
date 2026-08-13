import type { LucideIcon } from "lucide-react";

export function PageTitle({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-[var(--muted)]">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{copy}</p>
    </div>
  );
}

export function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="grid place-items-center gap-2 py-12 text-center text-sm text-[var(--muted)]">
      <Icon size={22} />
      {text}
    </div>
  );
}
