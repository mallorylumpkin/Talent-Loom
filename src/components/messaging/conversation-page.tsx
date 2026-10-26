import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft } from "lucide-react";
import { ActionButton } from "@/components/forms/confirm-action";
import { setArchivedAction } from "@/app/_actions/messaging";
import { blockCompanyAction, unblockCompanyAction } from "@/app/creator/_actions/inquiries";
import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/lib/messaging/types";
import { CompanyLogo, PersonAvatar } from "./avatar";
import { LiveRefresh } from "./live-refresh";
import { ReportButton } from "./report-form";
import { Thread } from "./thread";

/** Full conversation view, shared by creators and companies. */
export async function ConversationView({ id, side }: { id: string; side: "creator" | "company" }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_conversation", { p_conversation_id: id });
  if (error || !data) notFound();
  const c = data as Conversation;
  if (c.viewer_is_creator !== (side === "creator")) notFound();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: id });

  const base = side === "creator" ? "/creator/messages" : "/company/messages";
  return (
    <div className="max-w-3xl space-y-4">
      <LiveRefresh table="messages" filter={`conversation_id=eq.${c.id}`} channel={`messages:${c.id}`} />
      <Link href={base} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Messages
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        {side === "creator" ? <CompanyLogo path={c.company.logo_path} /> : <PersonAvatar name={c.creator.display_name} path={c.creator.avatar_path} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold text-ink">
            {side === "creator" ? c.company.name : c.creator.display_name}
          </h1>
          {side === "creator" ? (
            <Link href={`/companies/${c.company.slug}`} className="text-sm text-primary hover:underline">Company profile</Link>
          ) : (
            <Link href={`/company/creators/${c.creator.id}`} className="text-sm text-primary hover:underline">
              {c.creator.handle ? `@${c.creator.handle}` : "Creator profile"}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ActionButton action={setArchivedAction.bind(null, c.id, !c.archived)}>
            {c.archived ? <><ArchiveRestore className="size-3.5" aria-hidden /> Move to inbox</> : <><Archive className="size-3.5" aria-hidden /> Archive</>}
          </ActionButton>
          {side === "creator" && (c.blocked ? (
            <ActionButton action={unblockCompanyAction.bind(null, c.company_id)}>Unblock</ActionButton>
          ) : (
            <ActionButton action={blockCompanyAction.bind(null, c.company_id)} tone="danger" confirm="Click again to block">Block</ActionButton>
          ))}
          <ReportButton targetType="conversation" targetId={c.id} />
        </div>
      </div>
      <Thread conversation={c} />
    </div>
  );
}
