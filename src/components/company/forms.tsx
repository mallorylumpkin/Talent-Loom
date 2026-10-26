"use client";

import { useState } from "react";
import { ActionForm, FormSubmit, useActionForm } from "@/components/forms/action-form";
import { CheckboxPills, SelectField, TextAreaField, TextField, selectClass } from "@/components/forms/fields";
import { UploadForm } from "@/components/forms/upload-form";
import { CopyBox } from "@/components/forms/copy-box";
import { ActionButton } from "@/components/forms/confirm-action";
import {
  changeMemberRoleAction, inviteMemberAction, memberSetupLinkAction, saveCompanyProfileAction, uploadLogoAction,
} from "@/app/company/_actions/company";
import { createListAction, renameListAction, setCreatorListsAction } from "@/app/company/_actions/talent";
import { changeOwnPasswordAction } from "@/app/_actions/account";
import { countryOptions } from "@/lib/countries";
import type { CompanyRow } from "@/lib/company/context";
import type { FormState } from "@/lib/actions/types";

export function CompanyProfileForm({
  company, categories, selected,
}: {
  company: CompanyRow; categories: { id: string; label: string }[]; selected: string[];
}) {
  return (
    <ActionForm action={saveCompanyProfileAction}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Company name" required defaultValue={company.name} />
        <TextField name="website" label="Website" defaultValue={company.website} placeholder="agency.com" />
      </div>
      <TextAreaField name="description" label="About the company" defaultValue={company.description} rows={5} maxLength={3000}
        hint="Creators read this before replying. Who you are, who you represent, and what makes you different." />
      <TextAreaField name="servicesDescription" label="Management services" defaultValue={company.services_description} rows={4}
        maxLength={3000} placeholder="Brand partnerships, contract negotiation, content strategy…" />
      <CheckboxPills name="categories" label="Creator categories you represent" options={categories} defaultValues={selected} />
      <TextField name="specialties" label="Specialties (comma separated)" defaultValue={company.specialties.join(", ")}
        placeholder="Beauty, Gen Z audiences, long-form YouTube" />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="contactEmail" label="Contact email" type="email" required defaultValue={company.contact_email} />
        <SelectField name="sizeBand" label="Team size" placeholder="—" defaultValue={company.size_band}
          options={["1", "2-5", "6-15", "16-50", "51-200", "200+"].map((s) => ({ value: s, label: s === "1" ? "Just 1" : s }))} />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField name="city" label="City" defaultValue={company.city} />
        <TextField name="region" label="State / region" defaultValue={company.region} />
        <SelectField name="country" label="Country" placeholder="—" defaultValue={company.country}
          options={countryOptions().map((c) => ({ value: c.code, label: c.name }))} />
      </div>
      <FormSubmit pendingLabel="Saving…">Save company profile</FormSubmit>
    </ActionForm>
  );
}

export function LogoUploader({ companyId, currentUrl }: { companyId: string; currentUrl: string | null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-canvas">
        {currentUrl ? <img src={currentUrl} alt="" className="size-full object-cover" /> : <span className="text-xs text-muted">No logo</span>}
      </div>
      <div className="flex-1">
        <UploadForm action={uploadLogoAction} bucket="company-logos" userId={companyId} fileLabel="Company logo (square works best)">
          <FormSubmit size="sm" variant="secondary" pendingLabel="Uploading…">Upload logo</FormSubmit>
        </UploadForm>
      </div>
    </div>
  );
}

function InviteResult() {
  const { state } = useActionForm();
  if (!state.ok || !state.data?.setupLink) return null;
  return (
    <div className="space-y-2 rounded-xl border border-success/40 bg-success-soft/50 p-4">
      <CopyBox value={state.data.setupLink} label="One-time setup link" />
      <p className="text-xs text-muted">Send it privately. It works once and expires (1 hour by default).</p>
    </div>
  );
}

export function InviteMemberForm({ roles }: { roles: { id: string; name: string }[] }) {
  return (
    <ActionForm action={inviteMemberAction} resetOnSuccess>
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_11rem]">
        <TextField name="name" label="Name" />
        <TextField name="email" label="Work email" type="email" />
        <SelectField name="roleId" label="Role" defaultValue={roles.find((r) => r.name === "Recruiter")?.id}
          options={roles.map((r) => ({ value: r.id, label: r.name }))} />
      </div>
      <InviteResult />
      <FormSubmit pendingLabel="Adding…">Add teammate</FormSubmit>
    </ActionForm>
  );
}

export function RoleSelect({ userId, roleId, roles }: { userId: string; roleId: string; roles: { id: string; name: string }[] }) {
  return (
    <ActionForm action={changeMemberRoleAction.bind(null, userId)} className="flex items-center gap-2" showSuccess={false}>
      <select name="roleId" defaultValue={roleId} aria-label="Role" className={`${selectClass} h-9 w-auto text-sm`}>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <FormSubmit size="sm" variant="secondary" pendingLabel="…">Save</FormSubmit>
    </ActionForm>
  );
}

export function MemberLinkButton({ userId }: { userId: string }) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-2">
      <ActionButton tone="primary" action={async (): Promise<FormState> => {
        const res = await memberSetupLinkAction(userId);
        if (res.data?.setupLink) setLink(res.data.setupLink);
        return res;
      }}>New setup link</ActionButton>
      {link && <div className="w-full min-w-72"><CopyBox value={link} /></div>}
    </span>
  );
}

export function CreateListForm({ allowPrivate }: { allowPrivate: boolean }) {
  return (
    <ActionForm action={createListAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1"><TextField name="name" label="New list" placeholder="Spring beauty shortlist" /></div>
      <label className={`flex h-11 items-center gap-2 text-sm ${allowPrivate ? "text-ink" : "text-muted"}`}
        title={allowPrivate ? undefined : "Private lists are part of Management Agency Pro"}>
        <input type="checkbox" name="isPrivate" disabled={!allowPrivate} className="size-4 accent-primary" /> Private to me
      </label>
      <FormSubmit pendingLabel="Creating…">Create list</FormSubmit>
    </ActionForm>
  );
}

export function RenameListForm({ listId, name }: { listId: string; name: string }) {
  return (
    <ActionForm action={renameListAction.bind(null, listId)} className="flex flex-wrap items-end gap-2" showSuccess={false}>
      <div className="min-w-56"><TextField name="name" label="List name" defaultValue={name} /></div>
      <FormSubmit size="md" variant="secondary" pendingLabel="Saving…">Rename</FormSubmit>
    </ActionForm>
  );
}

export function CreatorListsForm({
  creatorId, lists, selected,
}: {
  creatorId: string; lists: { id: string; name: string; is_private: boolean }[]; selected: string[];
}) {
  const on = new Set(selected);
  return (
    <ActionForm action={setCreatorListsAction.bind(null, creatorId)} className="space-y-3">
      {lists.length === 0 ? (
        <p className="text-sm text-muted">No lists yet — saving creates a “Saved” list.</p>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.id}>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="lists" value={l.id} defaultChecked={on.has(l.id)} className="size-4 accent-primary" />
                {l.name}{l.is_private && <span className="text-xs text-muted">(private)</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      {lists.length > 0 && <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Update lists</FormSubmit>}
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changeOwnPasswordAction} resetOnSuccess>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="password" label="New password" type="password" autoComplete="new-password"
          hint="At least 10 characters, with a letter and a number." />
        <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
      </div>
      <FormSubmit variant="secondary" pendingLabel="Updating…">Update password</FormSubmit>
    </ActionForm>
  );
}
