import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerForCustomer, type OwnerType } from "@/lib/billing/customers";
import { toIso, verifyWebhook } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function ownerFrom(obj: Obj): Promise<{ ownerType: OwnerType; ownerId: string } | null> {
  const meta = obj.metadata ?? {};
  if ((meta.owner_type === "user" || meta.owner_type === "company") && typeof meta.owner_id === "string") {
    return { ownerType: meta.owner_type, ownerId: meta.owner_id };
  }
  const customer = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
  return customer ? ownerForCustomer(customer) : null;
}

async function handleSubscription(sub: Obj) {
  const owner = await ownerFrom(sub);
  if (!owner) throw new Error(`No TalentLoom owner for subscription ${sub.id}`);
  const item = sub.items?.data?.[0] ?? {};
  const { error } = await createAdminClient().rpc("billing_upsert_subscription", {
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
    p_stripe_subscription_id: sub.id,
    p_stripe_price_id: item.price?.id,
    p_status: sub.status,
    // Newer Stripe API versions keep billing periods on the subscription item.
    p_period_start: toIso(sub.current_period_start ?? item.current_period_start),
    p_period_end: toIso(sub.current_period_end ?? item.current_period_end),
    p_cancel_at_period_end: !!sub.cancel_at_period_end,
    p_canceled_at: toIso(sub.canceled_at ?? sub.ended_at),
    p_trial_end: toIso(sub.trial_end),
  });
  if (error) throw new Error(error.message);
}

async function handleInvoice(inv: Obj, failed: boolean) {
  const details = inv.parent?.subscription_details ?? inv.subscription_details ?? {};
  const owner = await ownerFrom({ metadata: details.metadata ?? inv.metadata, customer: inv.customer });
  if (!owner) throw new Error(`No TalentLoom owner for invoice ${inv.id}`);
  const line = inv.lines?.data?.[0];
  const { error } = await createAdminClient().rpc("billing_record_invoice", {
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
    p_stripe_invoice_id: inv.id,
    p_description: line?.description ?? inv.description ?? "TalentLoom subscription",
    p_amount_cents: failed ? inv.amount_due ?? 0 : inv.amount_paid ?? inv.amount_due ?? 0,
    p_currency: inv.currency ?? "usd",
    p_status: failed ? "failed" : inv.status === "paid" ? "paid" : inv.status ?? "open",
    p_hosted_url: inv.hosted_invoice_url ?? null,
    p_pdf_url: inv.invoice_pdf ?? null,
    p_paid_at: inv.status === "paid" ? toIso(inv.status_transitions?.paid_at) ?? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);
}

/** Stripe → TalentLoom. Every event is stored once (idempotent) and processed. */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const payload = await request.text();
  if (!secret || !verifyWebhook(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { id: string; type: string; data: { object: Obj } };
  const admin = createAdminClient();

  const { data: existing } = await admin.from("billing_events").select("id, processed_at").eq("stripe_event_id", event.id).maybeSingle();
  if (existing?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  if (!existing) {
    await admin.from("billing_events").insert({ stripe_event_id: event.id, type: event.type, payload: event });
  }

  try {
    const obj = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        // Remember which customer belongs to which owner (subscription events follow).
        const owner = await ownerFrom(obj);
        if (owner && typeof obj.customer === "string") {
          await admin.from("billing_customers").upsert(
            { owner_type: owner.ownerType, owner_id: owner.ownerId, stripe_customer_id: obj.customer }, { onConflict: "owner_type,owner_id" });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await handleSubscription(obj);
        break;
      case "customer.subscription.trial_will_end": {
        const owner = await ownerFrom(obj);
        if (owner) await admin.rpc("billing_notify_trial_ending", { p_owner_type: owner.ownerType, p_owner_id: owner.ownerId, p_trial_end: toIso(obj.trial_end) });
        break;
      }
      case "invoice.paid":
      case "invoice.finalized":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        await handleInvoice(obj, false);
        break;
      case "invoice.payment_failed":
        await handleInvoice(obj, true);
        break;
      default:
        break; // other events are stored for reference only
    }
    await admin.from("billing_events").update({ processed_at: new Date().toISOString(), error: null }).eq("stripe_event_id", event.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[stripe:webhook]", event.type, message);
    await admin.from("billing_events").update({ error: message.slice(0, 500) }).eq("stripe_event_id", event.id);
    // 500 makes Stripe retry later (e.g. if the plan prices haven't been synced yet).
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
