import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CheckoutButton, PortalButton } from "@/components/billing/billing-buttons";
import { FeatureList, InvoiceList, money, SUB_STATUS, type Payment } from "@/components/billing/billing-ui";
import { getCreatorContext } from "@/lib/creator/context";
import { stripeConfigured } from "@/lib/billing/stripe";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Billing" };

export default async function CreatorBillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const { supabase, viewer } = await getCreatorContext();
  const [{ data: subs }, { data: plans }, { data: features }, { data: payments }, { data: customer }] = await Promise.all([
    supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end, trial_end, comp_expires_at, stripe_subscription_id, plans(key, name), plan_prices(amount_cents, billing_interval)")
      .eq("owner_type", "user").eq("owner_id", viewer.id).in("status", ["active", "trialing", "past_due", "complimentary", "unpaid", "paused"])
      .order("created_at", { ascending: false }).limit(1),
    supabase.from("plans").select("id, key, name, description, trial_days, plan_prices(billing_interval, amount_cents, active, stripe_price_id)").in("key", ["creator_free", "creator_pro"]).order("sort"),
    supabase.from("plan_features").select("plan_id, enabled, limit_value, features(label, kind, sort, audience)"),
    supabase.from("payments").select("id, description, amount_cents, currency, status, hosted_invoice_url, invoice_pdf_url, created_at, paid_at")
      .eq("owner_type", "user").eq("owner_id", viewer.id).order("created_at", { ascending: false }).limit(24),
    supabase.from("billing_customers").select("stripe_customer_id").eq("owner_type", "user").eq("owner_id", viewer.id).maybeSingle(),
  ]);
  type Sub = { status: string; current_period_end: string | null; cancel_at_period_end: boolean; trial_end: string | null; comp_expires_at: string | null;
    stripe_subscription_id: string | null; plans: { key: string; name: string }; plan_prices: { amount_cents: number; billing_interval: string } | null };
  const sub = (subs?.[0] ?? null) as unknown as Sub | null;
  type Plan = { id: string; key: string; name: string; description: string | null; trial_days: number;
    plan_prices: { billing_interval: "month" | "year"; amount_cents: number; active: boolean; stripe_price_id: string | null }[] };
  const planRows = (plans ?? []) as Plan[];
  const pro = planRows.find((p) => p.key === "creator_pro");
  type Feat = { plan_id: string; enabled: boolean; limit_value: number | null; features: { label: string; kind: string; sort: number; audience: string } };
  const feats = (features ?? []) as unknown as Feat[];
  const featuresFor = (planId: string) => feats.filter((f) => f.plan_id === planId && f.features.audience === "creator")
    .sort((a, b) => a.features.sort - b.features.sort)
    .map((f) => ({ label: f.features.label, enabled: f.enabled, limit: f.limit_value, kind: f.features.kind }));
  const price = (i: "month" | "year") => pro?.plan_prices.find((p) => p.active && p.billing_interval === i);
  const onPro = sub?.plans.key === "creator_pro";
  const canBuy = stripeConfigured() && !!price("month")?.stripe_price_id;

  return (
    <>
      <PageHeader title="Billing" description="Your plan, invoices and payment details." />
      {checkout === "success" && <Alert tone="success" className="mb-6">Thanks! Your payment went through — Creator Pro unlocks within a few seconds. Refresh if you don&apos;t see it yet.</Alert>}
      {checkout === "cancelled" && <Alert tone="info" className="mb-6">Checkout cancelled — you weren&apos;t charged.</Alert>}
      {sub?.status === "past_due" && <Alert tone="warning" className="mb-6">Your last payment didn&apos;t go through. Update your card in “Manage billing” to keep Creator Pro.</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your plan" action={sub && <Badge tone={SUB_STATUS[sub.status]?.tone ?? "neutral"}>{SUB_STATUS[sub.status]?.label ?? sub.status}</Badge>} />
          <CardBody className="space-y-3">
            <p className="font-display text-2xl font-semibold text-ink">{sub?.plans.name ?? "Creator Free"}</p>
            {sub?.plan_prices && <p className="text-sm text-muted">{money(sub.plan_prices.amount_cents)} / {sub.plan_prices.billing_interval}</p>}
            {sub?.status === "trialing" && sub.trial_end && <p className="text-sm text-muted">Free trial until {shortDate(sub.trial_end)}.</p>}
            {sub?.current_period_end && sub.stripe_subscription_id && (
              <p className="text-sm text-muted">{sub.cancel_at_period_end ? "Ends" : "Renews"} on {shortDate(sub.current_period_end)}.</p>
            )}
            {sub?.status === "complimentary" && <p className="text-sm text-muted">Complimentary from TalentLoom{sub.comp_expires_at ? ` until ${shortDate(sub.comp_expires_at)}` : ""}.</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {customer?.stripe_customer_id && <PortalButton />}
            </div>
          </CardBody>
        </Card>

        {pro && (
          <Card className={onPro ? "" : "ring-2 ring-primary"}>
            <CardHeader title={pro.name} description={pro.description ?? undefined} />
            <CardBody className="space-y-4">
              <p className="text-sm text-ink">
                <span className="font-display text-2xl font-semibold">{money(price("month")?.amount_cents)}</span> / month
                {price("year") && <span className="text-muted"> · or {money(price("year")?.amount_cents)} / year</span>}
              </p>
              <FeatureList rows={featuresFor(pro.id)} />
              {!onPro && (canBuy ? (
                <div className="flex flex-wrap gap-2">
                  <CheckoutButton interval="month" label={pro.trial_days > 0 ? `Start ${pro.trial_days}-day free trial` : "Upgrade monthly"} />
                  {price("year")?.stripe_price_id && <CheckoutButton interval="year" label="Pay yearly" />}
                </div>
              ) : <p className="text-sm text-muted">Upgrades open soon.</p>)}
              <p className="text-xs text-muted">Secure payment by Stripe. Cancel any time from “Manage billing”. Promo codes can be entered at checkout.</p>
            </CardBody>
          </Card>
        )}
      </div>
      <div className="mt-6"><InvoiceList payments={(payments ?? []) as Payment[]} /></div>
    </>
  );
}
