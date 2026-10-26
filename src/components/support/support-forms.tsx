"use client";

import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { openSupportAction, replySupportAction } from "@/app/_actions/support";

export const SUPPORT_CATEGORIES = [
  { value: "general", label: "General question" },
  { value: "account", label: "Account or sign-in" },
  { value: "verification", label: "Analytics verification" },
  { value: "billing", label: "Plans and billing" },
  { value: "safety", label: "Safety concern" },
  { value: "bug", label: "Something isn't working" },
  { value: "data_request", label: "My data (copy or deletion)" },
];

export function NewSupportForm() {
  return (
    <ActionForm action={openSupportAction}>
      <TextField name="subject" label="Subject" maxLength={150} required />
      <SelectField name="category" label="Topic" options={SUPPORT_CATEGORIES} defaultValue="general" />
      <TextAreaField name="body" label="How can we help?" rows={5} maxLength={5000}
        hint="Include what you were trying to do and anything you saw on screen. Never share your password." />
      <FormSubmit pendingLabel="Sending…">Send to support</FormSubmit>
    </ActionForm>
  );
}

export function SupportReplyForm({ requestId }: { requestId: string }) {
  return (
    <ActionForm action={replySupportAction.bind(null, requestId)} resetOnSuccess showSuccess={false}>
      <TextAreaField name="body" label="Add a reply" rows={3} maxLength={5000} />
      <FormSubmit size="sm" pendingLabel="Sending…">Send</FormSubmit>
    </ActionForm>
  );
}
