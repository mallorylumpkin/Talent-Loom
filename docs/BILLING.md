# Billing with Stripe

TalentLoom uses Stripe for payments. Start in **test mode** — no real money moves until you switch to live keys.

- **Creators** buy Creator Pro themselves on **Billing** (monthly or yearly, optional free trial, promo codes at checkout).
- **Companies** are sales-led: you assign a complimentary plan, or create a **payment link** on the company's admin page
  and send it to the owner. They manage their card and invoices from **Plan & billing → Manage billing**.
- Stripe tells TalentLoom about payments through a **webhook**; plans unlock automatically within seconds.
- Plans, prices, features and limits are edited in **Admin → Plans & pricing**. Promo codes in **Admin → Promo codes**.

## 1. Get your test keys (Stripe dashboard)

1. Create an account at **https://dashboard.stripe.com** (you can skip activating payments for now).
2. Make sure the **Test mode** switch (top right) is ON.
3. **Developers → API keys**: copy the **Secret key** (`sk_test_…`) and **Publishable key** (`pk_test_…`).

## 2. Add the webhook (needs your live Vercel site)

1. **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://YOUR-DOMAIN/api/stripe/webhook`
3. Select events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`,
   `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.finalized`, `invoice.payment_failed`,
   `invoice.voided`, `invoice.marked_uncollectible`
4. Save, then click **Reveal** under *Signing secret* and copy it (`whsec_…`).

## 3. Turn on the customer portal

**Settings → Billing → Customer portal** → **Activate** (test mode). Allow customers to update payment methods, view
invoices, cancel subscriptions, and switch plans between Creator Pro monthly and yearly.

## 4. Add the keys to Vercel

Vercel → Project → **Settings → Environment Variables**:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Redeploy (Deployments → ⋯ → Redeploy).

## 5. Send your plans to Stripe

Admin → **Plans & pricing** → **Sync to Stripe**. This creates a Stripe product and price for every plan price.
Each "In Stripe ✓" means it's purchasable. Changing a price later creates a new price (existing subscribers keep the old
one) — click Sync again after.

## 6. Test it

1. Sign in as a creator → **Billing** → **Upgrade monthly**.
2. Pay with card **4242 4242 4242 4242**, any future date, any CVC, any ZIP.
3. You return to Billing; Creator Pro appears within a few seconds (Pro tools unlock).
4. Admin → **Subscriptions** shows it, with MRR. **Manage billing** opens Stripe's portal (try cancelling).
5. Failed payment test: card **4000 0000 0000 0341** → the creator gets a "payment failed" notification.

## 7. Go live (when you're ready to take real money)

1. Activate your Stripe account (business details, bank account).
2. Switch the dashboard to **Live mode** and repeat steps 1–3 (live keys, a live webhook, live portal settings).
3. Replace the three variables in Vercel with the live values and redeploy.
4. Admin → Plans & pricing → **Sync to Stripe** again (live mode has its own products/prices).

## What admins can do

- **Subscriptions**: MRR, 30-day revenue and churn, grant complimentary plans (with end date), extend a trial, apply an
  account credit (reduces their next invoices), cancel at period end or immediately. **Payments** tab lists invoices.
- **Company page → Billing**: create a Stripe payment link for a company plan; add **contact credits** (extra creators
  they can contact beyond their monthly allowance — used automatically when the allowance runs out).
- **Promo codes**: percent or dollar off, first payment / several months / forever, limit to plans, max uses, expiry.
