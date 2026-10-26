import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/forms/confirm-action";
import { AffiliateForm } from "@/components/creator/pro-forms";
import { ProUpsell, hasCreatorFeature } from "@/components/creator/pro-gate";
import { deleteAffiliateAction } from "@/app/creator/_actions/pro";
import { getCreatorContext } from "@/lib/creator/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Affiliate Code Vault" };

export default async function AffiliateVaultPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await getCreatorContext();
  const pro = await hasCreatorFeature(supabase, "affiliate_vault");
  let query = supabase.from("affiliate_codes").select("*").order("expires_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (q) query = query.or(`brand_name.ilike.%${q.replace(/[%,()]/g, "").slice(0, 60)}%,code.ilike.%${q.replace(/[%,()]/g, "").slice(0, 60)}%`);
  const { data } = await query;
  const rows = (data ?? []) as (Record<string, string | number | null> & { id: string })[];
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Affiliate Code Vault" description="Every discount code and affiliate link in one private place — only you can see it." />
      {!pro && <ProUpsell what="The Affiliate Code Vault" />}
      {pro && <Card className="mb-6"><CardHeader title="Add a code" /><CardBody><AffiliateForm /></CardBody></Card>}
      <form method="get" className="mb-4"><input name="q" defaultValue={q} placeholder="Search brand or code" aria-label="Search codes"
        className="h-9 w-72 rounded-lg border border-line bg-surface px-3 text-sm" /></form>
      {rows.length === 0 ? <EmptyState icon={Ticket} title="No codes yet" description="Add your first brand code or affiliate link." /> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const exp = r.expires_on as string | null;
            return (
              <li key={r.id}>
                <Card>
                  <CardBody className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{r.brand_name}</span>
                      {r.code && <span className="rounded-md bg-canvas px-2 py-0.5 font-mono text-sm">{r.code}</span>}
                      {r.commission_rate !== null && <Badge>{r.commission_rate}% commission</Badge>}
                      {exp && exp < today ? <Badge tone="neutral">Expired</Badge> : exp && exp <= soon ? <Badge tone="warning">Expires {shortDate(exp)}</Badge> : exp ? <Badge>Until {shortDate(exp)}</Badge> : null}
                      {r.payout_status !== "none" && <Badge tone={r.payout_status === "paid" ? "success" : "neutral"}>Payout {r.payout_status}</Badge>}
                    </div>
                    <p className="text-sm text-muted">{[r.product, r.network, r.affiliate_link].filter(Boolean).join(" · ")}</p>
                    {pro && (
                      <details><summary className="cursor-pointer text-sm text-primary">Edit</summary>
                        <div className="pt-3"><AffiliateForm row={r} /></div></details>
                    )}
                    <ActionButton action={deleteAffiliateAction.bind(null, r.id)} tone="danger" confirm="Delete?">Delete</ActionButton>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
