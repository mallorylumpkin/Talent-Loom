import Link from "next/link";
import { cn } from "@/lib/cn";

export function InboxTabs({ base, archived, archivedCount }: { base: string; archived: boolean; archivedCount: number }) {
  const tab = (active: boolean) => cn("rounded-lg px-3 py-1.5 text-sm font-medium", active ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-ink/5");
  return (
    <nav aria-label="Inbox views" className="flex gap-1">
      <Link href={base} className={tab(!archived)} aria-current={!archived ? "page" : undefined}>Inbox</Link>
      <Link href={`${base}?view=archived`} className={tab(archived)} aria-current={archived ? "page" : undefined}>
        Archived{archivedCount ? ` (${archivedCount})` : ""}
      </Link>
    </nav>
  );
}
