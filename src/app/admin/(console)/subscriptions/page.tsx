import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { ActionButton } from "@/components/forms/confirm-action";
import { CreditForm, ExtendTrialForm, GrantCompForm } from "@/components/admin/billing-forms";
import { money, SUB_STATUS } from "@/components/billing/billing-ui";
import { cancelSubscriptionAction, endComplimentaryAction } from "@/app/admin/_actions/billing";
import { getAdminContext } from "@/lib/admin/context";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Subscriptions" };

interface Sub { id: string; owner_type: "user" | "company"; owner_id: string; status: string; stripe_subscription_id: string | null; current_period_end: string | null;
  cancel_at_period_end: boolean; trial_end: string | null; comp_expires_at: string | null; created_at: string; plans: { name: string };
  plan_prices: { amount_cents: number; billing_interval: string } | null }

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const { supabase } = await getAdminContext();
  const tab = (a: boolean) => cn("rounded-full px-3.5 py-1.5 text-sm font-medium", a ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line");
  const [{ data: summary }, { data: plans }] = await Promise.all([
    supabase.rpc("admin_revenue_summary"),
    supabase.from("plans").select("key, name").not("key", "in", "(creator_free,company_pending)").order("sort"),
  ]);
  const s = (summary ?? {}) as { mrr_cents?: number; paying?: number; trialing?: number; past_due?: number; complimentary?: number;
    canceled_30d?: number; churn_30d_pct?: number; revenue_30d_cents?: number; by_plan?: { plan: string; count: number }[] };

  if (view === "payments") {
    const { data: pays } = await supabase.from("payments").select("id, owner_type, owner_id, description, amount_cents, currency, status, hosted_invoice_url, created_at, paid_at")
      .order("created_at", { ascending: false }).limit(100);
    return (
      <>
        <PageHeader title="Payments" />
        <nav className="mb-6 flex gap-2"><Link href="/admin/subscriptions" className={tab(false)}>Subscriptions</Link><Link href="/admin/subscriptions?view=payments" className={tab(true)}>Payments</Link></nav>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line text-sm">
            {(pays ?? []).map((p: { id: string; owner_type: string; owner_id: string; description: string | null; amount_cents: number; currency: string; status: string; hosted_invoice_url: string | null; created_at: string; paid_at: string | null }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Link href={p.owner_type === "user" ? `/admin/users/${p.owner_id}` : `/admin/companies/${p.owner_id}`} className="min-w-0 flex-1 truncate text-primary hover:underline">{p.description ?? "Invoice"}</Link>
                <span className="text-muted">{shortDate(p.paid_at ?? p.created_at)}</span>
                <span className="tabular font-medium">{money(p.amount_cents, p.currency)}</span>
                <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge>
                {p.hosted_invoice_url && <a href={p.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary">Invoice</a>}
              </li>
            ))}
            {!pays?.length && <li className="px-5 py-6 text-muted">No payments yet.</li>}
          </ul>
        </Card>
      </>
    );
  }

  const { data } = await supabase.from("subscriptions").select("id, owner_type, owner_id, status, stripe_subscription_id, current_period_end, cancel_at_period_end, trial_end, comp_expires_at, created_at, plans(name), plan_prices(amount_cents, billing_interval)")
    .in("status", ["active", "trialing", "past_due", "complimentary", "unpaid", "paused"]).order("created_at", { ascending: false }).limit(200);
  const subs = (data ?? []) as unknown as Sub[];
  const userIds = subs.filter((x) => x.owner_type === "user").map((x) => x.owner_id);
  const companyIds = subs.filter((x) => x.owner_type === "company").map((x) => x.owner_id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: users }, { data: companies }] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name").in("id", userIds.length ? userIds : none),
    supabase.from("companies").select("id, name").in("id", companyIds.length ? companyIds : none),
  ]);
  const name = (x: Sub) => x.owner_type === "user"
    ? ((users ?? []) as { id: string; email: string; display_name: string | null }[]).find((u) => u.id === x.owner_id)?.display_name ?? ((users ?? []) as { id: string; email: string }[]).find((u) => u.id === x.owner_id)?.email
    : ((companies ?? []) as { id: string; name: string }[]).find((c) => c.id === x.owner_id)?.name;

  return (
    <>
      <PageHeader title="Subscriptions" description="Paid plans come from Stripe; complimentary plans are granted here." />
      <nav className="mb-6 flex gap-2"><Link href="/admin/subscriptions" className={tab(true)}>Subscriptions</Link><Link href="/admin/subscriptions?view=payments" className={tab(false)}>Payments</Link></nav>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Monthly recurring revenue" value={money(s.mrr_cents ?? 0)} hint={`${s.paying ?? 0} paying`} />
        <StatTile label="Revenue, last 30 days" value={money(s.revenue_30d_cents ?? 0)} />
        <StatTile label="Churn, last 30 days" value={`${s.churn_30d_pct ?? 0}%`} hint={`${s.canceled_30d ?? 0} canceled`} />
        <StatTile label="Trials · past due · comp" value={`${s.trialing ?? 0} · ${s.past_due ?? 0} · ${s.complimentary ?? 0}`} />
      </div>
      <Card className="my-6">
        <CardHeader title="Grant a complimentary plan" description="Replaces any current complimentary plan. Paying customers keep their Stripe plan." />
        <CardBody><GrantCompForm plans={(plans ?? []) as { key: string; name: string }[]} /></CardBody>
      </Card>
      <ul className="space-y-3">
        {subs.map((x) => (
          <li key={x.id}>
            <Card>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={x.owner_type === "user" ? `/admin/users/${x.owner_id}` : `/admin/companies/${x.owner_id}`} className="font-medium text-primary hover:underline">{name(x) ?? "Unknown"}</Link>
                  <Badge>{x.plans.name}</Badge>
                  <Badge tone={SUB_STATUS[x.status]?.tone ?? "neutral"}>{SUB_STATUS[x.status]?.label ?? x.status}</Badge>
                  {x.plan_prices && <span className="text-sm text-muted">{money(x.plan_prices.amount_cents)}/{x.plan_prices.billing_interval}</span>}
                  <span className="text-sm text-muted">
                    {x.status === "trialing" && x.trial_end ? `trial ends ${shortDate(x.trial_end)}` : x.current_period_end ? `${x.cancel_at_period_end ? "ends" : "renews"} ${shortDate(x.current_period_end)}` : x.comp_expires_at ? `until ${shortDate(x.comp_expires_at)}` : ""}
                  </span>
                </div>
                {x.stripe_subscription_id ? (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">Manage</summary>
                    <div className="space-y-3 pt-3">
                      {x.status === "trialing" && <ExtendTrialForm stripeSubId={x.stripe_subscription_id} />}
                      <CreditForm ownerType={x.owner_type} ownerId={x.owner_id} />
                      <div className="flex flex-wrap gap-2">
                        {!x.cancel_at_period_end && <ActionButton action={cancelSubscriptionAction.bind(null, x.stripe_subscription_id, false)} tone="danger" confirm="Click again to cancel at period end">Cancel at period end</ActionButton>}
                        <ActionButton action={cancelSubscriptionAction.bind(null, x.stripe_subscription_id, true)} tone="danger" confirm="Click again — ends access now">Cancel now</ActionButton>
                        <a href={`https://dashboard.stripe.com/subscriptions/${x.stripe_subscription_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center px-2.5 text-sm text-primary">Open in Stripe</a>
                      </div>
                    </div>
                  </details>
                ) : x.status === "complimentary" ? (
                  <ActionButton action={endComplimentaryAction.bind(null, x.id)} tone="danger" confirm="Click again to end">End complimentary plan</ActionButton>
                ) : null}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
