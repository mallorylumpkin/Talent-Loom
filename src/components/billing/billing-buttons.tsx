"use client";

import { ActionButton } from "@/components/forms/confirm-action";
import { openBillingPortalAction, startCreatorCheckoutAction } from "@/app/_actions/billing";

const big = "h-10 px-4 bg-primary text-white hover:bg-primary-strong hover:text-white";

export function CheckoutButton({ interval, label }: { interval: "month" | "year"; label: string }) {
  return <ActionButton action={() => startCreatorCheckoutAction(interval)} tone="primary" className={big}>{label}</ActionButton>;
}

export function PortalButton({ label = "Manage billing" }: { label?: string }) {
  return <ActionButton action={openBillingPortalAction} className="h-10 border border-line px-4">{label}</ActionButton>;
}
