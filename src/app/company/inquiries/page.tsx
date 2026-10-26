import type { Metadata } from "next";
import Link from "next/link";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/forms/confirm-action";
import { PersonAvatar } from "@/components/messaging/avatar";
import { withdrawInquiryAction } from "@/app/company/_actions/relationships";
import { feature, requireCompany } from "@/lib/company/context";
import { relativeTime } from "@/lib/format";
import { INQUIRY_STATUS_LABELS, type CreatorCardInfo, type InquiryStatus } from "@/lib/messaging/types";
import { INQUIRY_TONES } from "@/lib/messaging/inquiry";

export const metadata: Metadata = { title: "Inquiries" };

interface Row {
  id: string; subject: string; status: InquiryStatus; created_at: string; responded_at: string | null;
  conversation_id: string | null; sender: string | null; creator: CreatorCardInfo;
}

export default async function CompanyInquiriesPage() {
  const { supabase, company, permissions, entitlements } = await requireCompany();
  if (!permissions.has("inquiries.view")) {
    return <Alert tone="warning">Your role doesn&apos;t include viewing inquiries.</Alert>;
  }
  const { data } = await supabase.rpc("company_inquiries", { p_company_id: company.id });
  const rows = (data ?? []) as Row[];
  const limit = feature(entitlements, "contacts.monthly").limit;
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const used = new Set(rows.filter((r) => r.created_at >= monthStart).map((r) => r.creator.id)).size;

  return (
    <>
      <PageHeader title="Inquiries"
        description={limit === null ? `${used} new creators contacted this month` : `${used} of ${limit} new creators contacted this month`}
        action={<ButtonLink href="/company/search" size="sm">Find creators</ButtonLink>} />
      {company.status !== "approved" && (
        <Alert tone="warning" className="mb-6">You can send inquiries once TalentLoom approves your company.</Alert>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Send} title="No inquiries yet"
          description="Open a creator's profile from search and send a representation inquiry. They'll see your company profile with it." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <PersonAvatar name={r.creator.display_name} path={r.creator.avatar_path} />
              <div className="min-w-0 flex-1">
                <Link href={`/company/creators/${r.creator.id}`} className="font-medium text-ink hover:underline">{r.creator.display_name}</Link>
                <p className="truncate text-sm text-muted">{r.subject} · by {r.sender ?? "a teammate"} · {relativeTime(r.created_at)}</p>
              </div>
              <Badge tone={INQUIRY_TONES[r.status]}>{INQUIRY_STATUS_LABELS[r.status]}</Badge>
              {r.status === "accepted" && r.conversation_id && (
                <Link href={`/company/messages/${r.conversation_id}`} className="text-sm font-medium text-primary hover:underline">Message</Link>
              )}
              {(r.status === "sent" || r.status === "viewed") && permissions.has("inquiries.send") && (
                <ActionButton action={withdrawInquiryAction.bind(null, r.id)} tone="danger" confirm="Click again to withdraw">Withdraw</ActionButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
