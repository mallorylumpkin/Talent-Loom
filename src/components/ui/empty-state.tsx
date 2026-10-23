import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** An invitation, not an apology: name the space, say what goes here, offer the next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
