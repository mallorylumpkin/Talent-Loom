import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/creator/section";
import { PasswordForm } from "@/components/company/forms";
import { requireCompany } from "@/lib/company/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function CompanySettingsPage() {
  const { viewer, supabase, company, entitlements } = await requireCompany();
  const [{ data: sub }, { data: features }] = await Promise.all([
    supabase.from("subscriptions").select("status, comp_expires_at, plans(name)").eq("owner_type", "company").eq("owner_id", company.id)
      .in("status", ["active", "trialing", "complimentary", "past_due"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("features").select("key, label, kind").eq("audience", "company").order("sort"),
  ]);
  const byKey = new Map(entitlements.map((e) => [e.feature_key, e]));
  const planName = (sub?.plans as { name?: string } | null)?.name ?? "No plan assigned";

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Section title="Plan" description={sub?.comp_expires_at ? `${planName} · complimentary until ${shortDate(sub.comp_expires_at)}` : planName}>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {(features ?? []).map((f: { key: string; label: string; kind: string }) => {
              const e = byKey.get(f.key);
              const on = !!e?.enabled && e.limit_value !== 0;
              return (
                <li key={f.key} className={`flex items-center gap-2 ${on ? "text-ink" : "text-muted"}`}>
                  {on ? <Check className="size-4 text-success" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                  {f.label}
                  {f.kind === "limit" && on && <span className="text-muted">— {e?.limit_value ?? "unlimited"}</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-sm text-muted">To change your plan, contact TalentLoom. Self-serve billing arrives soon.</p>
        </Section>
        <Section title="Your sign-in">
          <p className="mb-5 text-sm text-muted">Signed in as <span className="font-medium text-ink">{viewer.email}</span>.</p>
          <PasswordForm />
        </Section>
      </div>
    </>
  );
}
