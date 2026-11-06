import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeMode, stripeObjectExists } from "./stripe";

export type OwnerType = "user" | "company";

/** The Stripe customer for a user or company, created on first use. */
export async function getOrCreateCustomer(ownerType: OwnerType, ownerId: string, email: string | null, name: string | null): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("billing_customers").select("stripe_customer_id").eq("owner_type", ownerType).eq("owner_id", ownerId).maybeSingle();
  // A customer saved while Stripe was in test mode doesn't exist in live mode (and vice versa): make a new one.
  if (data?.stripe_customer_id && await stripeObjectExists(`/customers/${data.stripe_customer_id}`)) return data.stripe_customer_id as string;
  const customer = await stripe<{ id: string }>("POST", "/customers", {
    email: email ?? undefined,
    name: name ?? undefined,
    metadata: { owner_type: ownerType, owner_id: ownerId },
  }, `${stripeMode()}-customer-${ownerType}-${ownerId}-${data?.stripe_customer_id ?? "new"}`);
  await admin.from("billing_customers").upsert({ owner_type: ownerType, owner_id: ownerId, stripe_customer_id: customer.id }, { onConflict: "owner_type,owner_id" });
  return customer.id;
}

export async function ownerForCustomer(customerId: string): Promise<{ ownerType: OwnerType; ownerId: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("billing_customers").select("owner_type, owner_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data ? { ownerType: data.owner_type as OwnerType, ownerId: data.owner_id as string } : null;
}
