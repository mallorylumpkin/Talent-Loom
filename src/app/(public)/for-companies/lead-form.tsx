"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/actions/types";
import { submitLeadAction } from "./actions";

const planOptions = [
  { value: "", label: "Not sure yet" },
  { value: "management_scout", label: "Management Scout" },
  { value: "management_agency", label: "Management Agency" },
  { value: "management_agency_pro", label: "Management Agency Pro" },
  { value: "enterprise", label: "Enterprise" },
];

const selectClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none";

export function LeadForm({ defaultPlan }: { defaultPlan?: string }) {
  const [state, action] = useActionState(submitLeadAction, initialFormState);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  if (state.ok) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="mt-4 text-xl font-semibold text-ink">Request received</p>
        <p className="mt-2 max-w-sm text-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {/* Honeypot — hidden from people, tempting to bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Company URL<input name="company_url" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company name" name="companyName" error={e.companyName}>
          <Input id="companyName" name="companyName" defaultValue={v.companyName} invalid={!!e.companyName} required />
        </Field>
        <Field label="Website" name="website" error={e.website}>
          <Input id="website" name="website" defaultValue={v.website} placeholder="youragency.com" invalid={!!e.website} />
        </Field>
        <Field label="Your name" name="contactName" error={e.contactName}>
          <Input id="contactName" name="contactName" autoComplete="name" defaultValue={v.contactName} invalid={!!e.contactName} required />
        </Field>
        <Field label="Work email" name="contactEmail" error={e.contactEmail}>
          <Input id="contactEmail" name="contactEmail" type="email" autoComplete="email" defaultValue={v.contactEmail}
            invalid={!!e.contactEmail} required />
        </Field>
        <Field label="Phone (optional)" name="phone" error={e.phone}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} />
        </Field>
        <Field label="Team size" name="teamSize" error={e.teamSize}>
          <select id="teamSize" name="teamSize" defaultValue={v.teamSize ?? ""} className={selectClass}>
            <option value="">Select…</option>
            {["1", "2-5", "6-15", "16-50", "51-200", "200+"].map((s) => (
              <option key={s} value={s}>{s === "1" ? "Just me" : `${s} people`}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Plan you're interested in" name="interestedPlan">
        <select id="interestedPlan" name="interestedPlan" defaultValue={v.interestedPlan ?? defaultPlan ?? ""} className={selectClass}>
          {planOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>

      <Field label="Tell us about the creators you represent (optional)" name="message" error={e.message}>
        <Textarea id="message" name="message" defaultValue={v.message} rows={4}
          placeholder="Niches, roster size, what you're looking for…" />
      </Field>

      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Sending…">Request access</SubmitButton>
      <p className="text-xs text-muted">
        Every company is reviewed against our Management Company Standards before it can contact creators.
      </p>
    </form>
  );
}
