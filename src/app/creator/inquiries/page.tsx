import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CompanyLogo } from "@/components/messaging/avatar";
import { getCreatorContext } from "@/lib/creator/context";
import { relativeTime } from "@/lib/format";
import { INQUIRY_STATUS_LABELS } from "@/lib/messaging/types";
import { INQUIRY_TONES, type CreatorInquiry } from "@/lib/messaging/inquiry";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Inquiries" };

export default async function CreatorInquiriesPage() {
  const { supabase, creator } = await getCreatorContext();
  const { data } = await supabase.rpc("my_inquiries");
  const items = (data ?? []) as CreatorInquiry[];

  return (
    <>
      <PageHeader title="Inquiries"
        description="Management companies that want to talk with you about representation. Nothing is shared until you accept." />
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="No inquiries yet"
          description={creator.is_discoverable
            ? "Approved companies can find you in search. A complete profile with verified numbers gets noticed faster."
            : "Turn on discoverability so approved management companies can find and contact you."}
          action={<Link href={creator.is_discoverable ? "/creator/profile" : "/creator/privacy"} className="font-medium text-primary hover:underline">
            {creator.is_discoverable ? "Improve your profile" : "Privacy & discoverability"}</Link>} />
      ) : (
        <ul className="max-w-3xl divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/creator/inquiries/${i.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-canvas">
                <CompanyLogo path={i.company.logo_path} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5">
                    <span className={cn("truncate text-ink", i.status === "sent" ? "font-semibold" : "font-medium")}>{i.company.name}</span>
                    {i.company.is_verified_badge && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified company" />}
                  </p>
                  <p className="truncate text-sm text-muted">{i.subject}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={INQUIRY_TONES[i.status]}>{INQUIRY_STATUS_LABELS[i.status]}</Badge>
                  <span className="text-xs text-muted">{relativeTime(i.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
