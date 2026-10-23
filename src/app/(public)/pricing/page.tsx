import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Pricing" };

interface Plan {
  id: string;
  key: string;
  audience: "creator" | "company";
  name: string;
  description: string | null;
  sales_led: boolean;
  trial_days: number;
  plan_prices: { billing_interval: "month" | "year"; amount_cents: number; currency: string; active: boolean }[];
  plan_features: { feature_key: string; enabled: boolean; limit_value: number | null }[];
}
interface Feature {
  key: string;
  kind: "boolean" | "limit";
  label: string;
  audience: string;
  sort: number;
}

const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

function featureLines(plan: Plan, features: Feature[]): string[] {
  const byKey = new Map(plan.plan_features.map((f) => [f.feature_key, f]));
  return features
    .filter((f) => f.audience === plan.audience)
    .flatMap((f) => {
      const pf = byKey.get(f.key);
      if (!pf?.enabled) return [];
      if (f.kind === "limit") {
        if (pf.limit_value === 0) return [];
        return [`${pf.limit_value === null ? "Unlimited" : pf.limit_value.toLocaleString()} ${f.label.toLowerCase()}`];
      }
      return [f.label];
    });
}

function PlanCard({ plan, features, highlight }: { plan: Plan; features: Feature[]; highlight?: boolean }) {
  const prices = plan.plan_prices.filter((p) => p.active);
  const monthly = prices.find((p) => p.billing_interval === "month");
  const yearly = prices.find((p) => p.billing_interval === "year");
  const isFree = plan.key === "creator_free";
  const lines = isFree
    ? ["Public creator profile", "Manual analytics", "Media kit and portfolio", "Seeking-management status",
       "Receive and respond to inquiries — always free", "Basic privacy controls", "Profile view count", ...featureLines(plan, features)]
    : featureLines(plan, features);

  return (
    <div className={cn("flex flex-col rounded-[var(--radius-card)] border bg-surface p-6",
      highlight ? "border-2 border-primary shadow-[var(--shadow-pop)]" : "border-line")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xl font-semibold text-ink">{plan.name}</h3>
        {highlight && <Badge tone="primary">Most popular</Badge>}
      </div>
      {plan.description && <p className="mt-1 text-sm text-muted">{plan.description}</p>}
      <div className="mt-5 min-h-16">
        {isFree ? (
          <p className="font-display text-4xl font-bold text-ink">$0</p>
        ) : monthly ? (
          <>
            <p className="font-display text-4xl font-bold text-ink">
              {money(monthly.amount_cents, monthly.currency)}
              <span className="font-sans text-base font-normal text-muted"> / month</span>
            </p>
            {yearly && <p className="mt-1 text-sm text-muted">or {money(yearly.amount_cents, yearly.currency)} billed yearly</p>}
          </>
        ) : (
          <p className="font-display text-4xl font-bold text-ink">Custom</p>
        )}
      </div>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {lines.map((line) => (
          <li key={line} className="flex gap-2.5 text-ink/85">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-7">
        {plan.audience === "creator" ? (
          <ButtonLink href="/signup" className="w-full" variant={highlight ? "primary" : "secondary"}>
            {isFree ? "Join free" : "Start free, upgrade anytime"}
          </ButtonLink>
        ) : (
          <ButtonLink href={`/for-companies?plan=${plan.key}#contact`} className="w-full" variant={highlight ? "primary" : "secondary"}>
            Contact sales
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

export default async function PricingPage() {
  const supabase = await createClient();
  const [{ data: plans }, { data: features }] = await Promise.all([
    supabase
      .from("plans")
      .select("id, key, audience, name, description, sales_led, trial_days, plan_prices(billing_interval, amount_cents, currency, active), plan_features(feature_key, enabled, limit_value)")
      .order("sort"),
    supabase.from("features").select("key, kind, label, audience, sort").order("sort"),
  ]);
  const all = (plans ?? []) as Plan[];
  const feats = (features ?? []) as Feature[];
  const creatorPlans = all.filter((p) => p.audience === "creator");
  const companyPlans = all.filter((p) => p.audience === "company");

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-ink sm:text-5xl">Simple, honest pricing</h1>
        <p className="mt-4 text-lg text-muted">
          Creators never pay to receive or respond to a representation inquiry.
        </p>
      </div>

      <section className="mt-14" aria-labelledby="creator-plans">
        <h2 id="creator-plans" className="text-2xl font-bold text-ink">For creators</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:max-w-4xl">
          {creatorPlans.map((p) => (
            <PlanCard key={p.id} plan={p} features={feats} highlight={p.key === "creator_pro"} />
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="company-plans">
        <h2 id="company-plans" className="text-2xl font-bold text-ink">For management companies</h2>
        <p className="mt-2 text-muted">Every company is reviewed before activation. Talk to our team to get set up.</p>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {companyPlans.map((p) => (
            <PlanCard key={p.id} plan={p} features={feats} highlight={p.key === "management_agency"} />
          ))}
        </div>
      </section>
    </div>
  );
}
