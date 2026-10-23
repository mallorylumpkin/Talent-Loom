import type { Metadata } from "next";
import { Building2, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company dashboard" };

const statusCopy: Record<string, { tone: "success" | "warning" | "danger" | "neutral"; label: string; note?: string }> = {
  approved: { tone: "success", label: "Approved" },
  submitted: { tone: "warning", label: "Under review", note: "TalentLoom is reviewing your company. You can set up your profile and team in the meantime; contacting creators unlocks after approval." },
  info_requested: { tone: "warning", label: "Information requested", note: "TalentLoom needs a bit more information before approving your company. Check your email or the company profile page." },
  draft: { tone: "neutral", label: "Setup in progress", note: "Finish your company profile so TalentLoom can review it." },
  rejected: { tone: "danger", label: "Not approved", note: "Your company wasn't approved. Contact support if you'd like to discuss it." },
  suspended: { tone: "danger", label: "Suspended", note: "This company is suspended. Contact support." },
};

export default async function CompanyDashboard() {
  const viewer = await requireRole("company_member", "/company");
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, companies(id, name, status), company_roles(name)")
    .eq("user_id", viewer.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const company = membership?.companies as { id: string; name: string; status: string } | null | undefined;

  if (!company) {
    return (
      <>
        <PageHeader title="Company dashboard" />
        <EmptyState
          icon={Building2}
          title="You're not part of a company yet"
          description="Ask your company's owner to invite you, or contact TalentLoom if you're expecting access."
        />
      </>
    );
  }

  const { data: entitlements } = await supabase.rpc("my_entitlements", { p_company_id: company.id });
  const limit = (key: string) => {
    const row = (entitlements as { feature_key: string; enabled: boolean; limit_value: number | null }[] | null)
      ?.find((e) => e.feature_key === key);
    if (!row?.enabled) return "—";
    return row.limit_value === null ? "Unlimited" : String(row.limit_value);
  };
  const status = statusCopy[company.status] ?? statusCopy.draft;
  const roleName = (membership?.company_roles as { name?: string } | null)?.name;

  return (
    <>
      <PageHeader
        title={company.name}
        description={roleName ? `You're signed in as ${roleName}.` : undefined}
        action={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {status.note && <Alert tone={status.tone === "danger" ? "danger" : "warning"} className="mb-6">{status.note}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Seats" value={limit("seats.max")} />
        <StatTile label="New contacts / month" value={limit("contacts.monthly")} />
        <StatTile label="Saved creators" value={limit("saved_creators.max")} />
        <StatTile label="Pipelines" value={limit("pipelines.max")} />
      </div>

      <div className="mt-8">
        <EmptyState
          icon={Search}
          title="Creator search is coming next"
          description="Search, filters, saved talent lists and your recruiting pipeline arrive in the next build phases."
        />
      </div>
    </>
  );
}
