"use client";

import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import {
  addTaxonomyAction, adminSupportReplyAction, adminSupportStatusAction, updateLegalAction, updateSettingAction,
  updateTaxonomyAction, updateTemplateAction,
} from "@/app/admin/_actions/platform";

export function AddTaxonomyForm({ table }: { table: string }) {
  return (
    <ActionForm action={addTaxonomyAction.bind(null, table)} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1"><TextField name="label" label="Add new" maxLength={60} /></div>
      {table === "platforms" && (
        <div className="min-w-64 flex-1"><TextField name="template" label="Profile link pattern" placeholder="https://example.com/{handle}" /></div>
      )}
      <FormSubmit size="sm" pendingLabel="Adding…">Add</FormSubmit>
    </ActionForm>
  );
}

export function TaxonomyRow({ table, row }: { table: string; row: { id: string; key: string; label: string; active: boolean; sort: number } }) {
  return (
    <ActionForm action={updateTaxonomyAction.bind(null, table, row.id)} showSuccess={false} className="flex flex-wrap items-center gap-2 py-2">
      <label className="sr-only" htmlFor={`label-${row.id}`}>Name</label>
      <input id={`label-${row.id}`} name="label" defaultValue={row.label} maxLength={60}
        className="h-9 min-w-40 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
      <label className="sr-only" htmlFor={`sort-${row.id}`}>Order</label>
      <input id={`sort-${row.id}`} name="sort" type="number" defaultValue={row.sort} className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-sm" />
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={row.active} className="accent-primary" /> Shown</label>
      <span className="font-mono text-xs text-muted">{row.key}</span>
      <FormSubmit size="sm" variant="secondary" pendingLabel="…">Save</FormSubmit>
    </ActionForm>
  );
}

export function SettingForm({ settingKey, value, description }: { settingKey: string; value: unknown; description: string | null }) {
  return (
    <ActionForm action={updateSettingAction.bind(null, settingKey)} className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1">
        <TextField name="value" label={<span className="font-mono text-xs">{settingKey}</span>}
          defaultValue={typeof value === "string" ? value : JSON.stringify(value)} hint={description ?? undefined} />
      </div>
      <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Save</FormSubmit>
    </ActionForm>
  );
}

export function TemplateForm({ tkey, channel, body, enabled, placeholders }: { tkey: string; channel: string; body: string; enabled: boolean; placeholders: string[] }) {
  return (
    <ActionForm action={updateTemplateAction.bind(null, tkey, channel)} className="space-y-2">
      <TextField name="body" label={<span className="font-mono text-xs">{tkey}</span>} defaultValue={body} maxLength={300}
        hint={placeholders.length ? `Placeholders: ${placeholders.map((p) => `{{${p}}}`).join(", ")}` : "No placeholders"} />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="enabled" defaultChecked={enabled} className="accent-primary" /> Send this notification</label>
        <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Save</FormSubmit>
      </div>
    </ActionForm>
  );
}

export function LegalForm({ page }: { page: { slug: string; title: string; body_md: string; version: string; requires_legal_review: boolean } }) {
  return (
    <ActionForm action={updateLegalAction.bind(null, page.slug)}>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField name="title" label="Title" defaultValue={page.title} maxLength={120} />
        <TextField name="version" label="Version" defaultValue={page.version} hint="Change it when the meaning changes" />
      </div>
      <TextAreaField name="body" label="Content (Markdown)" defaultValue={page.body_md} rows={24} maxLength={100000} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reviewed" defaultChecked={!page.requires_legal_review} className="accent-primary" />
        A lawyer has reviewed this version</label>
      {(page.slug === "terms" || page.slug === "privacy") && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bumpTerms" className="accent-primary" />
          Record this version on new sign-up consents</label>
      )}
      <FormSubmit pendingLabel="Publishing…">Publish</FormSubmit>
    </ActionForm>
  );
}

export function AdminSupportReply({ requestId }: { requestId: string }) {
  return (
    <ActionForm action={adminSupportReplyAction.bind(null, requestId)} resetOnSuccess>
      <TextAreaField name="body" label="Reply" rows={4} maxLength={5000} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="internal" className="accent-primary" /> Internal note (not sent)</label>
        <FormSubmit size="sm" pendingLabel="Sending…">Send</FormSubmit>
      </div>
    </ActionForm>
  );
}

export function AdminSupportStatus({ requestId, status }: { requestId: string; status: string }) {
  return (
    <ActionForm action={adminSupportStatusAction.bind(null, requestId)} className="space-y-3">
      <SelectField name="status" label="Status" defaultValue={status} options={[
        { value: "open", label: "Open (needs us)" }, { value: "pending", label: "Waiting on user" },
        { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" },
      ]} />
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="mine" className="accent-primary" /> Assign to me</label>
      <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Update</FormSubmit>
    </ActionForm>
  );
}
