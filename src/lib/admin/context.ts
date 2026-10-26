import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * MFA-verified super admin + a Supabase client acting AS the admin, so the
 * database's admin policies apply and audit entries record who did what.
 */
export async function getAdminContext() {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  return { viewer, supabase };
}

export const COMPANY_STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  draft: { label: "Setting up", tone: "neutral" },
  submitted: { label: "Awaiting review", tone: "warning" },
  info_requested: { label: "Info requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
};

export const ACCOUNT_LABELS: Record<string, string> = { creator: "Creator", company_member: "Company", super_admin: "Super admin" };

export const TAXONOMY_TABLES = ["niches", "content_categories", "industries", "support_types", "platforms"] as const;
export const TAXONOMY_LABELS: Record<(typeof TAXONOMY_TABLES)[number], string> = {
  niches: "Niches", content_categories: "Content categories", industries: "Industries", support_types: "Support types", platforms: "Social platforms",
};
