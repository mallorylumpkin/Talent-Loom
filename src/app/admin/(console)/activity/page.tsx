import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin/context";
import { dateTime } from "@/lib/format";
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/lib/messaging/types";

export const metadata: Metadata = { title: "Inquiries & blocks" };

export default async function ActivityPage() {
  const { supabase } = await getAdminContext();
  const [{ data: inquiries }, { data: blocks }, { data: imps }] = await Promise.all([
    supabase.from("representation_inquiries").select("id, subject, status, created_at, companies(id, name), creator_profiles(id, display_name, handle)")
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("user_blocks").select("id, created_at, reason, blocker_user_id, companies:blocked_company_id(id, name)")
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("impersonation_sessions").select("id, admin_id, target_user_id, reason, started_at, ended_at")
      .order("started_at", { ascending: false }).limit(20),
  ]);
  type Inq = { id: string; subject: string; status: InquiryStatus; created_at: string; companies: { id: string; name: string }; creator_profiles: { id: string; display_name: string | null; handle: string | null } };
  type Blk = { id: string; created_at: string; reason: string | null; blocker_user_id: string; companies: { id: string; name: string } | null };

  // Count blocks per company to surface patterns.
  const blockCounts = new Map<string, { name: string; n: number }>();
  for (const b of (blocks ?? []) as unknown as Blk[]) {
    if (!b.companies) continue;
    const cur = blockCounts.get(b.companies.id) ?? { name: b.companies.name, n: 0 };
    blockCounts.set(b.companies.id, { ...cur, n: cur.n + 1 });
  }

  return (
    <>
      <PageHeader title="Inquiries & blocks" description="Recent outreach and safety signals across the platform. Message contents stay private unless reported." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Recent inquiries" />
          <CardBody>
            <ul className="divide-y divide-line text-sm">
              {((inquiries ?? []) as unknown as Inq[]).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <Link href={`/admin/companies/${i.companies.id}`} className="font-medium text-primary hover:underline">{i.companies.name}</Link>
                  <span className="text-muted">→</span>
                  <Link href={`/admin/creators/${i.creator_profiles.id}`} className="font-medium text-primary hover:underline">{i.creator_profiles.display_name ?? i.creator_profiles.handle}</Link>
                  <span className="min-w-0 flex-1 truncate text-muted">“{i.subject}”</span>
                  <Badge>{INQUIRY_STATUS_LABELS[i.status]}</Badge>
                  <span className="text-xs text-muted">{dateTime(i.created_at)}</span>
                </li>
              ))}
              {!inquiries?.length && <li className="py-2 text-muted">No inquiries yet.</li>}
            </ul>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Most-blocked companies" description="Last 50 blocks" />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {[...blockCounts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([id, v]) => (
                  <li key={id} className="flex justify-between"><Link href={`/admin/companies/${id}`} className="text-primary hover:underline">{v.name}</Link>
                    <Badge tone={v.n >= 3 ? "danger" : "neutral"}>{v.n} block{v.n === 1 ? "" : "s"}</Badge></li>
                ))}
                {blockCounts.size === 0 && <li className="text-muted">No blocks.</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="View-as sessions" />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {(imps ?? []).map((s: { id: string; target_user_id: string; reason: string; started_at: string; ended_at: string | null }) => (
                  <li key={s.id}><Link href={`/admin/users/${s.target_user_id}`} className="text-primary hover:underline">User</Link>
                    <span className="text-muted"> · {dateTime(s.started_at)} · {s.reason}{s.ended_at ? "" : " · not ended"}</span></li>
                ))}
                {!imps?.length && <li className="text-muted">None.</li>}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
