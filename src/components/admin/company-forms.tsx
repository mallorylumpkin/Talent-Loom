"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, FormSubmit, useActionForm } from "@/components/forms/action-form";
import { RadioCards, SelectField, TextAreaField, TextField, selectClass } from "@/components/forms/fields";
import { CopyBox } from "@/components/forms/copy-box";
import { ActionButton } from "@/components/forms/confirm-action";
import {
  adminAddMemberAction, adminSetupLinkAction, createCompanyAction, reviewCompanyAction, setCompanyFlagsAction,
  setCompanyPlanAction, updateLeadAction,
} from "@/app/admin/_actions/companies";
import { countryOptions } from "@/lib/countries";
import type { FormState } from "@/lib/actions/types";

interface PlanOption { key: string; name: string }

/** Shows a one-time setup link returned by the last submission. */
function SetupLinkResult() {
  const { state } = useActionForm();
  const link = state.data?.setupLink;
  const companyId = state.data?.companyId;
  if (!state.ok && !companyId) return null;
  return (
    <div className="space-y-3 rounded-xl border border-success/40 bg-success-soft/50 p-4">
      {link ? (
        <>
          <CopyBox value={link} label="Account setup link" />
          <p className="text-xs text-muted">
            Send this privately (email or text). It lets them choose a password and sign in. It works once and expires
            after the time set in Supabase (1 hour by default) — you can create a new one from the company page.
          </p>
        </>
      ) : state.ok ? (
        <p className="text-sm text-muted">The link couldn't be created. Generate one from the company page.</p>
      ) : null}
      {companyId && (
        <Link href={`/admin/companies/${companyId}`} className="inline-block text-sm font-medium text-primary hover:underline">
          Open company page →
        </Link>
      )}
    </div>
  );
}

export function CreateCompanyForm({
  plans, lead,
}: {
  plans: PlanOption[];
  lead?: { id: string; company_name: string; website: string | null; contact_name: string; contact_email: string;
    team_size: string | null; interested_plan: string | null } | null;
}) {
  return (
    <ActionForm action={createCompanyAction} hidden={{ leadId: lead?.id }}>
      <fieldset className="space-y-5">
        <legend className="text-base font-semibold text-ink">Company</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="name" label="Company name" required defaultValue={lead?.company_name} />
          <TextField name="website" label="Website" defaultValue={lead?.website} placeholder="agency.com" />
          <TextField name="contactEmail" label="Company contact email" type="email" required defaultValue={lead?.contact_email} />
          <SelectField name="sizeBand" label="Team size" placeholder="—" defaultValue={lead?.team_size}
            options={["1", "2-5", "6-15", "16-50", "51-200", "200+"].map((s) => ({ value: s, label: s === "1" ? "Just 1" : s }))} />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField name="city" label="City" />
          <TextField name="region" label="State / region" />
          <SelectField name="country" label="Country" placeholder="—" defaultValue="US"
            options={countryOptions().map((c) => ({ value: c.code, label: c.name }))} />
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-line pt-6">
        <legend className="text-base font-semibold text-ink">Plan</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField name="planKey" label="Plan" defaultValue={lead?.interested_plan ?? "management_scout"}
            options={plans.map((p) => ({ value: p.key, label: p.name }))} />
          <TextField name="compExpires" label="Free until (optional)" type="date"
            hint="Plans are complimentary until Stripe billing is added in Phase 6." />
        </div>
        <RadioCards name="status" label="Review status" defaultValue="approved" options={[
          { value: "approved", label: "Approved now", hint: "Can search and contact creators right away" },
          { value: "draft", label: "Needs profile first", hint: "They complete their profile and submit for review" },
        ]} />
      </fieldset>

      <fieldset className="space-y-5 border-t border-line pt-6">
        <legend className="text-base font-semibold text-ink">Owner account</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="ownerName" label="Owner name" required defaultValue={lead?.contact_name} />
          <TextField name="ownerEmail" label="Owner email" type="email" required defaultValue={lead?.contact_email}
            hint="Must not already have a TalentLoom account" />
        </div>
      </fieldset>

      <SetupLinkResult />
      <FormSubmit size="lg" pendingLabel="Creating…">Create company and owner account</FormSubmit>
    </ActionForm>
  );
}

export function ReviewCompanyForm({ companyId, status }: { companyId: string; status: string }) {
  const options =
    status === "approved"
      ? [{ value: "suspend", label: "Suspend", hint: "Blocks search and outreach" }]
      : status === "suspended" || status === "rejected"
        ? [{ value: "reactivate", label: "Reactivate / approve", hint: "Restores full access" }]
        : [
            { value: "approve", label: "Approve", hint: "Can contact creators" },
            { value: "request_info", label: "Request info", hint: "Ask them to update their profile" },
            { value: "reject", label: "Reject", hint: "Close the application" },
          ];
  return (
    <ActionForm action={reviewCompanyAction.bind(null, companyId)}>
      <RadioCards name="decision" options={options} defaultValue={options[0].value} />
      <TextAreaField name="message" label="Note to the company (required for info requests and rejections)" rows={3} maxLength={2000} />
      <FormSubmit pendingLabel="Saving…">Save decision</FormSubmit>
    </ActionForm>
  );
}

export function PlanForm({ companyId, plans, currentKey }: { companyId: string; plans: PlanOption[]; currentKey?: string }) {
  return (
    <ActionForm action={setCompanyPlanAction.bind(null, companyId)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="planKey" label="Plan" defaultValue={currentKey} options={plans.map((p) => ({ value: p.key, label: p.name }))} />
        <TextField name="compExpires" label="Free until (optional)" type="date" />
      </div>
      <FormSubmit variant="secondary" pendingLabel="Saving…">Change plan</FormSubmit>
    </ActionForm>
  );
}

export function CompanyFlagsForm({ companyId, flags }: {
  companyId: string; flags: { verified: boolean; frozen: boolean; featured: boolean };
}) {
  const row = (name: string, label: string, hint: string, checked: boolean) => (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1 size-4 accent-primary" />
      <span><span className="font-medium text-ink">{label}</span><span className="block text-muted">{hint}</span></span>
    </label>
  );
  return (
    <ActionForm action={setCompanyFlagsAction.bind(null, companyId)}>
      {row("verifiedBadge", "Verified badge", "Shown to creators on inquiries and the company profile", flags.verified)}
      {row("outreachFrozen", "Freeze outreach", "Blocks new inquiries and messages (e.g. while investigating reports)", flags.frozen)}
      {row("featured", "Featured company", "Highlighted in the company directory when it's enabled", flags.featured)}
      <FormSubmit variant="secondary" pendingLabel="Saving…">Save</FormSubmit>
    </ActionForm>
  );
}

export function AddMemberForm({ companyId }: { companyId: string }) {
  return (
    <ActionForm action={adminAddMemberAction.bind(null, companyId)} resetOnSuccess>
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_10rem]">
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" type="email" />
        <SelectField name="role" label="Role" defaultValue="owner" options={[
          { value: "owner", label: "Owner" }, { value: "admin", label: "Admin" },
          { value: "recruiter", label: "Recruiter" }, { value: "viewer", label: "Viewer" },
        ]} />
      </div>
      <SetupLinkResult />
      <FormSubmit variant="secondary" pendingLabel="Adding…">Add member</FormSubmit>
    </ActionForm>
  );
}

/** "New setup link" button that shows the link inline. */
export function SetupLinkButton({ companyId, userId }: { companyId: string; userId: string }) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-2">
      <ActionButton tone="primary" action={async (): Promise<FormState> => {
        const res = await adminSetupLinkAction(companyId, userId);
        if (res.data?.setupLink) setLink(res.data.setupLink);
        return res;
      }}>
        New setup link
      </ActionButton>
      {link && <div className="w-full min-w-72"><CopyBox value={link} /></div>}
    </span>
  );
}

export function LeadStatusForm({ leadId, status, notes }: { leadId: string; status: string; notes: string | null }) {
  return (
    <ActionForm action={updateLeadAction.bind(null, leadId)} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select name="status" defaultValue={status} aria-label="Lead status" className={`${selectClass} h-9 w-auto text-sm`}>
          {["new", "contacted", "qualified", "converted", "declined"].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Save</FormSubmit>
      </div>
      <textarea name="adminNotes" defaultValue={notes ?? ""} rows={2} placeholder="Internal notes"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none" />
    </ActionForm>
  );
}
