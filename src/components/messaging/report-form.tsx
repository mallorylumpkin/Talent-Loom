"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { SelectField, TextAreaField } from "@/components/forms/fields";
import { reportAction } from "@/app/_actions/messaging";
import { REPORT_REASONS } from "@/lib/messaging/types";

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: string; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5 hover:text-ink">
        <Flag className="size-3.5" aria-hidden /> {label}
      </button>
    );
  }
  return (
    <div className="w-full rounded-xl border border-line bg-surface p-4">
      <ActionForm action={reportAction.bind(null, targetType, targetId)} resetOnSuccess>
        <SelectField name="reason" label="What's wrong?" options={REPORT_REASONS} placeholder="Choose a reason" />
        <TextAreaField name="details" label="Details (optional)" rows={3} maxLength={3000}
          hint="Only TalentLoom's safety team sees this." />
        <div className="flex gap-2">
          <FormSubmit variant="danger" pendingLabel="Sending…">Send report</FormSubmit>
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl px-3 text-sm font-medium text-muted hover:bg-ink/5">
            Cancel
          </button>
        </div>
      </ActionForm>
    </div>
  );
}
