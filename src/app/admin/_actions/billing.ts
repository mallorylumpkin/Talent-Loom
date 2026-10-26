"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateCustomer } from "@/lib/billing/customers";
import { stripe, stripeConfigured, StripeError } from "@/lib/billing/stripe";
import { publicEnv } from "@/lib/env";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

const fail = (e: unknown): FormState => ({ message: e instanceof StripeError ? `Stripe: ${e.message}` : "Something went wrong." });
const unix = (iso: string) => Math.floor(new Date(`${iso}T23:59:59Z`).getTime() / 1000);

/* ---------- Plans & pricing ---------- */

export async function updatePlanAction(planId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!uuid.safeParse(planId).success) return { message: "Plan not found" };
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const trial = Number(fd.get("trialDays") ?? 0);
  if (!name) return { errors: { name: "Enter a name" } };
  if (!Number.isInteger(trial) || trial < 0 || trial > 365) return { errors: { trialDays: "0–365 days" } };
  const { error } = await supabase.from("plans").update({
    name, description: String(fd.get("description") ?? "").trim().slice(0, 300) || null, trial_days: trial,
    is_public: fd.get("public") === "on", is_active: fd.get("active") === "on", sales_led: fd.get("salesLed") === "on",
  }).eq("id", planId);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Saved" };
}

/** Prices are never edited in place (existing subscribers keep theirs): a new price replaces the old one. */
export async function setPriceAction(planId: string, interval: "month" | "year", _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const dollars = Number(String(fd.get("amount") ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > 100000) return { errors: { amount: "Enter a price in dollars" } };
  const cents = Math.round(dollars * 100);
  const { data: current } = await supabase.from("plan_prices").select("id, amount_cents, stripe_price_id")
    .eq("plan_id", planId).eq("billing_interval", interval).eq("active", true).maybeSingle();
  if (current?.amount_cents === cents) return { ok: true, message: "No change" };
  if (current) {
    await supabase.from("plan_prices").update({ active: false }).eq("id", current.id);
    if (current.stripe_price_id && stripeConfigured()) {
      try { await stripe("POST", `/prices/${current.stripe_price_id}`, { active: false }); } catch (e) { console.error(e); }
    }
  }
  const { error } = await supabase.from("plan_prices").insert({ plan_id: planId, billing_interval: interval, amount_cents: cents });
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Price updated — click “Sync to Stripe” to make it purchasable. Existing subscribers keep their price." };
}

export async function setPlanFeatureAction(planId: string, featureKey: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const enabled = fd.get("enabled") === "on";
  const raw = String(fd.get("limit") ?? "").trim();
  const limit = raw === "" ? null : Number(raw);
  if (limit !== null && (!Number.isInteger(limit) || limit < 0)) return { message: "Limit must be a whole number (blank = unlimited)" };
  const { error } = await supabase.from("plan_features")
    .upsert({ plan_id: planId, feature_key: featureKey, enabled, limit_value: limit }, { onConflict: "plan_id,feature_key" });
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Saved" };
}

/** Creates Stripe products/prices for any plan prices that don't have one yet. */
export async function syncStripeAction(): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!stripeConfigured()) return { message: "Add STRIPE_SECRET_KEY first (see docs/BILLING.md)." };
  // Uses the admin's own (MFA) session, so it works even if the server key is misconfigured.
  const { data: plans } = await supabase.from("plans").select("id, key, name, description, stripe_product_id, plan_prices(id, billing_interval, amount_cents, currency, active, stripe_price_id)")
    .neq("key", "company_pending").neq("key", "creator_free");
  let created = 0;
  try {
    for (const p of (plans ?? []) as { id: string; key: string; name: string; description: string | null; stripe_product_id: string | null;
      plan_prices: { id: string; billing_interval: string; amount_cents: number; currency: string; active: boolean; stripe_price_id: string | null }[] }[]) {
      const prices = p.plan_prices.filter((x) => x.active && !x.stripe_price_id && x.amount_cents > 0);
      if (!prices.length) continue;
      let product = p.stripe_product_id;
      if (!product) {
        const prod = await stripe<{ id: string }>("POST", "/products", { name: `TalentLoom ${p.name}`, description: p.description ?? undefined, metadata: { plan_key: p.key } }, `product-${p.id}`);
        product = prod.id;
        const { data: saved, error: saveError } = await supabase.from("plans").update({ stripe_product_id: product }).eq("id", p.id).select("id");
        if (saveError || !saved?.length) return { message: `Created in Stripe but couldn't save to TalentLoom (${saveError?.message ?? "no permission"}). Sign out and back in as admin, then try again.` };
      }
      for (const pr of prices) {
        const price = await stripe<{ id: string }>("POST", "/prices", {
          product, unit_amount: pr.amount_cents, currency: pr.currency.toLowerCase(), recurring: { interval: pr.billing_interval },
          metadata: { plan_key: p.key, plan_price_id: pr.id },
        }, `price-${pr.id}`);
        const { data: saved, error: saveError } = await supabase.from("plan_prices").update({ stripe_price_id: price.id }).eq("id", pr.id).select("id");
        if (saveError || !saved?.length) return { message: `Created in Stripe but couldn't save to TalentLoom (${saveError?.message ?? "no permission"}). Sign out and back in as admin, then try again.` };
        created++;
      }
    }
  } catch (e) {
    return fail(e);
  }
  await supabase.rpc("admin_log", { p_action: "billing.sync_stripe", p_target_type: "plans", p_target_id: "all", p_metadata: { created } });
  revalidatePath("/admin/plans");
  return { ok: true, message: created ? `Created ${created} price${created === 1 ? "" : "s"} in Stripe.` : "Everything is already in Stripe." };
}

/* ---------- Subscriptions ---------- */

export async function grantComplimentaryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const planKey = String(fd.get("plan") ?? "");
  const until = String(fd.get("until") ?? "");
  const { data: plan } = await supabase.from("plans").select("id, audience").eq("key", planKey).maybeSingle();
  if (!plan) return { errors: { plan: "Choose a plan" } };
  let ownerType: "user" | "company";
  let ownerId: string;
  if (plan.audience === "creator") {
    const { data: u } = await supabase.from("profiles").select("id, account_type").ilike("email", email).maybeSingle();
    if (!u || u.account_type !== "creator") return { errors: { email: "No creator account with that email" }, values: { email } };
    ownerType = "user"; ownerId = u.id;
  } else {
    const { data: c } = await supabase.from("companies").select("id").eq("slug", email).maybeSingle();
    const companyId = c?.id ?? (await supabase.from("company_members").select("company_id, profiles!inner(email)").ilike("profiles.email", email).limit(1).maybeSingle()).data?.company_id;
    if (!companyId) return { errors: { email: "Enter a company member's email (or the company's web address slug)" }, values: { email } };
    ownerType = "company"; ownerId = companyId as string;
  }
  await supabase.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("owner_type", ownerType).eq("owner_id", ownerId).is("stripe_subscription_id", null).in("status", ["active", "trialing", "complimentary"]);
  const { error } = await supabase.from("subscriptions").insert({
    owner_type: ownerType, owner_id: ownerId, plan_id: plan.id, status: "complimentary", collection_method: "none",
    is_complimentary: true, comp_expires_at: /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59Z` : null,
  });
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/subscriptions");
  return { ok: true, message: "Complimentary plan granted" };
}

export async function endComplimentaryAction(subscriptionId: string): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const { error } = await supabase.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", subscriptionId).is("stripe_subscription_id", null);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/subscriptions");
  return { ok: true, message: "Ended" };
}

export async function extendTrialAction(stripeSubId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const until = String(fd.get("until") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || unix(until) * 1000 < Date.now()) return { errors: { until: "Choose a future date" } };
  try {
    await stripe("POST", `/subscriptions/${encodeURIComponent(stripeSubId)}`, { trial_end: unix(until), proration_behavior: "none" });
  } catch (e) {
    return fail(e);
  }
  await supabase.rpc("admin_log", { p_action: "billing.extend_trial", p_target_type: "subscriptions", p_target_id: stripeSubId, p_metadata: { until } });
  return { ok: true, message: "Trial extended. The change appears here once Stripe confirms it (a few seconds)." };
}

export async function cancelSubscriptionAction(stripeSubId: string, immediately: boolean): Promise<FormState> {
  const { supabase } = await getAdminContext();
  try {
    if (immediately) await stripe("DELETE", `/subscriptions/${encodeURIComponent(stripeSubId)}`);
    else await stripe("POST", `/subscriptions/${encodeURIComponent(stripeSubId)}`, { cancel_at_period_end: true });
  } catch (e) {
    return fail(e);
  }
  await supabase.rpc("admin_log", { p_action: "billing.cancel", p_target_type: "subscriptions", p_target_id: stripeSubId, p_metadata: { immediately } });
  return { ok: true, message: immediately ? "Canceled" : "Will cancel at the end of the period" };
}

/** Account credit: reduces the customer's next invoices in Stripe. */
export async function applyCreditAction(ownerType: "user" | "company", ownerId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const dollars = Number(String(fd.get("amount") ?? "").replace(/[$,\s]/g, ""));
  const note = String(fd.get("note") ?? "").trim().slice(0, 200) || "Account credit from TalentLoom";
  if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 10000) return { errors: { amount: "Enter an amount in dollars" } };
  const { data: cust } = await supabase.from("billing_customers").select("stripe_customer_id").eq("owner_type", ownerType).eq("owner_id", ownerId).maybeSingle();
  if (!cust) return { message: "This account has no Stripe customer yet." };
  try {
    await stripe("POST", `/customers/${cust.stripe_customer_id}/balance_transactions`, { amount: -Math.round(dollars * 100), currency: "usd", description: note });
  } catch (e) {
    return fail(e);
  }
  await supabase.rpc("admin_log", { p_action: "billing.credit", p_target_type: ownerType === "user" ? "profiles" : "companies", p_target_id: ownerId, p_metadata: { dollars, note } });
  return { ok: true, message: `$${dollars} credit applied to their next invoice(s).` };
}

export async function addContactCreditsAction(companyId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  const n = Number(fd.get("credits"));
  if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 1000) return { errors: { credits: "Enter a whole number (negative removes credits)" } };
  const expires = String(fd.get("expires") ?? "");
  const { error } = await supabase.from("contact_credit_ledger").insert({
    company_id: companyId, delta: n, reason: String(fd.get("reason") ?? "").trim().slice(0, 200) || "Granted by TalentLoom",
    source: "admin", created_by: viewer.id, expires_at: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? `${expires}T23:59:59Z` : null,
  });
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true, message: `${n > 0 ? "Added" : "Removed"} ${Math.abs(n)} contact credit${Math.abs(n) === 1 ? "" : "s"}` };
}

/** Sales-led plans: a Stripe checkout link the admin sends to a company owner. */
export async function companyCheckoutLinkAction(companyId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!stripeConfigured()) return { message: "Add STRIPE_SECRET_KEY first." };
  const priceId = String(fd.get("priceId") ?? "");
  const { data: price } = await supabase.from("plan_prices").select("stripe_price_id, plans!inner(audience, trial_days)").eq("id", priceId).maybeSingle();
  const plan = price?.plans as unknown as { audience: string; trial_days: number } | undefined;
  if (!price?.stripe_price_id || plan?.audience !== "company") return { errors: { priceId: "Choose a synced company price" } };
  const { data: company } = await supabase.from("companies").select("id, name, contact_email").eq("id", companyId).single();
  try {
    const customer = await getOrCreateCustomer("company", companyId, company?.contact_email ?? null, company?.name ?? null);
    const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription", customer, line_items: [{ price: price.stripe_price_id, quantity: 1 }], allow_promotion_codes: true,
      success_url: `${publicEnv.siteUrl()}/company/billing?checkout=success`, cancel_url: `${publicEnv.siteUrl()}/company/billing`,
      metadata: { owner_type: "company", owner_id: companyId },
      subscription_data: { metadata: { owner_type: "company", owner_id: companyId }, ...(plan.trial_days > 0 && fd.get("trial") === "on" ? { trial_period_days: plan.trial_days } : {}) },
      expires_at: Math.floor(Date.now() / 1000) + 23 * 3600,
    });
    await supabase.rpc("admin_log", { p_action: "billing.checkout_link", p_target_type: "companies", p_target_id: companyId, p_metadata: { price: price.stripe_price_id } });
    return { ok: true, message: "Payment link (valid ~23 hours) — send it to the company owner:", data: { link: session.url } };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Promo codes ---------- */

export async function createPromoAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!stripeConfigured()) return { message: "Add STRIPE_SECRET_KEY first." };
  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  const kind = fd.get("kind") === "amount" ? "amount" : "percent";
  const value = Number(fd.get("value"));
  const duration = ["once", "repeating", "forever"].includes(String(fd.get("duration"))) ? String(fd.get("duration")) : "once";
  const months = Number(fd.get("months"));
  const max = Number(fd.get("max"));
  const expires = String(fd.get("expires") ?? "");
  const planKeys = fd.getAll("plans").map(String).filter(Boolean);
  const values = { code, value: String(fd.get("value") ?? "") };
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return { errors: { code: "3–40 letters, numbers, - or _" }, values };
  if (!(value > 0) || (kind === "percent" && value > 100)) return { errors: { value: kind === "percent" ? "1–100" : "Enter dollars" }, values };
  if (duration === "repeating" && !(months >= 1 && months <= 36)) return { errors: { months: "1–36 months" }, values };

  const { data: plans } = planKeys.length
    ? await supabase.from("plans").select("stripe_product_id").in("key", planKeys).not("stripe_product_id", "is", null)
    : { data: [] as { stripe_product_id: string }[] };
  try {
    const coupon = await stripe<{ id: string }>("POST", "/coupons", {
      name: code,
      duration,
      ...(duration === "repeating" ? { duration_in_months: months } : {}),
      ...(kind === "percent" ? { percent_off: value } : { amount_off: Math.round(value * 100), currency: "usd" }),
      ...(plans?.length ? { applies_to: { products: plans.map((p) => p.stripe_product_id) } } : {}),
    });
    const promo = await stripe<{ id: string }>("POST", "/promotion_codes", {
      coupon: coupon.id, code,
      ...(max > 0 ? { max_redemptions: Math.round(max) } : {}),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(expires) ? { expires_at: unix(expires) } : {}),
    });
    const { error } = await supabase.from("promo_codes").insert({
      code, stripe_coupon_id: coupon.id, stripe_promotion_code_id: promo.id,
      percent_off: kind === "percent" ? value : null, amount_off_cents: kind === "amount" ? Math.round(value * 100) : null,
      duration, duration_months: duration === "repeating" ? months : null, applies_to_plan_keys: planKeys,
      max_redemptions: max > 0 ? Math.round(max) : null, expires_at: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? `${expires}T23:59:59Z` : null,
    });
    if (error) return { message: dbErrorMessage(error), values };
  } catch (e) {
    return { ...fail(e), values };
  }
  revalidatePath("/admin/promo-codes");
  return { ok: true, message: `${code} is live — customers can enter it at checkout.` };
}

export async function deactivatePromoAction(id: string): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const { data: promo } = await supabase.from("promo_codes").select("stripe_promotion_code_id").eq("id", id).maybeSingle();
  if (promo?.stripe_promotion_code_id && stripeConfigured()) {
    try { await stripe("POST", `/promotion_codes/${promo.stripe_promotion_code_id}`, { active: false }); } catch (e) { return fail(e); }
  }
  await supabase.from("promo_codes").update({ active: false }).eq("id", id);
  revalidatePath("/admin/promo-codes");
  return { ok: true, message: "Deactivated" };
}
