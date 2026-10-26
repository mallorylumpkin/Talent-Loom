"use client";

import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { saveAffiliateAction, saveDealAction } from "@/app/creator/_actions/pro";
import { DEAL_STAGE_LABELS, DEAL_STAGES } from "@/lib/creator/pro";

type Row = Record<string, string | number | null | undefined>;
const v = (r: Row | undefined, k: string) => (r?.[k] === null || r?.[k] === undefined ? undefined : String(r[k]));

export function AffiliateForm({ row }: { row?: Row & { id: string } }) {
  return (
    <ActionForm action={saveAffiliateAction.bind(null, row?.id ?? null)} resetOnSuccess={!row}>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="brand" label="Brand" required defaultValue={v(row, "brand_name")} />
        <TextField name="product" label="Product" defaultValue={v(row, "product")} />
        <TextField name="code" label="Discount code" defaultValue={v(row, "code")} />
        <TextField name="link" label="Affiliate link" defaultValue={v(row, "affiliate_link")} />
        <TextField name="network" label="Network (LTK, ShopMy, Amazon…)" defaultValue={v(row, "network")} />
        <TextField name="rate" label="Commission %" defaultValue={v(row, "commission_rate")} />
        <TextField name="cookieDays" label="Cookie window (days)" defaultValue={v(row, "cookie_days")} />
        <TextField name="starts" label="Starts" type="date" defaultValue={v(row, "starts_on")} />
        <TextField name="expires" label="Expires" type="date" defaultValue={v(row, "expires_on")} />
        <TextField name="contact" label="Brand contact" defaultValue={v(row, "brand_contact")} />
        <SelectField name="payout" label="Payout" defaultValue={v(row, "payout_status") ?? "none"} options={[
          { value: "none", label: "—" }, { value: "pending", label: "Pending" }, { value: "paid", label: "Paid" }, { value: "disputed", label: "Disputed" }]} />
        <TextField name="content" label="Used in (post / video)" defaultValue={v(row, "associated_content")} />
      </div>
      <TextAreaField name="restrictions" label="Restrictions" rows={2} defaultValue={v(row, "restrictions")} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={v(row, "notes")} />
      <FormSubmit size="sm" pendingLabel="Saving…">{row ? "Save" : "Add code"}</FormSubmit>
    </ActionForm>
  );
}

export function DealForm({ row }: { row?: Row & { id: string; deliverables?: { item: string }[] } }) {
  const dollars = (k: string) => (row?.[k] === null || row?.[k] === undefined ? undefined : String(Number(row[k]) / 100));
  return (
    <ActionForm action={saveDealAction.bind(null, row?.id ?? null)} resetOnSuccess={!row}>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="brand" label="Brand" required defaultValue={v(row, "brand")} />
        <TextField name="opportunity" label="Opportunity" defaultValue={v(row, "opportunity")} />
        <TextField name="contact" label="Contact" defaultValue={v(row, "contact")} />
        <SelectField name="stage" label="Stage" defaultValue={v(row, "stage") ?? "lead"} options={DEAL_STAGES.map((s) => ({ value: s, label: DEAL_STAGE_LABELS[s] }))} />
        <TextField name="proposed" label="Proposed ($)" defaultValue={dollars("proposed_cents")} />
        <TextField name="agreed" label="Agreed ($)" defaultValue={dollars("agreed_cents")} />
        <TextField name="due" label="Content due" type="date" defaultValue={v(row, "due_date")} />
        <TextField name="publish" label="Publish date" type="date" defaultValue={v(row, "publish_date")} />
        <TextField name="exclusivity" label="Exclusive until" type="date" defaultValue={v(row, "exclusivity_until")} />
        <SelectField name="approval" label="Brand approval" defaultValue={v(row, "approval_status") ?? "not_submitted"} options={[
          { value: "not_submitted", label: "Not submitted" }, { value: "submitted", label: "Submitted" },
          { value: "changes_requested", label: "Changes requested" }, { value: "approved", label: "Approved" }]} />
        <SelectField name="invoice" label="Invoice" defaultValue={v(row, "invoice_status") ?? "not_sent"} options={[
          { value: "not_sent", label: "Not sent" }, { value: "sent", label: "Sent" }, { value: "overdue", label: "Overdue" }, { value: "void", label: "Void" }]} />
        <SelectField name="payment" label="Payment" defaultValue={v(row, "payment_status") ?? "unpaid"} options={[
          { value: "unpaid", label: "Unpaid" }, { value: "partial", label: "Partly paid" }, { value: "paid", label: "Paid" }]} />
      </div>
      <TextAreaField name="deliverables" label="Deliverables (one per line)" rows={3}
        defaultValue={row?.deliverables?.map((d) => d.item).join("\n")} />
      <TextAreaField name="usage" label="Usage rights" rows={2} defaultValue={v(row, "usage_rights")} />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={v(row, "notes")} />
      <FormSubmit size="sm" pendingLabel="Saving…">{row ? "Save" : "Add deal"}</FormSubmit>
    </ActionForm>
  );
}
