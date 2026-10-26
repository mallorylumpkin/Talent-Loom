"use server";

import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/company/context";
import { getOrCreateCustomer } from "@/lib/billing/customers";
import { stripe, stripeConfigured, StripeError } from "@/lib/billing/stripe";
import { publicEnv } from "@/lib/env";
import type { FormState } from "@/lib/actions/types";

/** Creator Pro self-serve checkout (monthly or yearly). */
export async function startCreatorCheckoutAction(interval: "month" | "year"): Promise<FormState> {
  const viewer = await requireViewer("/creator/billing");
  if (viewer.accountType !== "creator") return { message: "Only creators can buy Creator Pro." };
  if (!stripeConfigured()) return { message: "Payments aren't switched on yet. Please check back soon." };
  const supabase = await createClient();
  const { data: price } = await supabase.from("plan_prices")
    .select("stripe_price_id, plans!inner(key, trial_days)").eq("plans.key", "creator_pro").eq("billing_interval", interval).eq("active", true).maybeSingle();
  if (!price?.stripe_price_id) return { message: "This plan isn't available for purchase yet." };
  const { data: existing } = await supabase.from("subscriptions").select("id").eq("owner_type", "user").eq("owner_id", viewer.id)
    .not("stripe_subscription_id", "is", null).in("status", ["active", "trialing", "past_due"]).limit(1);
  if (existing?.length) return { message: "You already have Creator Pro. Use “Manage billing” to change it." };
  const { count: hadTrial } = await supabase.from("subscriptions").select("id", { count: "exact", head: true })
    .eq("owner_type", "user").eq("owner_id", viewer.id).not("stripe_subscription_id", "is", null);
  const trialDays = (price.plans as unknown as { trial_days: number }).trial_days;

  let url: string;
  try {
    const customer = await getOrCreateCustomer("user", viewer.id, viewer.email, viewer.displayName);
    const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      customer,
      client_reference_id: viewer.id,
      line_items: [{ price: price.stripe_price_id, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${publicEnv.siteUrl()}/creator/billing?checkout=success`,
      cancel_url: `${publicEnv.siteUrl()}/creator/billing?checkout=cancelled`,
      metadata: { owner_type: "user", owner_id: viewer.id },
      subscription_data: {
        metadata: { owner_type: "user", owner_id: viewer.id },
        ...(trialDays > 0 && !hadTrial ? { trial_period_days: trialDays } : {}),
      },
    });
    url = session.url;
  } catch (e) {
    return { message: e instanceof StripeError ? `We couldn't start checkout: ${e.message}` : "We couldn't start checkout." };
  }
  redirect(url);
}

/** Stripe's hosted billing portal: change card, switch monthly/yearly, cancel, download invoices. */
export async function openBillingPortalAction(): Promise<FormState> {
  const viewer = await requireViewer();
  if (!stripeConfigured()) return { message: "Payments aren't switched on yet." };
  const supabase = await createClient();
  let ownerType: "user" | "company" = "user";
  let ownerId = viewer.id;
  let returnPath = "/creator/billing";
  if (viewer.accountType === "company_member") {
    const { company, permissions } = await getCompanyContext();
    if (!company || !permissions.has("billing.view")) return { message: "Your role doesn't include billing." };
    ownerType = "company";
    ownerId = company.id;
    returnPath = "/company/billing";
  }
  const { data: cust } = await supabase.from("billing_customers").select("stripe_customer_id").eq("owner_type", ownerType).eq("owner_id", ownerId).maybeSingle();
  if (!cust?.stripe_customer_id) return { message: "There's no billing account yet." };
  let url: string;
  try {
    const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
      customer: cust.stripe_customer_id, return_url: `${publicEnv.siteUrl()}${returnPath}`,
    });
    url = session.url;
  } catch (e) {
    return { message: e instanceof StripeError ? e.message : "We couldn't open billing." };
  }
  redirect(url);
}
