import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { AddTaxonomyForm, TaxonomyRow } from "@/components/admin/platform-forms";
import { getAdminContext, TAXONOMY_LABELS, TAXONOMY_TABLES } from "@/lib/admin/context";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Categories & niches" };

export default async function TaxonomyPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const table = (TAXONOMY_TABLES as readonly string[]).includes(t ?? "") ? (t as (typeof TAXONOMY_TABLES)[number]) : "niches";
  const { supabase } = await getAdminContext();
  const { data } = await supabase.from(table).select("id, key, label, active, sort").order("sort").order("label");
  const rows = (data ?? []) as { id: string; key: string; label: string; active: boolean; sort: number }[];
  return (
    <>
      <PageHeader title="Categories & niches"
        description="Options creators and companies pick from. Hide ones you no longer want instead of deleting them, so existing profiles keep their choices." />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Lists">
        {TAXONOMY_TABLES.map((k) => (
          <Link key={k} href={`/admin/taxonomy?t=${k}`} aria-current={k === table ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium", k === table ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line")}>
            {TAXONOMY_LABELS[k]}
          </Link>
        ))}
      </nav>
      <Card>
        <CardBody className="space-y-4">
          <AddTaxonomyForm table={table} />
          <div className="divide-y divide-line border-t border-line">
            {rows.map((r) => <TaxonomyRow key={r.id} table={table} row={r} />)}
          </div>
          {table === "platforms" && (
            <p className="text-xs text-muted">Instagram, TikTok, YouTube and Facebook connections are built in; new platforms you add here are manual (self-reported).</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
