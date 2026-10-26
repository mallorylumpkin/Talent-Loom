import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AccountType = "creator" | "company_member" | "super_admin";

export interface Viewer {
  id: string;
  email: string;
  accountType: AccountType;
  status: "active" | "suspended" | "deleted";
  displayName: string | null;
  onboardingCompletedAt: string | null;
}

/** Current signed-in user + profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, account_type, status, display_name, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    accountType: profile.account_type,
    status: profile.status,
    displayName: profile.display_name,
    onboardingCompletedAt: profile.onboarding_completed_at,
  };
});

/** Where each account type lands after signing in. */
export function homeFor(viewer: Pick<Viewer, "accountType" | "onboardingCompletedAt">): string {
  switch (viewer.accountType) {
    case "super_admin":
      return "/admin";
    case "company_member":
      return "/company";
    default:
      return viewer.onboardingCompletedAt ? "/creator" : "/creator/onboarding";
  }
}

export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (viewer.status !== "active") redirect("/account-suspended");
  return viewer;
}

/** Guard for role dashboards. Wrong role → sent to their own home. */
export async function requireRole(role: AccountType, next?: string): Promise<Viewer> {
  const viewer = await requireViewer(next);
  if (viewer.accountType !== role) redirect(homeFor(viewer));
  return viewer;
}

/**
 * Super-admin guard. Requires an MFA (aal2) session; otherwise sends the
 * admin to enrol/verify TOTP. The database enforces the same rule.
 */
export async function requireAdmin(options: { allowWithoutMfa?: boolean } = {}): Promise<Viewer> {
  const viewer = await requireRole("super_admin", "/admin");
  if (!options.allowWithoutMfa) {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") redirect("/admin/mfa");
  }
  return viewer;
}

/** Only allow same-site relative redirects (prevents open-redirect abuse). */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
