import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, MapPin, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ActionButton } from "@/components/forms/confirm-action";
import { CompanyLogo } from "@/components/messaging/avatar";
import { ReportButton } from "@/components/messaging/report-form";
import { blockCompanyAction, respondInquiryAction } from "@/app/creator/_actions/inquiries";
import { getCreatorContext } from "@/lib/creator/context";
import { countryName } from "@/lib/countries";
import { dateTime } from "@/lib/format";
import { INQUIRY_STATUS_LABELS } from "@/lib/messaging/types";
import { INQUIRY_TONES, type CreatorInquiry } from "@/lib/messaging/inquiry";

export const metadata: Metadata = { title: "Inquiry" };

export default async function CreatorInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getCreatorContext();
  const { data } = await supabase.rpc("my_inquiries");
  const inquiry = ((data ?? []) as CreatorInquiry[]).find((i) => i.id === id);
  if (!inquiry) notFound();
  if (inquiry.status === "sent") await supabase.rpc("mark_inquiry_viewed", { p_inquiry_id: id });

  const c = inquiry.company;
  const location = [c.city, c.region, countryName(c.country)].filter(Boolean).join(", ");
  const open = inquiry.status === "sent" || inquiry.status === "viewed";

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/creator/inquiries" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Inquiries
      </Link>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <CompanyLogo path={c.logo_path} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-display text-xl font-semibold text-ink">
              {c.name}
              {c.is_verified_badge && <BadgeCheck className="size-5 text-primary" aria-label="Verified company" />}
            </p>
            {location && <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" aria-hidden />{location}</p>}
            {c.specialties.length > 0 && <p className="mt-1 text-sm text-muted">{c.specialties.slice(0, 4).join(" · ")}</p>}
          </div>
          <Link href={`/companies/${c.slug}`} className="text-sm font-medium text-primary hover:underline">View company profile</Link>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-ink">{inquiry.subject}</h1>
            <Badge tone={INQUIRY_TONES[inquiry.status]}>{INQUIRY_STATUS_LABELS[inquiry.status]}</Badge>
          </div>
          <p className="text-xs text-muted">Received {dateTime(inquiry.created_at)}</p>
          <p className="leading-7 whitespace-pre-wrap text-ink/90">{inquiry.body}</p>
        </CardBody>
      </Card>

      {open && (
        <Card>
          <CardBody className="space-y-4">
            <p className="flex gap-2 text-sm text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              Accepting only opens a conversation on TalentLoom. Your email and contact details stay private unless you share them.
              You&apos;re never obligated to sign anything.
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton action={respondInquiryAction.bind(null, inquiry.id, true)} tone="primary"
                className="h-10 bg-primary px-4 text-white hover:bg-primary-strong hover:text-white">Accept and start a conversation</ActionButton>
              <ActionButton action={respondInquiryAction.bind(null, inquiry.id, false)} tone="danger" confirm="Click again to decline">Decline</ActionButton>
            </div>
          </CardBody>
        </Card>
      )}

      {inquiry.status === "accepted" && inquiry.conversation_id && (
        <Alert tone="success" title="You accepted this inquiry">
          <ButtonLink href={`/creator/messages/${inquiry.conversation_id}`} size="sm" className="mt-2">Open conversation</ButtonLink>
        </Alert>
      )}
      {inquiry.status === "declined" && <Alert tone="info">You declined this inquiry. The company can&apos;t contact you again for 30 days.</Alert>}

      <div className="flex flex-wrap items-start gap-2 border-t border-line pt-4">
        <ActionButton action={blockCompanyAction.bind(null, c.id)} tone="danger" confirm="Click again to block this company">
          Block company
        </ActionButton>
        <ReportButton targetType="company" targetId={c.id} label="Report company" />
      </div>
    </div>
  );
}
