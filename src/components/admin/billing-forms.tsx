"use client";

import { ActionForm, FormSubmit, useActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/fields";
import { CopyBox } from "@/components/forms/copy-box";
import {
  addContactCreditsAction, applyCreditAction, companyCheckoutLinkAction, createPromoAction, extendTrialAction, grantComplimentaryAction,
  setPlanFeatureAction, setPriceAction, updatePlanAction,
} from "@/app/admin/_actions/billing";

export function PlanForm({ plan }: { plan: { id: string; name: string; description: string | null; trial_days: number; is_public: boolean; is_active: boolean; sales_led: boolean } }) {
  return (
    <ActionForm action={updatePlanAction.bind(null, plan.id)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <TextField name="name" label="Name" defaultValue={plan.name} maxLength={60} />
        <TextField name="trialDays" label="Free trial (days)" type="number" defaultValue={plan.trial_days} />
      </div>
      <TextField name="description" label="Short description" defaultValue={plan.description} maxLength={300} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="checkbox" name="public" defaultChecked={plan.is_public} className="accent-primary" /> Shown on pricing page</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" name="active" defaultChecked={plan.is_active} className="accent-primary" /> Available</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" name="salesLed" defaultChecked={plan.sales_led} className="accent-primary" /> “Contact sales” instead of checkout</label>
      </div>
      <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Save plan</FormSubmit>
    </ActionForm>
  );
}

export function PriceForm({ planId, interval, cents, synced }: { planId: string; interval: "month" | "year"; cents: number | null; synced: boolean }) {
  return (
    <ActionForm action={setPriceAction.bind(null, planId, interval)} className="flex flex-wrap items-end gap-2">
      <div className="w-40"><TextField name="amount" label={`Price per ${interval} ($)`} defaultValue={cents === null ? "" : (cents / 100).toString()} /></div>
      <FormSubmit size="sm" variant="secondary" pendingLabel="…">Set</FormSubmit>
      {cents !== null && <span className="pb-2 text-xs text-muted">{synced ? "In Stripe ✓" : "Not in Stripe yet"}</span>}
    </ActionForm>
  );
}

export function FeatureCell({ planId, featureKey, kind, enabled, limit }: { planId: string; featureKey: string; kind: string; enabled: boolean; limit: number | null }) {
  return (
    <ActionForm action={setPlanFeatureAction.bind(null, planId, featureKey)} showSuccess={false} className="flex items-center gap-1.5">
      <input type="checkbox" name="enabled" defaultChecked={enabled} aria-label="Included" className="accent-primary" />
      {kind === "limit" && <input name="limit" defaultValue={limit ?? ""} placeholder="∞" aria-label="Limit" className="h-7 w-14 rounded border border-line px-1.5 text-xs" />}
      <button className="rounded px-1.5 text-xs text-primary hover:bg-primary-soft">Save</button>
    </ActionForm>
  );
}

export function GrantCompForm({ plans }: { plans: { key: string; name: string }[] }) {
  return (
    <ActionForm action={grantComplimentaryAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
      <TextField name="email" label="Creator or company member email" />
      <SelectField name="plan" label="Plan" options={plans.map((p) => ({ value: p.key, label: p.name }))} placeholder="Choose" />
      <TextField name="until" label="Until (optional)" type="date" />
      <FormSubmit size="sm" pendingLabel="…">Grant</FormSubmit>
    </ActionForm>
  );
}

export function ExtendTrialForm({ stripeSubId }: { stripeSubId: string }) {
  return (
    <ActionForm action={extendTrialAction.bind(null, stripeSubId)} className="flex flex-wrap items-end gap-2">
      <div className="w-44"><TextField name="until" label="Trial until" type="date" /></div>
      <FormSubmit size="sm" variant="secondary" pendingLabel="…">Extend</FormSubmit>
    </ActionForm>
  );
}

export function CreditForm({ ownerType, ownerId }: { ownerType: "user" | "company"; ownerId: string }) {
  return (
    <ActionForm action={applyCreditAction.bind(null, ownerType, ownerId)} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <div className="w-32"><TextField name="amount" label="Credit ($)" /></div>
      <div className="min-w-40 flex-1"><TextField name="note" label="Note on invoice" /></div>
      <FormSubmit size="sm" variant="secondary" pendingLabel="…">Apply</FormSubmit>
    </ActionForm>
  );
}

export function ContactCreditsForm({ companyId }: { companyId: string }) {
  return (
    <ActionForm action={addContactCreditsAction.bind(null, companyId)} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto] sm:items-end">
      <TextField name="credits" label="Credits" placeholder="10" />
      <TextField name="reason" label="Reason" placeholder="Credit pack purchase" />
      <TextField name="expires" label="Expire (optional)" type="date" />
      <FormSubmit size="sm" variant="secondary" pendingLabel="…">Add</FormSubmit>
    </ActionForm>
  );
}

function LinkOut() {
  const { state } = useActionForm();
  return state.ok && state.data?.link ? <CopyBox value={state.data.link} label="Payment link" /> : null;
}

export function CompanyCheckoutForm({ companyId, prices }: { companyId: string; prices: { id: string; label: string }[] }) {
  return (
    <ActionForm action={companyCheckoutLinkAction.bind(null, companyId)} className="space-y-3">
      <SelectField name="priceId" label="Plan and billing period" options={prices.map((p) => ({ value: p.id, label: p.label }))} placeholder="Choose" />
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="trial" className="accent-primary" /> Include the plan&apos;s free trial</label>
      <FormSubmit size="sm" pendingLabel="Creating…">Create payment link</FormSubmit>
      <LinkOut />
    </ActionForm>
  );
}

export function PromoForm({ plans }: { plans: { key: string; name: string }[] }) {
  return (
    <ActionForm action={createPromoAction} resetOnSuccess>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="code" label="Code" placeholder="LAUNCH20" />
        <SelectField name="kind" label="Discount type" options={[{ value: "percent", label: "Percent off" }, { value: "amount", label: "Dollars off" }]} defaultValue="percent" />
        <TextField name="value" label="Amount" placeholder="20" />
        <SelectField name="duration" label="Applies" defaultValue="once" options={[
          { value: "once", label: "First payment only" }, { value: "repeating", label: "For several months" }, { value: "forever", label: "Forever" }]} />
        <TextField name="months" label="Months (if several)" placeholder="3" />
        <TextField name="max" label="Max uses (optional)" />
        <TextField name="expires" label="Expires (optional)" type="date" />
      </div>
      <fieldset className="text-sm">
        <legend className="mb-1 font-medium text-ink">Limit to plans (optional)</legend>
        <div className="flex flex-wrap gap-3">
          {plans.map((p) => <label key={p.key} className="flex items-center gap-1.5"><input type="checkbox" name="plans" value={p.key} className="accent-primary" /> {p.name}</label>)}
        </div>
      </fieldset>
      <FormSubmit pendingLabel="Creating…">Create promo code</FormSubmit>
    </ActionForm>
  );
}
