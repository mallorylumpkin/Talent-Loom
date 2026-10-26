import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatorCard, type SearchResult } from "@/components/company/creator-card";
import { RenameListForm } from "@/components/company/forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { deleteListAction, removeFromListAction } from "@/app/company/_actions/talent";
import { feature, requireCompany } from "@/lib/company/context";

export const metadata: Metadata = { title: "List" };

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, company, permissions, entitlements } = await requireCompany();

  const { data: list } = await supabase.from("talent_lists").select("id, name, is_private, talent_list_members(creator_id)")
    .eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!list) notFound();
  const ids = (list.talent_list_members as { creator_id: string }[]).map((m) => m.creator_id).slice(0, 48);

  // Fetch through search so every card respects privacy and your plan.
  const { data } = ids.length
    ? await supabase.rpc("search_creators", { p_company_id: company.id, p_filters: { ids }, p_limit: 48 })
    : { data: null };
  const result = (data as SearchResult | null) ?? { items: [], total: 0, view_level: 0, advanced_filters: false };
  const hidden = ids.length - result.items.length;
  const canManage = permissions.has("talent.manage");
  const compare = feature(entitlements, "creator_comparison").enabled;

  return (
    <>
      <PageHeader title={list.name}
        description={`${ids.length} creator${ids.length === 1 ? "" : "s"}${list.is_private ? " · private to you" : ""}`}
        action={canManage ? (
          <ActionButton action={deleteListAction.bind(null, list.id)} tone="danger" confirm="Click again to delete this list">Delete list</ActionButton>
        ) : undefined} />

      {canManage && <div className="mb-6"><RenameListForm listId={list.id} name={list.name} /></div>}

      {hidden > 0 && (
        <p className="mb-4 text-sm text-muted">
          {hidden} creator{hidden === 1 ? " is" : "s are"} no longer discoverable and hidden from this list.
        </p>
      )}

      {result.items.length === 0 ? (
        <EmptyState icon={Users} title="This list is empty" description="Save creators from search to add them here."
          action={<ButtonLink href="/company/search">Search creators</ButtonLink>} />
      ) : (
        <form action="/company/compare" method="get">
          {compare && (
            <div className="mb-4 flex justify-end">
              <button type="submit" className={buttonClasses("secondary", "sm")}>Compare selected</button>
            </div>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((c) => (
              <li key={c.id}>
                <CreatorCard c={c} canSave={false} compare={compare}
                  extraAction={canManage ? (
                    <ActionButton action={removeFromListAction.bind(null, list.id, c.id)} tone="danger" confirm="Remove?">Remove</ActionButton>
                  ) : undefined} />
              </li>
            ))}
          </ul>
        </form>
      )}
    </>
  );
}
