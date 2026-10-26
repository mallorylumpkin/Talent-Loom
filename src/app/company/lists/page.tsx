import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateListForm } from "@/components/company/forms";
import { feature, requireCompany } from "@/lib/company/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Saved talent" };

export default async function ListsPage() {
  const { supabase, company, permissions, entitlements } = await requireCompany();
  const { data } = await supabase.from("talent_lists")
    .select("id, name, is_private, created_at, talent_list_members(count)")
    .eq("company_id", company.id).order("created_at");
  const lists = (data ?? []) as unknown as { id: string; name: string; is_private: boolean; created_at: string;
    talent_list_members: { count: number }[] }[];
  const saved = feature(entitlements, "saved_creators.max");

  return (
    <>
      <PageHeader title="Saved talent"
        description={saved.limit != null ? `Your plan lets you save up to ${saved.limit} creators.` : "Organize creators into shortlists."}
        action={<ButtonLink href="/company/search" variant="secondary">Find creators</ButtonLink>} />

      {permissions.has("talent.manage") && (
        <Card className="mb-6 p-5"><CreateListForm allowPrivate={feature(entitlements, "private_lists").enabled} /></Card>
      )}

      {lists.length === 0 ? (
        <EmptyState icon={Bookmark} title="Start a shortlist"
          description="Click Save on any creator in search. They'll appear in your team's Saved list."
          action={<ButtonLink href="/company/search">Search creators</ButtonLink>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/company/lists/${l.id}`} className="block rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-primary">
                <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  {l.name}{l.is_private && <Lock className="size-4 text-muted" aria-label="Private" />}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {l.talent_list_members[0]?.count ?? 0} creators · created {shortDate(l.created_at)}
                </p>
                {l.is_private && <Badge className="mt-3">Only you</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
