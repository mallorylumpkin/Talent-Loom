import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { ProUpsell } from "@/components/creator/pro-gate";
import { getCreatorContext } from "@/lib/creator/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Profile insights" };

export default async function InsightsPage() {
  const { supabase, creator } = await getCreatorContext();
  const { data } = await supabase.rpc("my_profile_insights");
  const d = (data ?? { locked: true, views_30d: 0 }) as { locked: boolean; views_30d: number; viewers?: { name: string; slug: string; last: string }[];
    savers?: { name: string; slug: string }[]; inquiries_total?: number };
  return (
    <>
      <PageHeader title="Profile insights" description="How management companies are finding you." />
      {d.locked && <ProUpsell what="Seeing which companies viewed and saved you" />}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Company views, last 30 days" value={d.views_30d} />
        <StatTile label="All-time company views" value={creator.profile_views_count} />
        <StatTile label="Inquiries received" value={d.inquiries_total ?? "—"} />
      </div>
      {!d.locked && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Companies that viewed you" description="Last 90 days, approved companies only" />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {d.viewers?.map((v) => <li key={v.slug} className="flex justify-between"><Link href={`/companies/${v.slug}`} className="text-primary hover:underline">{v.name}</Link><span className="text-muted">{shortDate(v.last)}</span></li>)}
                {!d.viewers?.length && <li className="text-muted">No views yet.</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Companies that saved you" description="Shared team lists only" />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {d.savers?.map((v) => <li key={v.slug}><Link href={`/companies/${v.slug}`} className="text-primary hover:underline">{v.name}</Link></li>)}
                {!d.savers?.length && <li className="text-muted">Not saved yet.</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
