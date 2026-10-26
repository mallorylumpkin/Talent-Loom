import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionButton } from "@/components/forms/confirm-action";
import { PromoForm } from "@/components/admin/billing-forms";
import { money } from "@/components/billing/billing-ui";
import { deactivatePromoAction } from "@/app/admin/_actions/billing";
import { getAdminContext } from "@/lib/admin/context";
import { stripeConfigured } from "@/lib/billing/stripe";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Promo codes" };

export default async function PromoCodesPage() {
  const { supabase } = await getAdminContext();
  const [{ data: codes }, { data: plans }] = await Promise.all([
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("plans").select("key, name").not("key", "in", "(creator_free,company_pending)").order("sort"),
  ]);
  return (
    <>
      <PageHeader title="Promo codes" description="Created in Stripe and entered by customers at checkout." />
      {!stripeConfigured() && <Alert tone="warning" className="mb-6">Connect Stripe first (docs/BILLING.md).</Alert>}
      <Card className="mb-6"><CardHeader title="New promo code" /><CardBody><PromoForm plans={(plans ?? []) as { key: string; name: string }[]} /></CardBody></Card>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line text-sm">
          {(codes ?? []).map((c: { id: string; code: string; percent_off: number | null; amount_off_cents: number | null; duration: string; duration_months: number | null; max_redemptions: number | null; expires_at: string | null; active: boolean; applies_to_plan_keys: string[] }) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="font-mono font-semibold text-ink">{c.code}</span>
              <span>{c.percent_off ? `${c.percent_off}% off` : `${money(c.amount_off_cents)} off`} · {c.duration === "repeating" ? `${c.duration_months} months` : c.duration}</span>
              <span className="min-w-0 flex-1 text-muted">{c.applies_to_plan_keys.length ? c.applies_to_plan_keys.join(", ") : "all plans"}{c.max_redemptions ? ` · max ${c.max_redemptions}` : ""}{c.expires_at ? ` · until ${shortDate(c.expires_at)}` : ""}</span>
              <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Off"}</Badge>
              {c.active && <ActionButton action={deactivatePromoAction.bind(null, c.id)} tone="danger" confirm="Click again to deactivate">Deactivate</ActionButton>}
            </li>
          ))}
          {!codes?.length && <li className="px-5 py-6 text-muted">No promo codes yet.</li>}
        </ul>
      </Card>
    </>
  );
}
