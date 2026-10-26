import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  AddMemberForm, CompanyFlagsForm, PlanForm, ReviewCompanyForm, SetupLinkButton,
} from "@/components/admin/company-forms";
import { COMPANY_STATUS_LABELS, getAdminContext } from "@/lib/admin/context";
import { CompanyCheckoutForm, ContactCreditsForm } from "@/components/admin/billing-forms";
import { lastSignIns } from "@/lib/auth/company-users";
import { countryName } from "@/lib/countries";
import { shortDate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: "Company" };

export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getAdminContext();
  const [{ data: credits }, { data: pricesData }] = await Promise.all([
    supabase.rpc("company_credit_balance", { p_company_id: id }),
    supabase.from("plan_prices").select("id, billing_interval, amount_cents, stripe_price_id, plans!inner(name, audience)")
      .eq("plans.audience", "company").eq("active", true).not("stripe_price_id", "is", null),
  ]);
  const companyPrices = ((pricesData ?? []) as unknown as { id: string; billing_interval: string; amount_cents: number; plans: { name: string } }[])
    .map((p) => ({ id: p.id, label: `${p.plans.name} — $${(p.amount_cents / 100).toLocaleString()}/${p.billing_interval}` }));

  const [{ data: company }, { data: members }, { data: apps }, { data: sub }, { data: plans }, { data: cats }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).maybeSingle(),
    supabase.from("company_members").select("user_id, status, created_at, profiles(email, display_name), company_roles(name)")
      .eq("company_id", id).order("created_at"),
    supabase.from("company_applications").select("id, status, info_request_message, admin_notes, created_at, reviewed_at")
      .eq("company_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("subscriptions").select("status, comp_expires_at, plans(key, name)").eq("owner_type", "company").eq("owner_id", id)
      .in("status", ["active", "trialing", "complimentary", "past_due"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("plans").select("key, name").eq("audience", "company").eq("is_active", true).neq("key", "company_pending").order("sort"),
    supabase.from("company_categories").select("content_categories(label)").eq("company_id", id),
  ]);
  if (!company) notFound();

  const memberRows = (members ?? []) as unknown as {
    user_id: string; status: string; created_at: string; profiles: { email: string; display_name: string | null };
    company_roles: { name: string };
  }[];
  const signIns = await lastSignIns(memberRows.map((m) => m.user_id));
  const status = COMPANY_STATUS_LABELS[company.status];
  const plan = (sub?.plans ?? null) as unknown as { key: string; name: string } | null;
  const logo = publicStorageUrl("company-logos", company.logo_path);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {logo && <img src={logo} alt="" className="size-10 rounded-lg border border-line object-cover" />}
            {company.name}
          </span>
        }
        description={[company.city, company.region, countryName(company.country)].filter(Boolean).join(", ") || undefined}
        action={<div className="flex flex-wrap gap-2"><Badge tone="primary">{plan?.name ?? "No plan"}</Badge><Badge tone={status.tone}>{status.label}</Badge></div>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Review" description="Approved companies can view “approved companies” fields and contact creators." />
            <CardBody><ReviewCompanyForm companyId={company.id} status={company.status} /></CardBody>
          </Card>

          <Card>
            <CardHeader title="Profile" description="Edited by the company." />
            <CardBody className="space-y-4 text-sm">
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {company.website} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
              <p className="whitespace-pre-line text-ink/85">{company.description ?? <span className="text-muted">No description yet.</span>}</p>
              {company.services_description && (
                <div><p className="font-medium text-ink">Services</p><p className="whitespace-pre-line text-ink/85">{company.services_description}</p></div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {((cats ?? []) as unknown as { content_categories: { label: string } | null }[]).map((c, i) =>
                  c.content_categories && <Badge key={i}>{c.content_categories.label}</Badge>)}
                {(company.specialties ?? []).map((s: string) => <Badge key={s} tone="primary">{s}</Badge>)}
              </div>
              <p className="text-muted">Contact: {company.contact_email ?? "—"} · Size: {company.size_band ?? "—"}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Team" description="Members who haven't signed in yet need their setup link." />
            <CardBody className="space-y-6">
              <ul className="divide-y divide-line">
                {memberRows.map((m) => {
                  const signedIn = signIns.get(m.user_id);
                  return (
                    <li key={m.user_id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium text-ink">{m.profiles.display_name ?? m.profiles.email}</p>
                        <p className="text-muted">{m.profiles.email} · {m.company_roles.name}{m.status !== "active" && ` · ${m.status}`}</p>
                        <p className="text-xs text-muted">{signedIn ? `Last signed in ${shortDate(signedIn)}` : "Hasn't signed in yet"}</p>
                      </div>
                      <SetupLinkButton companyId={company.id} userId={m.user_id} />
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line pt-5">
                <h3 className="mb-3 text-base font-semibold text-ink">Add a member</h3>
                <AddMemberForm companyId={company.id} />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Plan" description={sub?.comp_expires_at ? `Complimentary until ${shortDate(sub.comp_expires_at)}` : "Assign a complimentary plan here, or send a payment link below"} />
            <CardBody><PlanForm companyId={company.id} plans={plans ?? []} currentKey={plan?.key} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Billing" description={`Contact credits available: ${credits ?? 0}`} />
            <CardBody className="space-y-5">
              <CompanyCheckoutForm companyId={id} prices={companyPrices} />
              <ContactCreditsForm companyId={id} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Trust and visibility" />
            <CardBody>
              <CompanyFlagsForm companyId={company.id}
                flags={{ verified: company.is_verified_badge, frozen: company.outreach_frozen, featured: company.is_featured }} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="History" />
            <CardBody>
              {(apps ?? []).length === 0 ? <p className="text-sm text-muted">No submissions or decisions yet.</p> : (
                <ol className="space-y-3 text-sm">
                  {(apps ?? []).map((a: { id: string; status: string; admin_notes: string | null; created_at: string }) => (
                    <li key={a.id} className="border-l-2 border-line pl-3">
                      <p className="font-medium text-ink">{COMPANY_STATUS_LABELS[a.status]?.label ?? a.status}</p>
                      <p className="text-xs text-muted">{shortDate(a.created_at)}</p>
                      {a.admin_notes && <p className="mt-1 text-ink/80">{a.admin_notes}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
