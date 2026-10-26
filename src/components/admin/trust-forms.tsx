"use client";

import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { reviewVerificationAction, updateCreatorAdminAction, updateReportAction } from "@/app/admin/_actions/trust";

export function CreatorAdminForm({ creator }: {
  creator: { id: string; display_name: string | null; headline: string | null; bio: string | null; is_featured: boolean;
    featured_until: string | null; is_discoverable: boolean };
}) {
  return (
    <ActionForm action={updateCreatorAdminAction.bind(null, creator.id)}>
      <TextField name="displayName" label="Display name" defaultValue={creator.display_name} maxLength={80} />
      <TextField name="headline" label="Headline" defaultValue={creator.headline} maxLength={120} />
      <TextAreaField name="bio" label="Bio" defaultValue={creator.bio} rows={4} maxLength={2000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="featured" defaultChecked={creator.is_featured} className="size-4 accent-primary" /> Featured creator
        </label>
        <TextField name="featuredUntil" label="Featured until (optional)" type="date" defaultValue={creator.featured_until?.slice(0, 10)} />
      </div>
      {creator.is_discoverable && (
        <label className="flex items-center gap-2 text-sm text-danger-strong">
          <input type="checkbox" name="hide" className="size-4 accent-danger" /> Hide from search and the directory
        </label>
      )}
      <p className="text-xs text-muted">Only the creator can make their profile discoverable, because it needs their consent.</p>
      <FormSubmit size="sm" pendingLabel="Saving…">Save changes</FormSubmit>
    </ActionForm>
  );
}

export function VerificationDecision({ requestId }: { requestId: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ActionForm action={reviewVerificationAction.bind(null, requestId, true)} className="space-y-2">
        <FormSubmit size="sm" pendingLabel="Approving…">Approve numbers</FormSubmit>
        <p className="text-xs text-muted">Only if the screenshots clearly show the handle and these numbers.</p>
      </ActionForm>
      <ActionForm action={reviewVerificationAction.bind(null, requestId, false)} className="space-y-2">
        <TextAreaField name="note" label="Reason (sent to the creator)" rows={2} maxLength={1000}
          placeholder="e.g. The screenshot doesn't show your handle" />
        <FormSubmit size="sm" variant="danger" pendingLabel="Rejecting…">Reject</FormSubmit>
      </ActionForm>
    </div>
  );
}

export function ReportForm({ reportId, status, resolution }: { reportId: string; status: string; resolution: string | null }) {
  return (
    <ActionForm action={updateReportAction.bind(null, reportId)} className="space-y-3">
      <SelectField name="status" label="Status" defaultValue={status} options={[
        { value: "open", label: "Open" }, { value: "reviewing", label: "Reviewing" },
        { value: "actioned", label: "Actioned" }, { value: "dismissed", label: "Dismissed" },
      ]} />
      <TextAreaField name="resolution" label="Decision notes (internal)" rows={2} maxLength={2000} defaultValue={resolution} />
      <FormSubmit size="sm" pendingLabel="Saving…">Save</FormSubmit>
    </ActionForm>
  );
}
