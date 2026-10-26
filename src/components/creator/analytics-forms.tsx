"use client";

import Link from "next/link";
import { ActionForm, FormSubmit, useActionForm } from "@/components/forms/action-form";
import { ConsentCheckbox, TextField, selectClass } from "@/components/forms/fields";
import { UploadForm } from "@/components/forms/upload-form";
import {
  grantDataConsentAction, saveDemographicsAction, saveSnapshotAction, uploadEvidenceAction,
} from "@/app/creator/_actions/analytics";
import { AGE_BUCKETS, GENDER_BUCKETS, GENDER_LABELS } from "@/lib/creator/demographics";
import { countryOptions } from "@/lib/countries";
import { todayIso } from "@/lib/format";

export function DataConsentForm() {
  return (
    <ActionForm action={grantDataConsentAction}>
      <ConsentCheckbox name="dataConsent">
        I consent to TalentLoom storing the audience numbers and evidence I upload, and showing them according to my{" "}
        <Link href="/creator/privacy" className="font-medium text-primary underline">privacy settings</Link>. Numbers I enter
        are labelled <strong>self-reported</strong> unless TalentLoom verifies them. I can withdraw this consent at any time.
        Read the <Link href="/legal/creator-data-consent" target="_blank" className="font-medium text-primary underline">Creator Data Consent</Link>.
      </ConsentCheckbox>
      <FormSubmit pendingLabel="Saving…">I agree — continue</FormSubmit>
    </ActionForm>
  );
}

interface Snapshot {
  followers: number | null; avg_views: number | null; avg_likes: number | null; avg_comments: number | null;
  engagement_rate: number | null; growth_30d_pct: number | null; captured_at: string;
}

export function SnapshotForm({ accountId, latest }: { accountId: string; latest: Snapshot | null }) {
  const action = saveSnapshotAction.bind(null, accountId);
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="followers" label="Followers" inputMode="numeric" required defaultValue={latest?.followers} />
        <TextField name="avgViews" label="Avg. views per post" inputMode="numeric" defaultValue={latest?.avg_views} />
        <TextField name="avgLikes" label="Avg. likes per post" inputMode="numeric" defaultValue={latest?.avg_likes} />
        <TextField name="avgComments" label="Avg. comments per post" inputMode="numeric" defaultValue={latest?.avg_comments} />
        <TextField name="engagementRate" label="Engagement rate (%)" inputMode="decimal" defaultValue={latest?.engagement_rate}
          hint="(likes + comments) ÷ followers × 100" />
        <TextField name="growth30d" label="30-day growth (%)" inputMode="decimal" defaultValue={latest?.growth_30d_pct} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <TextField name="capturedAt" label="As of" type="date" defaultValue={todayIso()} />
        </div>
        <FormSubmit pendingLabel="Saving…">Save numbers</FormSubmit>
      </div>
      <p className="text-xs text-muted">
        Saving on a new date adds to your history. Changing numbers that were verified marks them self-reported again.
      </p>
    </ActionForm>
  );
}

function PctInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: number }) {
  const err = useActionForm().state.errors?.[name];
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted">{label}</span>
      <span className="relative mt-1 block">
        <input name={name} inputMode="decimal" defaultValue={defaultValue}
          className={`h-10 w-full rounded-lg border bg-surface px-3 pr-7 text-sm ${err ? "border-danger" : "border-line"} focus:border-primary focus:outline-none`} />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted">%</span>
      </span>
    </label>
  );
}

export function DemographicsForm({
  snapshotId, existing,
}: {
  snapshotId: string; existing: { dimension: string; bucket: string; pct: number }[];
}) {
  const action = saveDemographicsAction.bind(null, snapshotId);
  const get = (dim: string, bucket: string) => existing.find((d) => d.dimension === dim && d.bucket === bucket)?.pct;
  const countries = existing.filter((d) => d.dimension === "country").sort((a, b) => b.pct - a.pct);
  const options = countryOptions();
  return (
    <ActionForm action={action}>
      <div>
        <p className="text-sm font-medium text-ink">Age</p>
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {AGE_BUCKETS.map((b) => <PctInput key={b} name={`age_${b}`} label={b} defaultValue={get("age", b)} />)}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-ink">Gender</p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {GENDER_BUCKETS.map((b) => <PctInput key={b} name={`gender_${b}`} label={GENDER_LABELS[b]} defaultValue={get("gender", b)} />)}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-ink">Top countries</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem] gap-2">
              <select name={`country_${i}`} defaultValue={countries[i - 1]?.bucket ?? ""} className={`${selectClass} h-10 text-sm`}
                aria-label={`Country ${i}`}>
                <option value="">Country…</option>
                {options.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <PctInput name={`country_pct_${i}`} label="" defaultValue={countries[i - 1]?.pct} />
            </div>
          ))}
        </div>
      </div>
      <FormSubmit variant="secondary" pendingLabel="Saving…">Save demographics</FormSubmit>
    </ActionForm>
  );
}

export function EvidenceUpload({ snapshotId, userId }: { snapshotId: string; userId: string }) {
  return (
    <UploadForm action={uploadEvidenceAction.bind(null, snapshotId)} bucket="analytics-evidence" userId={userId}
      fileLabel="Screenshot or export from the platform's analytics">
      <FormSubmit size="sm" variant="secondary" pendingLabel="Uploading…">Upload evidence</FormSubmit>
    </UploadForm>
  );
}
