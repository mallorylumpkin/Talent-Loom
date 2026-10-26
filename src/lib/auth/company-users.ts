import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * Company accounts are never created through public sign-up. TalentLoom staff
 * (or a company owner inviting teammates) create them here. The account type is
 * stored in app_metadata, which users cannot edit, and the database trigger
 * turns it into a company_member profile.
 */
export async function createCompanyUser(email: string, displayName: string): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(32).toString("base64url"), // replaced when they set their own via the setup link
    email_confirm: true,
    app_metadata: { account_type: "company_member" },
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || /already/i.test(error?.message ?? "")) {
      return { ok: false, message: "That email already has a TalentLoom account. Company accounts need their own email address." };
    }
    console.error("[company-user]", error);
    return { ok: false, message: "We couldn't create that account. Please try again." };
  }
  return { ok: true, userId: data.user.id };
}

/**
 * A one-time link that lets someone choose their password and sign in.
 * Generated server-side, so it works even before an email provider is set up —
 * copy it and send it yourself. It expires per Supabase's "Email OTP expiration"
 * setting (1 hour by default; up to 24 hours).
 */
export async function createSetupLink(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    console.error("[setup-link]", error);
    return null;
  }
  const next = encodeURIComponent("/reset-password?welcome=1");
  return `${publicEnv.siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery&next=${next}`;
}

/** Last sign-in time for a set of users (so admins can see who hasn't set up their account yet). */
export async function lastSignIns(userIds: string[]): Promise<Map<string, string | null>> {
  const admin = createAdminClient();
  const out = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      out.set(id, data.user?.last_sign_in_at ?? null);
    }),
  );
  return out;
}
