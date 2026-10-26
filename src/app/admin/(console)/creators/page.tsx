import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PersonAvatar } from "@/components/messaging/avatar";
import { getAdminContext } from "@/lib/admin/context";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Creators" };

export default async function AdminCreatorsPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await getAdminContext();
  let q = supabase.from("creator_profiles")
    .select("id, user_id, handle, display_name, avatar_path, is_discoverable, is_featured, completeness_pct, created_at", { count: "exact" })
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (sp.f === "discoverable") q = q.eq("is_discoverable", true);
  if (sp.f === "hidden") q = q.eq("is_discoverable", false);
  if (sp.f === "featured") q = q.eq("is_featured", true);
  if (sp.q) {
    const term = sp.q.replace(/[%,()]/g, " ").trim().slice(0, 80);
    if (term) q = q.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
  }
  const { data, count } = await q;
  const rows = (data ?? []) as { id: string; handle: string | null; display_name: string | null; avatar_path: string | null;
    is_discoverable: boolean; is_featured: boolean; completeness_pct: number; created_at: string }[];
  const pill = (active: boolean) => cn("rounded-full px-3.5 py-1.5 text-sm font-medium", active ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line hover:text-ink");

  return (
    <>
      <PageHeader title="Creators" description={`${count ?? 0} creator profiles`} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filter creators">
          {[["", "All"], ["discoverable", "Discoverable"], ["hidden", "Hidden"], ["featured", "Featured"]].map(([k, l]) => (
            <Link key={k} href={`/admin/creators${k ? `?f=${k}` : ""}`} className={pill((sp.f ?? "") === k)}>{l}</Link>
          ))}
        </nav>
        <form method="get"><input name="q" defaultValue={sp.q} placeholder="Search handle or name" aria-label="Search creators"
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" /></form>
      </div>
      {rows.length === 0 ? <EmptyState icon={Sparkles} title="No creators match" description="Try another filter." /> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/creators/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-canvas">
                  <PersonAvatar name={c.display_name ?? c.handle ?? "?"} path={c.avatar_path} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{c.display_name ?? "(no name)"}</p>
                    <p className="text-sm text-muted">{c.handle ? `@${c.handle}` : "no handle"} · {c.completeness_pct}% · joined {shortDate(c.created_at)}</p>
                  </div>
                  {c.is_featured && <Badge tone="accent">Featured</Badge>}
                  <Badge tone={c.is_discoverable ? "success" : "neutral"}>{c.is_discoverable ? "Discoverable" : "Hidden"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
