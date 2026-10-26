import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Circle, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COMPANY_STATUS_LABELS } from "@/lib/admin/context";
import { feature, getCompanyContext } from "@/lib/company/context";

export const metadata: Metadata = { title: "Company dashboard" };

const statusNote: Record<string, string> = {
  draft: "Finish your company profile and submit it for review. Approval unlocks full creator profiles and outreach.",
  submitted: "TalentLoom is reviewing your company. You can search public profiles and set up your team in the meantime.",
  info_requested: "TalentLoom needs more information. Check your company profile page for details.",
  rejected: "Your company wasn't approved. Contact support if you'd like to discuss it.",
  suspended: "This company is suspended. Contact support.",
};

export default async function CompanyDashboard() {
  const { viewer, supabase, company, role, entitlements } = await getCompanyContext();

  if (!company) {
    return (
      <>
        <PageHeader title="Company dashboard" />
        <EmptyState icon={Building2} title="You're not part of a company yet"
          description="Ask your company's owner to add you, or contact TalentLoom if you're expecting access." />
      </>
    );
  }

  await supabase.rpc("touch_last_active");
  const [{ count: members }, { data: lists }] = await Promise.all([
    supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "active"),
    supabase.from("talent_lists").select("id, talent_list_members(creator_id)").eq("company_id", company.id),
  ]);
  const savedCount = new Set(
    ((lists ?? []) as { talent_list_members: { creator_id: string }[] }[]).flatMap((l) => l.talent_list_members.map((m) => m.creator_id)),
  ).size;
  const limit = (key: string) => {
    const f = feature(entitlements, key);
    return !f.enabled ? "—" : f.limit === null ? "Unlimited" : String(f.limit);
  };
  const status = COMPANY_STATUS_LABELS[company.status];

  const steps = [
    { done: !!company.description && company.description.length >= 30, label: "Describe your company", href: "/company/profile" },
    { done: !!company.logo_path, label: "Upload your logo", href: "/company/profile" },
    { done: (members ?? 0) > 1, label: "Add your team", href: "/company/team" },
    { done: company.status !== "draft", label: "Submit for review", href: "/company/profile" },
  ];

  return (
    <>
      <PageHeader title={company.name} description={role ? `Signed in as ${viewer.displayName ?? viewer.email} · ${role.name}` : undefined}
        action={<div className="flex flex-wrap gap-2"><Badge tone={status.tone}>{status.label}</Badge>
          {company.is_verified_badge && <Badge tone="success"><BadgeCheck className="size-3.5" aria-hidden /> Verified</Badge>}</div>} />

      {statusNote[company.status] && (
        <Alert tone={["rejected", "suspended"].includes(company.status) ? "danger" : "warning"} className="mb-6">
          {statusNote[company.status]}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Saved creators" value={savedCount} hint={`Plan limit: ${limit("saved_creators.max")}`} />
        <StatTile label="Team seats" value={`${members ?? 0} / ${limit("seats.max")}`} />
        <StatTile label="New contacts / month" value={limit("contacts.monthly")} hint="Outreach arrives in the next phase" />
        <StatTile label="Pipelines" value={limit("pipelines.max")} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Find your next signing" description="Search creators by niche, platform, audience and momentum." />
          <CardBody>
            <ButtonLink href="/company/search"><Search className="size-4" aria-hidden /> Search creators</ButtonLink>
          </CardBody>
        </Card>
        {steps.some((s) => !s.done) && (
          <Card>
            <CardHeader title="Set up your workspace" />
            <CardBody>
              <ul className="space-y-2">
                {steps.map((s) => (
                  <li key={s.label}>
                    {s.done ? (
                      <span className="flex items-center gap-3 px-3 py-2 text-muted">
                        <BadgeCheck className="size-5 text-success" aria-hidden /><span className="line-through">{s.label}</span>
                      </span>
                    ) : (
                      <Link href={s.href} className="group flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-ink hover:border-primary">
                        <Circle className="size-5 text-muted" aria-hidden /><span className="flex-1">{s.label}</span>
                        <ArrowRight className="size-4 text-muted group-hover:text-primary" aria-hidden />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
