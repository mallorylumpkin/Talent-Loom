"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, FormSubmit, useActionForm } from "@/components/forms/action-form";
import { TextAreaField, TextField } from "@/components/forms/fields";
import { CopyBox } from "@/components/forms/copy-box";
import { ActionButton } from "@/components/forms/confirm-action";
import {
  createCreatorAction, permanentlyDeleteUserAction, setUserStatusAction, setupLinkForUserAction, startImpersonationAction,
} from "@/app/admin/_actions/users";
import type { FormState } from "@/lib/actions/types";

function LinkResult() {
  const { state } = useActionForm();
  if (!state.ok || !state.data?.link) return null;
  return (
    <div className="space-y-2 rounded-xl border border-success/40 bg-success-soft/50 p-4">
      <CopyBox value={state.data.link} label="One-time sign-in link" />
      <p className="text-xs text-muted">Send it privately. It works once and expires per your Supabase setting.</p>
      {state.data.userId && (
        <Link href={`/admin/users/${state.data.userId}`} className="text-sm font-medium text-primary hover:underline">Open user →</Link>
      )}
    </div>
  );
}

export function CreateCreatorForm() {
  return (
    <ActionForm action={createCreatorAction} resetOnSuccess>
      <TextField name="name" label="Name" required maxLength={80} />
      <TextField name="email" label="Email" type="email" required />
      <label className="flex items-start gap-3 rounded-xl bg-canvas p-4 text-sm text-ink">
        <input type="checkbox" name="adult" className="mt-1 size-4 accent-primary" />
        I&apos;ve confirmed this person is 18 or older and agreed to the Terms and Privacy Policy.
      </label>
      <FormSubmit pendingLabel="Creating…">Create creator account</FormSubmit>
      <LinkResult />
    </ActionForm>
  );
}

export function SetupLinkButton({ userId }: { userId: string }) {
  const [result, setResult] = useState<FormState | null>(null);
  return (
    <div className="space-y-2">
      <ActionButton action={async () => {
        const r = await setupLinkForUserAction(userId);
        setResult(r);
        return r;
      }}>Create sign-in link</ActionButton>
      {result?.data?.link && <CopyBox value={result.data.link} label={result.message} />}
    </div>
  );
}

export function StatusForm({ userId, status, label, tone, needsReason }: {
  userId: string; status: "active" | "suspended" | "deleted"; label: string; tone: "primary" | "danger"; needsReason?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={tone === "danger" ? "h-9 rounded-xl px-3 text-sm font-medium text-danger-strong hover:bg-danger-soft"
          : "h-9 rounded-xl px-3 text-sm font-medium text-primary hover:bg-primary-soft"}>
        {label}
      </button>
    );
  }
  return (
    <div className="w-full rounded-xl border border-line p-4">
      <ActionForm action={setUserStatusAction.bind(null, userId, status)}>
        {needsReason && <TextAreaField name="reason" label="Reason (internal)" rows={2} maxLength={500} />}
        <div className="flex gap-2">
          <FormSubmit variant={tone === "danger" ? "danger" : "primary"} size="sm" pendingLabel="Saving…">{label}</FormSubmit>
          <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-xl px-3 text-sm text-muted hover:bg-ink/5">Cancel</button>
        </div>
      </ActionForm>
    </div>
  );
}

export function PermanentDeleteForm({ userId, email }: { userId: string; email: string }) {
  return (
    <ActionForm action={permanentlyDeleteUserAction.bind(null, userId)}>
      <TextField name="confirm" label={<>Type <strong>{email}</strong> to permanently delete this account</>} />
      <FormSubmit variant="danger" size="sm" pendingLabel="Deleting…">Delete permanently</FormSubmit>
    </ActionForm>
  );
}

export function ImpersonateForm({ userId }: { userId: string }) {
  return (
    <ActionForm action={startImpersonationAction.bind(null, userId)} showSuccess={false}>
      <TextField name="reason" label="Reason" maxLength={500} placeholder="e.g. Support request about uploads"
        hint="Opens their dashboard read-only for 30 minutes. Nothing can be changed, and it's recorded in the audit log." />
      <FormSubmit size="sm" variant="secondary" pendingLabel="Opening…">View as this user</FormSubmit>
    </ActionForm>
  );
}
