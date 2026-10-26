import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadStatusForm } from "@/components/admin/company-forms";
import { getAdminContext } from "@/lib/admin/context";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Sales leads" };

const TABS = [
  { key: "open", label: "Open", statuses: ["new", "contacted", "qualified"] },
  { key: "new", label: "New", statuses: ["new"] },
  { key: "converted", label: "Converted", statuses: ["converted"] },
  { key: "declined", label: "Declined", statuses: ["declined"] },
];

interface Lead {
  id: string; company_name: string; website: string | null; contact_name: string; contact_email: string; phone: string | null;
  team_size: string | null; message: string | null; interested_plan: string | null; status: string; admin_notes: string | null;
  converted_company_id: string | null; created_at: string;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase } = await getAdminContext();
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0];
  const { data } = await supabase.from("company_leads").select("*").in("status", tab.statuses)
    .order("created_at", { ascending: false }).limit(200);
  const leads = (data ?? []) as Lead[];

  return (
    <>
      <PageHeader title="Sales leads" description="Requests from the “Request access” form on the For Companies page." />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filter leads">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin/leads?tab=${t.key}`} aria-current={t.key === tab.key ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium",
              t.key === tab.key ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <EmptyState icon={Inbox} title="No leads here" description="New requests from management companies show up in this list." />
      ) : (
        <ul className="space-y-4">
          {leads.map((l) => (
            <li key={l.id}>
              <Card className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{l.company_name}</h2>
                    <Badge tone={l.status === "new" ? "accent" : l.status === "converted" ? "success" : "neutral"}>{l.status}</Badge>
                    {l.interested_plan && <Badge tone="primary">{l.interested_plan.replace(/_/g, " ")}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {l.contact_name} · <a href={`mailto:${l.contact_email}`} className="text-primary hover:underline">{l.contact_email}</a>
                    {l.phone && <> · {l.phone}</>}
                    {l.team_size && <> · team {l.team_size}</>}
                    {" · "}{shortDate(l.created_at)}
                  </p>
                  {l.website && (
                    <a href={l.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block truncate text-sm text-primary hover:underline">
                      {l.website}
                    </a>
                  )}
                  {l.message && <p className="mt-3 text-sm leading-6 whitespace-pre-line text-ink/85">{l.message}</p>}
                </div>
                <div className="space-y-3">
                  <LeadStatusForm leadId={l.id} status={l.status} notes={l.admin_notes} />
                  {l.converted_company_id ? (
                    <ButtonLink href={`/admin/companies/${l.converted_company_id}`} variant="secondary" size="sm">Open company</ButtonLink>
                  ) : (
                    <ButtonLink href={`/admin/companies/new?lead=${l.id}`} size="sm">Create company from lead</ButtonLink>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
