import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/70 " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary " +
  "disabled:bg-canvas disabled:text-muted";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-medium text-ink", className)} {...props} />;
}

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(control, "h-11", invalid ? "border-danger" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(control, "min-h-28 py-2.5", invalid ? "border-danger" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-danger-strong">
      {children}
    </p>
  );
}

/** Label + control + hint + error, wired together for screen readers. */
export function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}

export function Checkbox({
  name,
  children,
  error,
  defaultChecked,
}: {
  name: string;
  children: ReactNode;
  error?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className="mt-1 size-4 shrink-0 rounded border-line-strong accent-primary"
        />
        <span>{children}</span>
      </label>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}
