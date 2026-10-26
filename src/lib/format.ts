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

/** "just now", "5m ago", "3h ago", "Yesterday", then a short date. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "Yesterday";
  return shortDate(iso);
}

/** Date and time, e.g. "Oct 26, 2026, 11:24 AM". */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
