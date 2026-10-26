import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import type { Conversation } from "@/lib/messaging/types";
import { Composer, ScrollToEnd } from "./thread-client";

/** Message thread for either side. Messages are plain text (never rendered as HTML). */
export function Thread({ conversation }: { conversation: Conversation }) {
  const c = conversation;
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <ol className="max-h-[60vh] min-h-64 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-label="Messages" id="thread">
        {c.messages.map((m, i) => {
          const prev = c.messages[i - 1];
          const showName = !m.mine && (!prev || prev.from_creator !== m.from_creator || prev.sender_name !== m.sender_name);
          const name = m.from_creator ? c.creator.display_name : `${m.sender_name ?? "Team member"} · ${c.company.name}`;
          return (
            <li key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
              {showName && <span className="mb-1 px-1 text-xs font-medium text-muted">{name}</span>}
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap break-words",
                m.mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-canvas text-ink")}>
                {m.body ?? <em className="opacity-70">Message removed</em>}
              </div>
              <time className="mt-1 px-1 text-[11px] text-muted" dateTime={m.created_at}>{dateTime(m.created_at)}</time>
            </li>
          );
        })}
      </ol>
      <ScrollToEnd count={c.messages.length} />
      <div className="border-t border-line p-3 sm:p-4">
        {c.can_send ? (
          <Composer conversationId={c.id} />
        ) : (
          <p className="text-center text-sm text-muted">
            {c.blocked
              ? c.viewer_is_creator ? "You blocked this company. Unblock them to keep talking." : "This conversation is no longer available."
              : c.status === "closed" ? "This conversation is closed."
              : "You can't send messages in this conversation."}
          </p>
        )}
      </div>
    </div>
  );
}
