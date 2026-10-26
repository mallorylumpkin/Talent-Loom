"use client";

import Link from "next/link";
import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { ConsentCheckbox, SwitchField } from "@/components/forms/fields";
import { finishOnboardingAction, saveVisibilityAction, setDiscoverabilityAction } from "@/app/creator/_actions/privacy";
import { LEVEL_OPTIONS, VISIBILITY_GROUPS, VISIBILITY_LABELS, type VisibilityLevel } from "@/lib/creator/privacy";
import { cn } from "@/lib/cn";

export function VisibilityForm({ settings }: { settings: Record<string, VisibilityLevel> }) {
  return (
    <ActionForm action={saveVisibilityAction}>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="hidden grid-cols-[1.4fr_repeat(3,1fr)] gap-2 border-b border-line bg-canvas px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase sm:grid">
          <span>Information</span>
          {LEVEL_OPTIONS.map((o) => <span key={o.value} className="text-center">{o.label}</span>)}
        </div>
        <ul className="divide-y divide-line">
          {VISIBILITY_GROUPS.map((group) => (
            <li key={group} className="grid gap-2 px-4 py-3 sm:grid-cols-[1.4fr_repeat(3,1fr)] sm:items-center">
              <div>
                <p className="text-sm font-medium text-ink">{VISIBILITY_LABELS[group].label}</p>
                <p className="text-xs text-muted">{VISIBILITY_LABELS[group].hint}</p>
              </div>
              {LEVEL_OPTIONS.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm sm:justify-center">
                  <input type="radio" name={group} value={o.value} defaultChecked={settings[group] === o.value}
                    className="size-4 accent-primary" />
                  <span className="sm:sr-only">{o.label}</span>
                </label>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <FormSubmit pendingLabel="Saving…">Save privacy settings</FormSubmit>
    </ActionForm>
  );
}

function DiscoverabilityFields({ isDiscoverable, hasConsent, hasHandle }: {
  isDiscoverable: boolean; hasConsent: boolean; hasHandle: boolean;
}) {
  return (
    <>
      <SwitchField name="discoverable" defaultChecked={isDiscoverable}
        label="Make my profile discoverable"
        description="Your public page goes live and approved management companies can find you in search. Only fields you've marked Public are visible to visitors." />
      {!hasHandle && (
        <p className="text-sm text-warning-strong">
          You'll need a profile handle first — add one in <Link href="/creator/profile" className="underline">Edit profile</Link>.
        </p>
      )}
      {!hasConsent && (
        <ConsentCheckbox name="discoverabilityConsent">
          I consent to my profile being listed on TalentLoom and shown to approved management companies according to my
          privacy settings. I can turn this off at any time. See the{" "}
          <Link href="/legal/creator-data-consent" target="_blank" className="font-medium text-primary underline">Creator Data Consent</Link>.
        </ConsentCheckbox>
      )}
    </>
  );
}

export function DiscoverabilityForm(props: { isDiscoverable: boolean; hasConsent: boolean; hasHandle: boolean }) {
  return (
    <ActionForm action={setDiscoverabilityAction}>
      <DiscoverabilityFields {...props} />
      <FormSubmit pendingLabel="Saving…">Save</FormSubmit>
    </ActionForm>
  );
}

export function FinishOnboardingForm(props: { isDiscoverable: boolean; hasConsent: boolean; hasHandle: boolean }) {
  return (
    <ActionForm action={finishOnboardingAction}>
      <DiscoverabilityFields {...props} />
      <FormSubmit size="lg" pendingLabel="Finishing…" className={cn("w-full sm:w-auto")}>Finish and go to my dashboard</FormSubmit>
    </ActionForm>
  );
}
