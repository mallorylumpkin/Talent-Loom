import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CreateCompanyForm } from "@/components/admin/company-forms";
import { getAdminContext } from "@/lib/admin/context";

export const metadata: Metadata = { title: "New company" };

export default async function NewCompanyPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { supabase } = await getAdminContext();
  const leadId = (await searchParams).lead;
  const [{ data: plans }, lead] = await Promise.all([
    supabase.from("plans").select("key, name").eq("audience", "company").eq("is_active", true).neq("key", "company_pending").order("sort"),
    leadId && /^[0-9a-f-]{36}$/i.test(leadId)
      ? supabase.from("company_leads").select("id, company_name, website, contact_name, contact_email, team_size, interested_plan")
          .eq("id", leadId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="New management company"
        description="Creates the company workspace, gives it a plan, and creates the owner's account with a one-time setup link." />
      <Card className="p-5 sm:p-8">
        <CreateCompanyForm plans={plans ?? []} lead={lead} />
      </Card>
    </>
  );
}
