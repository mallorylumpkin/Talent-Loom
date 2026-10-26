import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PortalButton } from "@/components/billing/billing-buttons";
import { InvoiceList, money, SUB_STATUS, type Payment } from "@/components/billing/billing-ui";
import { feature, requireCompany } from "@/lib/company/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Plan & billing" };

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-ink">{label}</span>
        <span className="tabular text-muted">{used} / {limit === null ? "∞" : limit}</span></div>
      {limit !== null && limit > 0 && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/5">
          <div className={pct >= 90 ? "h-full bg-warning" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default async function CompanyBillingPage() {
  const { supabase, company, permissions, entitlements } = await requireCompany();
  if (!permissions.has("billing.view")) {
    return <Alert tone="warning">Your role doesn&apos;t include billing. Ask your company owner.</Alert>;
  }
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [{ data: subs }, { data: payments }, { data: customer }, { data: credits }, { count: seats }, { data: inquiries }, { count: pipelines }, { data: saved }] = await Promise.all([
    supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end, trial_end, comp_expires_at, stripe_subscription_id, plans(name), plan_prices(amount_cents, billing_interval)")
      .eq("owner_type", "company").eq("owner_id", company.id).in("status", ["active", "trialing", "past_due", "complimentary", "unpaid", "paused"])
      .order("created_at", { ascending: false }).limit(1),
    supabase.from("payments").select("id, description, amount_cents, currency, status, hosted_invoice_url, invoice_pdf_url, created_at, paid_at")
      .eq("owner_type", "company").eq("owner_id", company.id).order("created_at", { ascending: false }).limit(24),
    supabase.from("billing_customers").select("stripe_customer_id").eq("owner_type", "company").eq("owner_id", company.id).maybeSingle(),
    supabase.rpc("company_credit_balance", { p_company_id: company.id }),
    supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company.id).in("status", ["active", "invited"]),
    supabase.from("representation_inquiries").select("creator_id").eq("company_id", company.id).gte("created_at", monthStart),
    supabase.from("pipelines").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("talent_list_members").select("creator_id, talent_lists!inner(company_id)").eq("talent_lists.company_id", company.id),
  ]);
  type Sub = { status: string; current_period_end: string | null; cancel_at_period_end: boolean; trial_end: string | null; comp_expires_at: string | null;
    stripe_subscription_id: string | null; plans: { name: string }; plan_prices: { amount_cents: number; billing_interval: string } | null };
  const sub = (subs?.[0] ?? null) as unknown as Sub | null;
  const contacted = new Set((inquiries ?? []).map((i: { creator_id: string }) => i.creator_id)).size;
  const savedCount = new Set((saved ?? []).map((s: { creator_id: string }) => s.creator_id)).size;

  return (
    <>
      <PageHeader title="Plan & billing" description="Plans for management companies are set up with the TalentLoom team." />
      {sub?.status === "past_due" && <Alert tone="warning" className="mb-6">Your last payment didn&apos;t go through. Update your card in “Manage billing” to keep your plan.</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Current plan" action={sub && <Badge tone={SUB_STATUS[sub.status]?.tone ?? "neutral"}>{SUB_STATUS[sub.status]?.label ?? sub.status}</Badge>} />
          <CardBody className="space-y-3">
            <p className="font-display text-2xl font-semibold text-ink">{sub?.plans.name ?? "No plan yet"}</p>
            {sub?.plan_prices && <p className="text-sm text-muted">{money(sub.plan_prices.amount_cents)} / {sub.plan_prices.billing_interval}</p>}
            {sub?.status === "trialing" && sub.trial_end && <p className="text-sm text-muted">Trial until {shortDate(sub.trial_end)}.</p>}
            {sub?.current_period_end && sub.stripe_subscription_id && <p className="text-sm text-muted">{sub.cancel_at_period_end ? "Ends" : "Renews"} on {shortDate(sub.current_period_end)}.</p>}
            {sub?.status === "complimentary" && <p className="text-sm text-muted">Provided by TalentLoom{sub.comp_expires_at ? ` until ${shortDate(sub.comp_expires_at)}` : ""}.</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {customer?.stripe_customer_id && <PortalButton />}
              <ButtonLink href="/for-companies#contact" variant="secondary">Change plan</ButtonLink>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Usage" />
          <CardBody className="space-y-4">
            <Usage label="New creators contacted this month" used={contacted} limit={feature(entitlements, "contacts.monthly").limit} />
            {(credits as number | null) ? <p className="text-sm text-muted">+ {credits as number} extra contact credit{credits === 1 ? "" : "s"} available</p> : null}
            <Usage label="Team seats" used={seats ?? 0} limit={feature(entitlements, "seats.max").limit} />
            <Usage label="Saved creators" used={savedCount} limit={feature(entitlements, "saved_creators.max").limit} />
            <Usage label="Pipelines" used={pipelines ?? 0} limit={feature(entitlements, "pipelines.max").limit} />
          </CardBody>
        </Card>
      </div>
      <div className="mt-6"><InvoiceList payments={(payments ?? []) as Payment[]} /></div>
    </>
  );
}
