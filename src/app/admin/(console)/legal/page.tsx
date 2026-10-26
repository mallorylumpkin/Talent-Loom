import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Legal pages" };

export default async function LegalListPage() {
  const { supabase } = await getAdminContext();
  const { data } = await supabase.from("legal_pages").select("slug, title, version, requires_legal_review, updated_at").order("title");
  return (
    <>
      <PageHeader title="Legal pages" description="These are templates until a lawyer reviews them." />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {(data ?? []).map((p: { slug: string; title: string; version: string; requires_legal_review: boolean; updated_at: string }) => (
            <li key={p.slug}>
              <Link href={`/admin/legal/${p.slug}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-canvas">
                <span className="min-w-0 flex-1 font-medium text-ink">{p.title}</span>
                <span className="text-sm text-muted">v{p.version} · {shortDate(p.updated_at)}</span>
                <Badge tone={p.requires_legal_review ? "warning" : "success"}>{p.requires_legal_review ? "Needs legal review" : "Reviewed"}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
