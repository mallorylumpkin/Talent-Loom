import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { feature, requireCompany } from "@/lib/company/context";

export const metadata: Metadata = { title: "Reports" };

interface Report { locked: boolean; months?: { month: string; sent: number; accepted: number }[]; stages?: { stage: string; kind: string; count: number }[];
  team?: { name: string; inquiries: number }[]; roster_active?: number; views_30d?: number }

export default async function CompanyReportsPage() {
  const { supabase, company, permissions, entitlements } = await requireCompany();
  if (!permissions.has("analytics.view")) return <Alert tone="warning">Your role doesn&apos;t include company reports.</Alert>;
  const { data } = await supabase.rpc("company_report", { p_company_id: company.id });
  const r = (data ?? { locked: true }) as Report;
  const canExport = feature(entitlements, "csv_export").enabled && permissions.has("export.csv");
  const sent = (r.months ?? []).reduce((s, m) => s + m.sent, 0);
  const accepted = (r.months ?? []).reduce((s, m) => s + m.accepted, 0);
  const maxSent = Math.max(1, ...(r.months ?? []).map((m) => m.sent));

  return (
    <>
      <PageHeader title="Reports" description="Your recruiting activity over the last 12 months." />
      {r.locked ? <Alert tone="info">Company reports are part of the Management Agency plans. Contact TalentLoom to upgrade.</Alert> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Inquiries sent (12 mo)" value={sent} />
            <StatTile label="Acceptance rate" value={sent ? `${Math.round((accepted / sent) * 100)}%` : "—"} hint={`${accepted} accepted`} />
            <StatTile label="Signed roster" value={r.roster_active ?? 0} />
            <StatTile label="Profiles viewed (30 days)" value={r.views_30d ?? 0} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Inquiries by month" description="Bar = sent · darker = accepted" />
              <CardBody>
                {(r.months ?? []).length === 0 ? <p className="text-sm text-muted">No inquiries yet.</p> : (
                  <ul className="space-y-2">
                    {(r.months ?? []).map((m) => (
                      <li key={m.month} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-sm">
                        <span className="text-muted">{m.month}</span>
                        <span className="relative h-4 overflow-hidden rounded bg-primary-soft">
                          <span className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${(m.sent / maxSent) * 100}%` }} />
                          <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${(m.accepted / maxSent) * 100}%` }} />
                        </span>
                        <span className="tabular text-right">{m.accepted}/{m.sent}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Main pipeline today" />
              <CardBody>
                <ul className="space-y-1.5 text-sm">
                  {(r.stages ?? []).map((s) => <li key={s.stage} className="flex justify-between"><span className="text-ink">{s.stage}</span><span className="tabular text-muted">{s.count}</span></li>)}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Team outreach (90 days)" />
              <CardBody>
                <ul className="space-y-1.5 text-sm">
                  {(r.team ?? []).map((t) => <li key={t.name} className="flex justify-between"><span className="text-ink">{t.name}</span><span className="tabular text-muted">{t.inquiries} inquiries</span></li>)}
                  {!r.team?.length && <li className="text-muted">No outreach yet.</li>}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Export" description={canExport ? "CSV files for your records" : "CSV export is included in Management Agency plans (needs the export permission)."} />
              <CardBody className="flex flex-wrap gap-2">
                {canExport && [["pipeline", "Pipeline"], ["roster", "Roster"], ["inquiries", "Inquiries"], ["saved", "Saved creators"]].map(([k, l]) => (
                  <a key={k} href={`/company/export/${k}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium hover:bg-canvas">
                    <Download className="size-4" aria-hidden /> {l}
                  </a>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
