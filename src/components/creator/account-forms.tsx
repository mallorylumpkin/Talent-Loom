"use client";

import Link from "next/link";
import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { ConsentCheckbox, SelectField, TextField } from "@/components/forms/fields";
import { addAccountAction } from "@/app/creator/_actions/accounts";

export function AddAccountForm({
  platforms, needsConsent, next,
}: {
  platforms: { id: string; label: string }[]; needsConsent: boolean; next?: string;
}) {
  return (
    <ActionForm action={addAccountAction} hidden={{ next }} resetOnSuccess>
      <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr_1fr]">
        <SelectField name="platformId" label="Platform" placeholder="Select…"
          options={platforms.map((p) => ({ value: p.id, label: p.label }))} />
        <TextField name="handle" label="Handle or profile link" placeholder="@yourhandle" />
        <TextField name="followers" label="Followers (optional)" inputMode="numeric" placeholder="84200" />
      </div>
      <TextField name="url" label="Profile link (optional)" placeholder="https://…"
        hint="Leave blank and we'll build it from your handle." />
      {needsConsent && (
        <ConsentCheckbox name="dataConsent">
          I consent to TalentLoom storing the audience numbers I enter and showing them according to my{" "}
          <Link href="/creator/privacy" className="font-medium text-primary underline">privacy settings</Link>. They'll be
          labelled <strong>self-reported</strong> unless verified. See the{" "}
          <Link href="/legal/creator-data-consent" target="_blank" className="font-medium text-primary underline">Creator Data Consent</Link>.
        </ConsentCheckbox>
      )}
      <FormSubmit pendingLabel="Adding…">Add account</FormSubmit>
    </ActionForm>
  );
}
