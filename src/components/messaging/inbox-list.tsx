import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import type { InboxItem } from "@/lib/messaging/types";
import { CompanyLogo, PersonAvatar } from "./avatar";

/** Conversation list for either side. `side` decides whose name is shown. */
export function InboxList({ items, side, basePath, showArchived }: {
  items: InboxItem[]; side: "creator" | "company"; basePath: string; showArchived: boolean;
}) {
  const visible = items.filter((i) => i.archived === showArchived);
  if (visible.length === 0) {
    return showArchived ? (
      <p className="py-8 text-center text-sm text-muted">No archived conversations.</p>
    ) : (
      <EmptyState icon={MessageCircle} title="No conversations yet"
        description={side === "creator"
          ? "When you accept a company's inquiry, your conversation with them appears here."
          : "When a creator accepts your inquiry, your conversation with them appears here."} />
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {visible.map((c) => {
        const name = side === "creator" ? c.company.name : c.creator.display_name;
        return (
          <li key={c.id}>
            <Link href={`${basePath}/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas">
              {side === "creator" ? <CompanyLogo path={c.company.logo_path} /> : <PersonAvatar name={name} path={c.creator.avatar_path} />}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className={cn("truncate text-ink", c.unread > 0 ? "font-semibold" : "font-medium")}>{name}</span>
                  {c.blocked && <Badge tone="danger">Blocked</Badge>}
                  {c.status === "closed" && <Badge>Closed</Badge>}
                </p>
                <p className={cn("truncate text-sm", c.unread > 0 ? "text-ink" : "text-muted")}>
                  {c.last ? `${c.last.mine ? "You: " : ""}${c.last.body}` : "No messages yet"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted">{relativeTime(c.last_message_at)}</span>
                {c.unread > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white" aria-label={`${c.unread} unread`}>
                    {c.unread}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
