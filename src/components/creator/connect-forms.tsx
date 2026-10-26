"use client";

import Link from "next/link";
import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { ConsentCheckbox } from "@/components/forms/fields";
import { startConnectAction } from "@/app/creator/_actions/connections";

export function ConnectConsentForm({ provider, label }: { provider: string; label: string }) {
  return (
    <ActionForm action={startConnectAction.bind(null, provider)} showSuccess={false}>
      <ConsentCheckbox name="connectConsent">
        I allow TalentLoom to read my {label} profile and audience numbers (followers and engagement on my recent posts) through{" "}
        {label}&apos;s official sign-in, refresh them daily, and show them as <strong>verified</strong> according to my{" "}
        <Link href="/creator/privacy" className="font-medium text-primary underline">privacy settings</Link>. TalentLoom can&apos;t post,
        message or change anything on my account. I can disconnect at any time. Read the{" "}
        <Link href="/legal/creator-data-consent" target="_blank" className="font-medium text-primary underline">Creator Data Consent</Link>.
      </ConsentCheckbox>
      <FormSubmit pendingLabel="Opening sign-in…" size="lg">Continue to {label}</FormSubmit>
    </ActionForm>
  );
}
