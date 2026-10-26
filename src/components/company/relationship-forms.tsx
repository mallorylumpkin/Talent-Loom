"use client";

import { ActionForm, FormSubmit, useActionForm } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField, selectClass } from "@/components/forms/fields";
import {
  addNoteAction, addStageAction, addToPipelineAction, assignEntryAction, createPipelineAction, moveEntryAction,
  sendInquiryAction, updateRosterAction,
} from "@/app/company/_actions/relationships";
import { cn } from "@/lib/cn";

export function SendInquiryForm({ creatorId, firstName }: { creatorId: string; firstName: string }) {
  return (
    <ActionForm action={sendInquiryAction.bind(null, creatorId)} resetOnSuccess>
      <TextField name="subject" label="Subject" maxLength={120} placeholder="Representation conversation" required />
      <TextAreaField name="body" label="Message" rows={6} maxLength={4000}
        placeholder={`Hi ${firstName}, we've been following your work and…`}
        hint="Say who you are, why you're interested and what you'd offer. They'll see your company profile alongside it." />
      <FormSubmit pendingLabel="Sending…">Send inquiry</FormSubmit>
    </ActionForm>
  );
}

/** A select that saves as soon as it changes. */
function AutoSelect({ name, label, value, options, disabled }: {
  name: string; label: string; value: string; options: { value: string; label: string }[]; disabled?: boolean;
}) {
  const { pending } = useActionForm();
  return (
    <div>
      <label className="sr-only" htmlFor={`${name}-${label}`}>{label}</label>
      <select id={`${name}-${label}`} name={name} defaultValue={value} disabled={disabled || pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={cn(selectClass, "h-9 text-sm", pending && "opacity-60")}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function StageSelect({ entryId, stageId, stages, disabled, label = "Stage" }: {
  entryId: string; stageId: string; stages: { id: string; name: string }[]; disabled?: boolean; label?: string;
}) {
  return (
    <ActionForm action={moveEntryAction.bind(null, entryId)} showSuccess={false} className="">
      <AutoSelect name="stageId" label={label} value={stageId} disabled={disabled}
        options={stages.map((s) => ({ value: s.id, label: s.name }))} />
    </ActionForm>
  );
}

export function AssignSelect({ entryId, assignee, members, disabled }: {
  entryId: string; assignee: string | null; members: { id: string; name: string }[]; disabled?: boolean;
}) {
  return (
    <ActionForm action={assignEntryAction.bind(null, entryId)} showSuccess={false} className="">
      <AutoSelect name="assignee" label="Assigned to" value={assignee ?? ""} disabled={disabled}
        options={[{ value: "", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
    </ActionForm>
  );
}

export function AddToPipelineForm({ creatorId, pipelines }: { creatorId: string; pipelines: { id: string; name: string }[] }) {
  return (
    <ActionForm action={addToPipelineAction.bind(null, creatorId)} className="flex flex-wrap items-end gap-2">
      {pipelines.length > 1 ? (
        <div className="min-w-40 flex-1">
          <SelectField name="pipelineId" label="Pipeline" options={pipelines.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
      ) : (
        <input type="hidden" name="pipelineId" value={pipelines[0]?.id ?? ""} />
      )}
      <FormSubmit variant="secondary" size="sm" pendingLabel="Adding…">Add to pipeline</FormSubmit>
    </ActionForm>
  );
}

export function NoteForm({ creatorId, allowTeam }: { creatorId: string; allowTeam: boolean }) {
  return (
    <ActionForm action={addNoteAction.bind(null, creatorId)} resetOnSuccess showSuccess={false}>
      <TextAreaField name="body" label="Add a note" rows={3} maxLength={5000}
        hint="Notes are internal to your company. Creators never see them." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset className="flex gap-4 text-sm">
          <legend className="sr-only">Who can see this note</legend>
          <label className="flex items-center gap-1.5"><input type="radio" name="visibility" value="private" defaultChecked={!allowTeam} className="accent-primary" /> Only me</label>
          <label className={cn("flex items-center gap-1.5", !allowTeam && "opacity-50")} title={allowTeam ? undefined : "Shared notes are part of the Management Agency plan"}>
            <input type="radio" name="visibility" value="team" defaultChecked={allowTeam} disabled={!allowTeam} className="accent-primary" /> My team
          </label>
        </fieldset>
        <FormSubmit size="sm" pendingLabel="Saving…">Save note</FormSubmit>
      </div>
    </ActionForm>
  );
}

export function RosterForm({ rosterId, status, signedAt, contractEnd, notes }: {
  rosterId: string; status: "active" | "ended"; signedAt: string; contractEnd: string | null; notes: string | null;
}) {
  return (
    <ActionForm action={updateRosterAction.bind(null, rosterId)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField name="status" label="Status" defaultValue={status}
          options={[{ value: "active", label: "Active" }, { value: "ended", label: "Ended" }]} />
        <TextField name="signedAt" label="Signed" type="date" defaultValue={signedAt} />
        <TextField name="contractEnd" label="Contract ends" type="date" defaultValue={contractEnd} />
      </div>
      <TextAreaField name="notes" label="Roster notes" rows={2} maxLength={2000} defaultValue={notes} />
      <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Save</FormSubmit>
    </ActionForm>
  );
}

export function CreatePipelineForm() {
  return (
    <ActionForm action={createPipelineAction} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1"><TextField name="name" label="New pipeline" maxLength={80} placeholder="e.g. Beauty creators Q1" /></div>
      <FormSubmit size="sm" variant="secondary" pendingLabel="Creating…">Create</FormSubmit>
    </ActionForm>
  );
}

export function AddStageForm({ pipelineId }: { pipelineId: string }) {
  return (
    <ActionForm action={addStageAction.bind(null, pipelineId)} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1"><TextField name="name" label="New stage" maxLength={40} placeholder="e.g. Contract review" /></div>
      <FormSubmit size="sm" variant="secondary" pendingLabel="Adding…">Add stage</FormSubmit>
    </ActionForm>
  );
}
