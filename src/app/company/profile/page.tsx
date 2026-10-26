import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/creator/section";
import { CompanyProfileForm, LogoUploader } from "@/components/company/forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { submitForReviewAction } from "@/app/company/_actions/company";
import { COMPANY_STATUS_LABELS } from "@/lib/admin/context";
import { requireCompany } from "@/lib/company/context";
import { publicStorageUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyProfilePage() {
  const { supabase, company, permissions } = await requireCompany();
  const [{ data: cats }, { data: selected }, { data: lastApp }] = await Promise.all([
    supabase.from("content_categories").select("id, label").eq("active", true).order("sort"),
    supabase.from("company_categories").select("category_id").eq("company_id", company.id),
    supabase.from("company_applications").select("info_request_message, admin_notes, status, created_at")
      .eq("company_id", company.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const canEdit = permissions.has("company.edit");
  const status = COMPANY_STATUS_LABELS[company.status];
  const canSubmit = canEdit && (company.status === "draft" || company.status === "info_requested");

  return (
    <>
      <PageHeader title="Company profile" description="Creators see this when you contact them."
        action={<Badge tone={status.tone}>{status.label}</Badge>} />

      {company.status === "info_requested" && lastApp?.info_request_message && (
        <Alert tone="warning" className="mb-6" title="TalentLoom asked for more information">
          {lastApp.info_request_message}
        </Alert>
      )}
      {company.status === "rejected" && lastApp?.admin_notes && (
        <Alert tone="danger" className="mb-6" title="Application not approved">{lastApp.admin_notes}</Alert>
      )}
      {!canEdit && <Alert tone="info" className="mb-6">Only owners and admins can edit the company profile.</Alert>}

      <div className="space-y-6">
        {canSubmit && (
          <Section title="Submit for review" description="When your profile is ready, send it to TalentLoom. Approval unlocks contacting creators.">
            <ActionButton action={submitForReviewAction} tone="primary">Submit for review</ActionButton>
          </Section>
        )}
        {canEdit && (
          <Section title="Logo">
            <LogoUploader companyId={company.id} currentUrl={publicStorageUrl("company-logos", company.logo_path)} />
          </Section>
        )}
        {canEdit && (
          <Section title="Details">
            <CompanyProfileForm company={company} categories={cats ?? []}
              selected={(selected ?? []).map((s: { category_id: string }) => s.category_id)} />
          </Section>
        )}
      </div>
    </>
  );
}
