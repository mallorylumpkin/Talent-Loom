import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  logo_path: string | null;
  description: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  size_band: string | null;
  status: "draft" | "submitted" | "info_requested" | "approved" | "rejected" | "suspended";
  is_verified_badge: boolean;
  specialties: string[];
  services_description: string | null;
  contact_email: string | null;
  outreach_frozen: boolean;
}

export interface Entitlement {
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
}

/**
 * The signed-in company member, their company, their permissions and the
 * company's plan entitlements. Every permission is enforced again in the database.
 */
export const getCompanyContext = cache(async () => {
  const viewer = await requireRole("company_member", "/company");
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role_id, company_roles(key, name, company_role_permissions(permission_key)), companies(*)")
    .eq("user_id", viewer.id)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) return { viewer, supabase, company: null, role: null, permissions: new Set<string>(), entitlements: [] as Entitlement[] };

  const roleRow = membership.company_roles as unknown as {
    key: string; name: string; company_role_permissions: { permission_key: string }[];
  };
  const company = membership.companies as unknown as CompanyRow;
  const { data: entitlements } = await supabase.rpc("my_entitlements", { p_company_id: company.id });

  return {
    viewer,
    supabase,
    company,
    role: { key: roleRow.key, name: roleRow.name },
    permissions: new Set(roleRow.company_role_permissions.map((p) => p.permission_key)),
    entitlements: (entitlements ?? []) as Entitlement[],
  };
});

/** Like getCompanyContext, but sends people without a company to the dashboard (which explains why). */
export async function requireCompany() {
  const ctx = await getCompanyContext();
  if (!ctx.company) redirect("/company");
  return ctx as typeof ctx & { company: CompanyRow; role: { key: string; name: string } };
}

export function feature(entitlements: Entitlement[], key: string) {
  const e = entitlements.find((x) => x.feature_key === key);
  return { enabled: !!e?.enabled, limit: e?.enabled ? e.limit_value : 0 };
}
