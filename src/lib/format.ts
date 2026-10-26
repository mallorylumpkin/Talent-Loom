export function compactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function percent(n: number | null | undefined, signed = false): string {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  const s = `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  return signed && v > 0 ? `+${s}` : s;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const representationLabels: Record<string, string> = {
  unrepresented: "Not currently represented",
  represented: "Currently represented",
  open_to_switch: "Represented, open to switching",
};
