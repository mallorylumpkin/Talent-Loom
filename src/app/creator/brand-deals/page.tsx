import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/forms/confirm-action";
import { DealForm } from "@/components/creator/pro-forms";
import { ProUpsell, hasCreatorFeature } from "@/components/creator/pro-gate";
import { money } from "@/components/billing/billing-ui";
import { deleteDealAction } from "@/app/creator/_actions/pro";
import { getCreatorContext } from "@/lib/creator/context";
import { DEAL_STAGE_LABELS } from "@/lib/creator/pro";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Brand-Deal Tracker" };

type Deal = Record<string, string | number | null> & { id: string; deliverables: { item: string }[] };

export default async function BrandDealsPage() {
  const { supabase } = await getCreatorContext();
  const pro = await hasCreatorFeature(supabase, "brand_deal_tracker");
  const { data } = await supabase.from("brand_deals").select("*").order("due_date", { ascending: true, nullsFirst: false });
  const deals = (data ?? []) as Deal[];
  const open = deals.filter((d) => !["paid", "closed"].includes(String(d.stage)));
  const pipeline = open.reduce((s, d) => s + Number(d.agreed_cents ?? d.proposed_cents ?? 0), 0);
  const unpaid = deals.filter((d) => d.payment_status !== "paid" && ["published", "invoiced"].includes(String(d.stage)))
    .reduce((s, d) => s + Number(d.agreed_cents ?? 0), 0);
  const year = new Date().getFullYear().toString();
  const earned = deals.filter((d) => d.payment_status === "paid" && String(d.updated_at ?? "").startsWith(year)).reduce((s, d) => s + Number(d.agreed_cents ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Brand-Deal Tracker" description="Track every partnership from first email to payment. Private to you." />
      {!pro && <ProUpsell what="The Brand-Deal Tracker" />}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Open deals" value={open.length} hint={`${money(pipeline)} in play`} />
        <StatTile label="Waiting to be paid" value={money(unpaid)} />
        <StatTile label={`Paid in ${year}`} value={money(earned)} />
      </div>
      {pro && <Card className="mb-6"><CardHeader title="Add a deal" /><CardBody><DealForm /></CardBody></Card>}
      {deals.length === 0 ? <EmptyState icon={Handshake} title="No deals yet" description="Add a brand partnership to start tracking it." /> : (
        <ul className="space-y-3">
          {deals.map((d) => (
            <li key={d.id}>
              <Card>
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{d.brand}</span>
                    {d.opportunity && <span className="text-sm text-muted">{d.opportunity}</span>}
                    <Badge tone="primary">{DEAL_STAGE_LABELS[String(d.stage)]}</Badge>
                    {(d.agreed_cents ?? d.proposed_cents) !== null && <Badge>{money(Number(d.agreed_cents ?? d.proposed_cents))}{d.agreed_cents === null ? " proposed" : ""}</Badge>}
                    {d.due_date && <Badge tone={String(d.due_date) < today && !["published", "invoiced", "paid", "closed"].includes(String(d.stage)) ? "danger" : "neutral"}>Due {shortDate(String(d.due_date))}</Badge>}
                    {d.payment_status === "paid" && <Badge tone="success">Paid</Badge>}
                    {d.invoice_status === "overdue" && <Badge tone="danger">Invoice overdue</Badge>}
                  </div>
                  {d.deliverables.length > 0 && <p className="text-sm text-muted">{d.deliverables.map((x) => x.item).join(" · ")}</p>}
                  {pro && <details><summary className="cursor-pointer text-sm text-primary">Edit</summary><div className="pt-3"><DealForm row={d} /></div></details>}
                  <ActionButton action={deleteDealAction.bind(null, d.id)} tone="danger" confirm="Delete?">Delete</ActionButton>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
