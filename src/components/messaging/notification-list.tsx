import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/forms/confirm-action";
import { markAllNotificationsReadAction } from "@/app/_actions/messaging";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

interface Row { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

export async function NotificationList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];
  const unread = rows.filter((r) => !r.read_at).length;

  if (rows.length === 0) {
    return <EmptyState icon={Bell} title="You're all caught up" description="Inquiries, replies and account updates will show up here." />;
  }
  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <ActionButton action={markAllNotificationsReadAction}>Mark all as read</ActionButton>
        </div>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {rows.map((n) => {
          const inner = (
            <>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[15px]", n.read_at ? "text-ink/80" : "font-semibold text-ink")}>{n.title}</span>
                {n.body && <span className="block text-sm text-muted">{n.body}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">{relativeTime(n.created_at)}</span>
              {!n.read_at && <span className="sr-only">(unread)</span>}
            </>
          );
          return (
            <li key={n.id}>
              {n.link ? (
                <a href={`/notifications/${n.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-canvas">{inner}</a>
              ) : (
                <div className="flex items-start gap-3 px-4 py-3.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
