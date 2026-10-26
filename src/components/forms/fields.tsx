"use client";

import type { ReactNode } from "react";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { useFieldError } from "./action-form";

export const selectClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink " +
  "focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none";

function Hint({ children }: { children?: ReactNode }) {
  return children ? <p className="text-sm text-muted">{children}</p> : null;
}

export function TextField({
  name, label, defaultValue, hint, type = "text", placeholder, required, autoComplete, inputMode, maxLength, prefix,
}: {
  name: string; label: ReactNode; defaultValue?: string | number | null; hint?: ReactNode; type?: string;
  placeholder?: string; required?: boolean; autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; maxLength?: number; prefix?: string;
}) {
  const error = useFieldError(name);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}{required && <span className="text-accent-strong"> *</span>}</Label>
      <div className={cn(prefix && "flex items-stretch")}>
        {prefix && (
          <span className="inline-flex items-center rounded-l-xl border border-r-0 border-line bg-canvas px-3 text-[15px] text-muted">
            {prefix}
          </span>
        )}
        <Input id={name} name={name} type={type} defaultValue={defaultValue ?? undefined} placeholder={placeholder}
          autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined} className={cn(prefix && "rounded-l-none")} />
      </div>
      {!error && <Hint>{hint}</Hint>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}

export function TextAreaField({
  name, label, defaultValue, hint, rows = 4, maxLength, placeholder,
}: {
  name: string; label: ReactNode; defaultValue?: string | null; hint?: ReactNode; rows?: number; maxLength?: number; placeholder?: string;
}) {
  const error = useFieldError(name);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? undefined} maxLength={maxLength}
        placeholder={placeholder} invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} />
      {!error && <Hint>{hint}</Hint>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}

export function SelectField({
  name, label, defaultValue, options, hint, placeholder,
}: {
  name: string; label: ReactNode; defaultValue?: string | null; hint?: ReactNode; placeholder?: string;
  options: { value: string; label: string }[];
}) {
  const error = useFieldError(name);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue ?? ""} className={cn(selectClass, error && "border-danger")}
        aria-invalid={!!error || undefined}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!error && <Hint>{hint}</Hint>}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}

/** Pill-style multi-select checkboxes for option lists like niches. */
export function CheckboxPills({
  name, label, options, defaultValues = [], hint,
}: {
  name: string; label: ReactNode; options: { id: string; label: string }[]; defaultValues?: string[]; hint?: ReactNode;
}) {
  const error = useFieldError(name);
  const selected = new Set(defaultValues);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((o) => (
          <label key={o.id} className="cursor-pointer">
            <input type="checkbox" name={name} value={o.id} defaultChecked={selected.has(o.id)} className="peer sr-only" />
            <span className="inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink/80 transition-colors
              peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary-strong peer-focus-visible:outline-2 peer-focus-visible:outline-primary
              hover:border-line-strong">
              {o.label}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </fieldset>
  );
}

export function RadioCards({
  name, label, options, defaultValue,
}: {
  name: string; label?: ReactNode; defaultValue?: string; options: { value: string; label: string; hint?: string }[];
}) {
  const error = useFieldError(name);
  return (
    <fieldset className="space-y-2">
      {label && <legend className="text-sm font-medium text-ink">{label}</legend>}
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} className="peer sr-only" />
            <span className="block h-full rounded-xl border border-line bg-surface px-4 py-3 transition-colors
              peer-checked:border-primary peer-checked:bg-primary-soft peer-focus-visible:outline-2 peer-focus-visible:outline-primary hover:border-line-strong">
              <span className="block text-sm font-medium text-ink">{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-xs text-muted">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </fieldset>
  );
}

export function SwitchField({
  name, label, description, defaultChecked,
}: {
  name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean;
}) {
  const error = useFieldError(name);
  return (
    <div>
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-ink">{label}</span>
          {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
        </span>
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" role="switch" />
          <span className="h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" />
          <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}

export function ConsentCheckbox({ name, children }: { name: string; children: ReactNode }) {
  const error = useFieldError(name);
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-canvas p-4 text-sm leading-6 text-ink">
        <input type="checkbox" name={name} className="mt-1 size-4 shrink-0 accent-primary"
          aria-invalid={!!error || undefined} />
        <span>{children}</span>
      </label>
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </div>
  );
}
