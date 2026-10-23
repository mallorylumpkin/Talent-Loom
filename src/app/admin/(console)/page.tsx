import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin overview" };

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default async function AdminOverview() {
  const supabase = await createClient();
  const count = (table: string, filter?: (q: any) => any) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    return q.then((r: { count: number | null }) => r.count ?? 0);
  };

  const [users, creators, discoverable, companies, pendingCompanies, newLeads, openReports, pendingVerification, audit] =
    await Promise.all([
      count("profiles", (q) => q.is("deleted_at", null)),
      count("creator_profiles", (q) => q.is("deleted_at", null)),
      count("creator_profiles", (q) => q.eq("is_discoverable", true).is("deleted_at", null)),
      count("companies", (q) => q.is("deleted_at", null)),
      count("companies", (q) => q.in("status", ["submitted", "info_requested"])),
      count("company_leads", (q) => q.eq("status", "new")),
      count("user_reports", (q) => q.in("status", ["open", "reviewing"])),
      count("verification_requests", (q) => q.eq("status", "pending")),
      supabase.from("audit_logs").select("id, action, actor_email, target_type, created_at")
        .order("created_at", { ascending: false }).limit(8),
    ]);

  return (
    <>
      <PageHeader title="Platform overview" description="Live counts from the database. Admin tools arrive phase by phase." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Users" value={users} />
        <StatTile label="Creators" value={creators} hint={`${discoverable} discoverable`} />
        <StatTile label="Companies" value={companies} hint={`${pendingCompanies} awaiting review`} />
        <StatTile label="New sales leads" value={newLeads} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatTile label="Open reports" value={openReports} />
        <StatTile label="Pending verifications" value={pendingVerification} />
      </div>

      <Card className="mt-8">
        <CardHeader title="Recent audit activity" description="Every admin and security-relevant change is recorded and cannot be edited." />
        <CardBody className="p-0 sm:p-0">
          {audit.data && audit.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {audit.data.map((row: { id: number; action: string; actor_email: string | null; target_type: string | null; created_at: string }) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm sm:px-6">
                  <span className="font-mono text-[13px] text-ink">{row.action}</span>
                  <span className="text-muted">{row.actor_email ?? "system"}</span>
                  <Badge>{fmtTime(row.created_at)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-muted">No audit activity yet.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
