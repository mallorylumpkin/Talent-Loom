"use client";

import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { CheckboxPills, RadioCards, SelectField, SwitchField, TextAreaField, TextField } from "@/components/forms/fields";
import { UploadForm } from "@/components/forms/upload-form";
import { ActionButton } from "@/components/forms/confirm-action";
import {
  removeImageAction, saveBasicsAction, saveGoalsAction, saveInterestsAction, uploadAvatarAction, uploadCoverAction,
} from "@/app/creator/_actions/profile";
import { countryOptions } from "@/lib/countries";

interface Option { id: string; label: string }

export function BasicsForm({
  creator, next, submitLabel = "Save profile",
}: {
  creator: {
    display_name: string | null; handle: string | null; headline: string | null; bio: string | null; city: string | null;
    region: string | null; country: string | null; contact_preference: string; contact_email: string | null;
  };
  next?: string;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={saveBasicsAction} hidden={{ next }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="displayName" label="Name" defaultValue={creator.display_name} required autoComplete="name"
          hint="Your creator or professional name" />
        <TextField name="handle" label="Profile handle" defaultValue={creator.handle} required prefix="@"
          hint="Your page address: talentloom…/creators/handle" />
      </div>
      <TextField name="headline" label="Headline" defaultValue={creator.headline} maxLength={120}
        placeholder="Wellness and slow-living creator sharing realistic routines" hint="One line companies see first" />
      <TextAreaField name="bio" label="About you" defaultValue={creator.bio} maxLength={2000} rows={5}
        placeholder="What you create, who your audience is, and what you're looking for in a management team." />
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField name="city" label="City" defaultValue={creator.city} autoComplete="address-level2" />
        <TextField name="region" label="State / region" defaultValue={creator.region} autoComplete="address-level1" />
        <SelectField name="country" label="Country" defaultValue={creator.country} placeholder="Select…"
          options={countryOptions().map((c) => ({ value: c.code, label: c.name }))} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="contactPreference" label="How companies can reach you" defaultValue={creator.contact_preference}
          options={[
            { value: "platform_only", label: "Only through TalentLoom messages" },
            { value: "email_after_accept", label: "Share my email after I accept an inquiry" },
          ]} />
        <TextField name="contactEmail" label="Contact email (optional)" type="email" defaultValue={creator.contact_email}
          hint="Never shown publicly" />
      </div>
      <FormSubmit pendingLabel="Saving…">{submitLabel}</FormSubmit>
    </ActionForm>
  );
}

export function ImageUploader({
  kind, userId, currentUrl, next,
}: {
  kind: "avatar" | "cover"; userId: string; currentUrl: string | null; next?: string;
}) {
  const isAvatar = kind === "avatar";
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className={isAvatar
        ? "size-24 shrink-0 overflow-hidden rounded-full border border-line bg-accent-soft"
        : "aspect-[3/1] w-full shrink-0 overflow-hidden rounded-xl border border-line bg-gradient-to-br from-primary-soft to-accent-soft sm:w-56"}>
        {currentUrl && <img src={currentUrl} alt="" className="size-full object-cover" />}
      </div>
      <div className="flex-1">
        <UploadForm action={isAvatar ? uploadAvatarAction : uploadCoverAction} bucket={isAvatar ? "avatars" : "covers"}
          userId={userId} hidden={{ next }} fileLabel={isAvatar ? "Profile photo" : "Cover image"}>
          <div className="flex flex-wrap items-center gap-2">
            <FormSubmit size="sm" variant="secondary" pendingLabel="Uploading…">Upload</FormSubmit>
            {currentUrl && (
              <ActionButton action={() => removeImageAction(kind)} confirm="Click again to remove" tone="danger">
                Remove
              </ActionButton>
            )}
          </div>
        </UploadForm>
      </div>
    </div>
  );
}

export function InterestsForm({
  niches, categories, industries, selected, next, submitLabel = "Save",
}: {
  niches: Option[]; categories: Option[]; industries: Option[];
  selected: { niches: string[]; categories: string[]; industries: string[] };
  next?: string; submitLabel?: string;
}) {
  return (
    <ActionForm action={saveInterestsAction} hidden={{ next }}>
      <CheckboxPills name="niches" label="Your niches" hint="Choose up to 5." options={niches} defaultValues={selected.niches} />
      <CheckboxPills name="categories" label="Content you make" hint="Choose up to 6." options={categories}
        defaultValues={selected.categories} />
      <CheckboxPills name="industries" label="Industries you'd love to partner with" hint="Optional — choose up to 10."
        options={industries} defaultValues={selected.industries} />
      <FormSubmit pendingLabel="Saving…">{submitLabel}</FormSubmit>
    </ActionForm>
  );
}

export function GoalsForm({
  supportTypes, selected, seeking, representation, next, submitLabel = "Save",
}: {
  supportTypes: Option[]; selected: string[]; seeking: boolean; representation: string; next?: string; submitLabel?: string;
}) {
  return (
    <ActionForm action={saveGoalsAction} hidden={{ next }}>
      <SwitchField name="seekingManagement" label="I'm actively looking for management"
        description="Shows a “Seeking management” badge and helps companies find you." defaultChecked={seeking} />
      <RadioCards name="representationStatus" label="Current representation" defaultValue={representation}
        options={[
          { value: "unrepresented", label: "Not represented", hint: "No manager or agency right now" },
          { value: "represented", label: "Represented", hint: "Happy with my current team" },
          { value: "open_to_switch", label: "Open to switching", hint: "Represented, but exploring" },
        ]} />
      <CheckboxPills name="supportTypes" label="Support you're looking for" options={supportTypes} defaultValues={selected} />
      <FormSubmit pendingLabel="Saving…">{submitLabel}</FormSubmit>
    </ActionForm>
  );
}
