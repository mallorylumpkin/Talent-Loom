import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProvenanceBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { SearchResult } from "@/components/company/creator-card";
import { feature, requireCompany } from "@/lib/company/context";
import { countryName } from "@/lib/countries";
import { compactNumber, percent, representationLabels } from "@/lib/format";
import { formatLocation } from "@/lib/creator/public";
import { publicStorageUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: "Compare creators" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const { supabase, company, entitlements } = await requireCompany();
  if (!feature(entitlements, "creator_comparison").enabled) {
    return (
      <>
        <PageHeader title="Compare creators" />
        <EmptyState icon={Lock} title="Comparison is on the Management Agency plan"
          description="Compare up to four creators side by side. Contact TalentLoom to change your plan." />
      </>
    );
  }

  const raw = (await searchParams).ids;
  const ids = [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 4);
  if (ids.length < 2) {
    return (
      <>
        <PageHeader title="Compare creators" />
        <EmptyState icon={Columns3} title="Pick at least two creators"
          description="In search or a saved list, tick the box on 2–4 creator cards and click Compare selected."
          action={<ButtonLink href="/company/search">Go to search</ButtonLink>} />
      </>
    );
  }

  const { data } = await supabase.rpc("search_creators", { p_company_id: company.id, p_filters: { ids }, p_limit: 4 });
  const items = ((data as SearchResult | null)?.items ?? []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  const rows: { label: string; render: (c: (typeof items)[number]) => React.ReactNode }[] = [
    { label: "Location", render: (c) => formatLocation(c.location, countryName) ?? "—" },
    { label: "Niches", render: (c) => c.niches.join(", ") || "—" },
    { label: "Platforms", render: (c) => c.platforms.length },
    { label: "Top platform", render: (c) => c.top_platform ?? "—" },
    { label: "Top-platform followers", render: (c) => compactNumber(c.followers) },
    { label: "Total followers", render: (c) => compactNumber(c.total_followers) },
    { label: "Engagement", render: (c) => percent(c.engagement_rate) },
    { label: "30-day growth", render: (c) => percent(c.growth_30d_pct, true) },
    { label: "Data source", render: (c) => (c.source ? <ProvenanceBadge source={c.source} /> : "—") },
    { label: "Seeking management", render: (c) => (c.seeking_management ? "Yes" : "No") },
    { label: "Representation", render: (c) => representationLabels[c.representation_status] },
  ];

  return (
    <>
      <PageHeader title="Compare creators" description="Only information each creator shares with your company is shown." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="w-44 px-4 py-4 text-left font-medium text-muted" scope="col"><span className="sr-only">Metric</span></th>
              {items.map((c) => {
                const avatar = publicStorageUrl("avatars", c.avatar_path);
                return (
                  <th key={c.id} scope="col" className="px-4 py-4 text-left align-top">
                    <div className="flex items-center gap-2">
                      <span className="size-9 shrink-0 overflow-hidden rounded-full bg-accent-soft">
                        {avatar && <img src={avatar} alt="" className="size-full object-cover" />}
                      </span>
                      <Link href={`/company/creators/${c.id}`} className="font-display font-semibold text-ink hover:underline">
                        {c.display_name ?? c.handle}
                      </Link>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-muted">{r.label}</th>
                {items.map((c) => <td key={c.id} className="tabular px-4 py-3 text-ink">{r.render(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
