import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionButton } from "@/components/forms/confirm-action";
import { FeatureCell, PlanForm, PriceForm } from "@/components/admin/billing-forms";
import { syncStripeAction } from "@/app/admin/_actions/billing";
import { getAdminContext } from "@/lib/admin/context";
import { stripeConfigured, stripeTestMode } from "@/lib/billing/stripe";

export const metadata: Metadata = { title: "Plans & pricing" };

interface Plan { id: string; key: string; audience: string; name: string; description: string | null; trial_days: number; is_public: boolean;
  is_active: boolean; sales_led: boolean; plan_prices: { billing_interval: "month" | "year"; amount_cents: number; active: boolean; stripe_price_id: string | null }[] }

export default async function PlansPage() {
  const { supabase } = await getAdminContext();
  const [{ data: plans }, { data: features }, { data: pf }] = await Promise.all([
    supabase.from("plans").select("id, key, audience, name, description, trial_days, is_public, is_active, sales_led, plan_prices(billing_interval, amount_cents, active, stripe_price_id)").order("sort"),
    supabase.from("features").select("key, label, kind, audience").order("sort"),
    supabase.from("plan_features").select("plan_id, feature_key, enabled, limit_value"),
  ]);
  const list = (plans ?? []) as Plan[];
  const cell = (planId: string, key: string) => (pf ?? []).find((x: { plan_id: string; feature_key: string }) => x.plan_id === planId && x.feature_key === key) as
    { enabled: boolean; limit_value: number | null } | undefined;

  return (
    <>
      <PageHeader title="Plans & pricing" description="Changes apply immediately to everyone on the plan. Price changes only affect new subscribers."
        action={<ActionButton action={syncStripeAction} tone="primary" className="h-9 border border-primary px-3">Sync to Stripe</ActionButton>} />
      {!stripeConfigured() ? <Alert tone="warning" className="mb-6">Stripe isn&apos;t connected yet. Plans and limits still work (complimentary plans); add your Stripe keys to take payments — see docs/BILLING.md.</Alert>
        : stripeTestMode() ? <Alert tone="info" className="mb-6">Stripe is in <strong>test mode</strong> — no real money moves. Use card 4242 4242 4242 4242 to test.</Alert> : null}
      {(["creator", "company"] as const).map((aud) => {
        const group = list.filter((p) => p.audience === aud);
        const feats = (features ?? []).filter((f: { audience: string }) => f.audience === aud) as { key: string; label: string; kind: string }[];
        return (
          <section key={aud} className="mb-10 space-y-4">
            <h2 className="text-lg font-semibold text-ink">{aud === "creator" ? "Creator plans" : "Company plans"}</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {group.map((p) => (
                <Card key={p.id}>
                  <CardHeader title={p.name} description={<span className="font-mono text-xs">{p.key}</span>} />
                  <CardBody className="space-y-4">
                    <PlanForm plan={p} />
                    {!["creator_free", "company_pending"].includes(p.key) && (["month", "year"] as const).map((i) => {
                      const pr = p.plan_prices.find((x) => x.active && x.billing_interval === i);
                      return <PriceForm key={i} planId={p.id} interval={i} cents={pr?.amount_cents ?? null} synced={!!pr?.stripe_price_id} />;
                    })}
                  </CardBody>
                </Card>
              ))}
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs text-muted">
                  <tr><th className="px-3 py-2 font-medium">Feature (tick = included · blank limit = unlimited)</th>
                    {group.map((p) => <th key={p.id} className="px-3 py-2 font-medium">{p.name}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {feats.map((f) => (
                    <tr key={f.key}>
                      <td className="px-3 py-1.5 text-ink">{f.label}</td>
                      {group.map((p) => {
                        const c = cell(p.id, f.key);
                        return <td key={p.id} className="px-3 py-1.5"><FeatureCell planId={p.id} featureKey={f.key} kind={f.kind} enabled={c?.enabled ?? false} limit={c?.limit_value ?? null} /></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        );
      })}
    </>
  );
}
