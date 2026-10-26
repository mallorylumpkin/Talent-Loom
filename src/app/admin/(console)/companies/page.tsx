import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COMPANY_STATUS_LABELS, getAdminContext } from "@/lib/admin/context";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Companies" };

const TABS = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review" },
  { key: "approved", label: "Approved" },
  { key: "draft", label: "Setting up" },
  { key: "closed", label: "Rejected / suspended" },
];

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { supabase } = await getAdminContext();
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "all";

  let query = supabase.from("companies").select("id, name, slug, status, city, region, country, created_at, is_verified_badge")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  if (tab === "review") query = query.in("status", ["submitted", "info_requested"]);
  if (tab === "approved") query = query.eq("status", "approved");
  if (tab === "draft") query = query.eq("status", "draft");
  if (tab === "closed") query = query.in("status", ["rejected", "suspended"]);
  if (params.q) query = query.ilike("name", `%${params.q.slice(0, 80)}%`);
  const [{ data: companies }, { data: subs }] = await Promise.all([
    query,
    supabase.from("subscriptions").select("owner_id, plans(name)").eq("owner_type", "company")
      .in("status", ["active", "trialing", "complimentary", "past_due"]),
  ]);
  const planBy = new Map((subs ?? []).map((s: { owner_id: string; plans: { name: string } | null }) => [s.owner_id, s.plans?.name]));

  return (
    <>
      <PageHeader title="Management companies"
        action={<ButtonLink href="/admin/companies/new"><Plus className="size-4" aria-hidden /> New company</ButtonLink>} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filter companies">
          {TABS.map((t) => (
            <Link key={t.key} href={`/admin/companies?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
              className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium",
                t.key === tab ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line hover:text-ink")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={params.q} placeholder="Search by name"
            className="h-9 rounded-lg border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
        </form>
      </div>

      {(companies ?? []).length === 0 ? (
        <EmptyState icon={Building2} title="No companies here" description="Create a company from a sales lead, or directly."
          action={<ButtonLink href="/admin/companies/new">New company</ButtonLink>} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {(companies ?? []).map((c: { id: string; name: string; status: string; city: string | null; region: string | null;
              created_at: string; is_verified_badge: boolean }) => {
              const s = COMPANY_STATUS_LABELS[c.status];
              return (
                <li key={c.id}>
                  <Link href={`/admin/companies/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-canvas">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-sm text-muted">{[c.city, c.region].filter(Boolean).join(", ") || "—"} · added {shortDate(c.created_at)}</p>
                    </div>
                    <Badge tone="primary">{planBy.get(c.id) ?? "No plan"}</Badge>
                    {c.is_verified_badge && <Badge tone="success">Verified</Badge>}
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
