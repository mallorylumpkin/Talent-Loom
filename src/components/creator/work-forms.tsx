"use client";

import { useState } from "react";
import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField, selectClass } from "@/components/forms/fields";
import { UploadForm } from "@/components/forms/upload-form";
import {
  addPartnershipAction, addPortfolioFileAction, addPortfolioLinkAction, updatePortfolioItemAction, uploadMediaKitAction,
} from "@/app/creator/_actions/work";
import { cn } from "@/lib/cn";

const visibilityOptions = [
  { value: "public", label: "Public" },
  { value: "approved_companies", label: "Approved companies only" },
  { value: "private", label: "Only me" },
];

function FeaturedCheckbox({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" name="featured" defaultChecked={defaultChecked} className="size-4 accent-primary" />
      Feature this at the top of my portfolio
    </label>
  );
}

export function AddPortfolioItem({ platforms, userId }: { platforms: { id: string; label: string }[]; userId: string }) {
  const [mode, setMode] = useState<"link" | "file">("link");
  const platformOptions = platforms.map((p) => ({ value: p.id, label: p.label }));
  const common = (
    <>
      <TextField name="title" label="Title" required placeholder="Morning routine series for a skincare brand" />
      <TextAreaField name="description" label="Description (optional)" rows={3} maxLength={1000} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="platformId" label="Platform (optional)" placeholder="—" options={platformOptions} />
        <SelectField name="visibility" label="Who can see this" defaultValue="public" options={visibilityOptions} />
      </div>
      <FeaturedCheckbox />
    </>
  );

  return (
    <div>
      <div role="tablist" className="mb-5 inline-flex rounded-xl bg-canvas p-1">
        {(["link", "file"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cn("rounded-lg px-4 py-1.5 text-sm font-medium", mode === m ? "bg-surface text-ink shadow-sm" : "text-muted")}>
            {m === "link" ? "Link to a post" : "Upload a file"}
          </button>
        ))}
      </div>
      {mode === "link" ? (
        <ActionForm action={addPortfolioLinkAction} resetOnSuccess>
          <TextField name="url" label="Link" required placeholder="https://www.instagram.com/p/…" />
          {common}
          <FormSubmit pendingLabel="Adding…">Add to portfolio</FormSubmit>
        </ActionForm>
      ) : (
        <UploadForm action={addPortfolioFileAction} bucket="portfolio-private" userId={userId} fileLabel="Image or PDF">
          {common}
          <FormSubmit pendingLabel="Uploading…">Upload to portfolio</FormSubmit>
        </UploadForm>
      )}
    </div>
  );
}

export function PortfolioItemSettings({ id, visibility, featured }: { id: string; visibility: string; featured: boolean }) {
  return (
    <ActionForm action={updatePortfolioItemAction.bind(null, id)} className="flex flex-wrap items-center gap-3" showSuccess={false}>
      <select name="visibility" defaultValue={visibility} aria-label="Who can see this" className={`${selectClass} h-9 w-auto text-sm`}>
        {visibilityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-ink">
        <input type="checkbox" name="featured" defaultChecked={featured} className="size-4 accent-primary" /> Featured
      </label>
      <FormSubmit size="sm" variant="secondary" pendingLabel="Saving…">Save</FormSubmit>
    </ActionForm>
  );
}

export function PartnershipForm({ categories }: { categories: { id: string; label: string }[] }) {
  return (
    <ActionForm action={addPartnershipAction} resetOnSuccess>
      <div className="grid gap-5 sm:grid-cols-[1.5fr_1fr_1fr]">
        <TextField name="brandName" label="Brand" required />
        <TextField name="year" label="Year" inputMode="numeric" placeholder={String(new Date().getFullYear())} />
        <SelectField name="categoryId" label="Category" placeholder="—" options={categories.map((c) => ({ value: c.id, label: c.label }))} />
      </div>
      <TextAreaField name="description" label="What you made (optional)" rows={2} maxLength={1000} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="link" label="Link (optional)" placeholder="https://…" />
        <SelectField name="visibility" label="Who can see this" defaultValue="public" options={visibilityOptions} />
      </div>
      <FormSubmit pendingLabel="Adding…">Add partnership</FormSubmit>
    </ActionForm>
  );
}

export function MediaKitUpload({ userId, replacing }: { userId: string; replacing: boolean }) {
  return (
    <UploadForm action={uploadMediaKitAction} bucket="media-kits" userId={userId}
      fileLabel={replacing ? "Upload a new version" : "Your media kit (PDF recommended)"}>
      <FormSubmit pendingLabel="Uploading…">{replacing ? "Replace media kit" : "Upload media kit"}</FormSubmit>
    </UploadForm>
  );
}
