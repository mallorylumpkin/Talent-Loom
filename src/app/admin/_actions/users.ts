"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAdminContext } from "@/lib/admin/context";
import {
  IMPERSONATION_COOKIE, IMPERSONATION_MINUTES, impersonationConfigured, jwtClaim, sealImpersonation,
} from "@/lib/admin/impersonation";
import { createSetupLink } from "@/lib/auth/company-users";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

function refresh(userId?: string) {
  revalidatePath("/admin/users");
  revalidatePath("/admin/creators");
  if (userId) revalidatePath(`/admin/users/${userId}`);
}

export async function setUserStatusAction(userId: string, status: "active" | "suspended" | "deleted", _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!uuid.safeParse(userId).success) return { message: "User not found" };
  const reason = String(fd.get("reason") ?? "").trim();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: userId, p_status: status, p_reason: reason || null });
  if (error) return { message: dbErrorMessage(error), values: { reason } };
  refresh(userId);
  return { ok: true, message: status === "active" ? "Account reactivated" : status === "suspended" ? "Account suspended" : "Account soft-deleted" };
}

export async function setSuperAdminAction(userId: string, on: boolean): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!uuid.safeParse(userId).success) return { message: "User not found" };
  const { error } = await supabase.rpc("admin_set_super_admin", { p_user_id: userId, p_on: on });
  if (error) return { message: dbErrorMessage(error) };
  refresh(userId);
  return { ok: true, message: on ? "Now a super admin. They'll set up two-factor on their next admin sign-in." : "Super admin removed" };
}

/** Permanent deletion: removes the login, profile and files. Requires typing the email. */
export async function permanentlyDeleteUserAction(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  if (!uuid.safeParse(userId).success || userId === viewer.id) return { message: "You can't delete this account here." };
  const { data: target } = await supabase.from("profiles").select("email, account_type, status").eq("id", userId).maybeSingle();
  if (!target) return { message: "User not found" };
  if (target.account_type === "super_admin") return { message: "Remove their super admin role first." };
  if (target.status !== "deleted") return { message: "Soft-delete the account first, then delete it permanently." };
  const typed = String(fd.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== String(target.email).toLowerCase()) return { errors: { confirm: "Type the account's email exactly to confirm" } };

  const { error: logError } = await supabase.rpc("admin_log", {
    p_action: "users.permanent_delete", p_target_type: "profiles", p_target_id: userId, p_metadata: { email: target.email },
  });
  if (logError) return { message: dbErrorMessage(logError) };

  const admin = createAdminClient();
  for (const bucket of ["avatars", "covers", "portfolio-private", "portfolio-public", "media-kits", "analytics-evidence", "verification-docs", "support-attachments"]) {
    const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { message: `We couldn't delete the login (${error.message}).` };
  refresh();
  redirect("/admin/users?deleted=1");
}

/** Create a creator account on someone's behalf (they set their own password with the link). */
export async function createCreatorAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const values = { email, name };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { errors: { email: "Enter a valid email" }, values };
  if (!name) return { errors: { name: "Enter their name" }, values };
  if (fd.get("adult") !== "on") return { errors: { adult: "Confirm you've checked they're 18 or older" }, values };

  const { data: setting } = await supabase.from("platform_settings").select("value").eq("key", "legal.terms_version").maybeSingle();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: { display_name: name, age_18_plus: "true", terms_version: typeof setting?.value === "string" ? setting.value : "admin-created" },
  });
  if (error || !data.user) {
    if (/already/i.test(error?.message ?? "")) return { errors: { email: "That email already has an account" }, values };
    return { message: `We couldn't create the account (${error?.message ?? "unknown error"}).`, values };
  }
  await supabase.rpc("admin_log", { p_action: "users.create", p_target_type: "profiles", p_target_id: data.user.id, p_metadata: { email } });
  const link = await createSetupLink(email);
  refresh();
  return {
    ok: true,
    message: "Creator account created. Send them this one-time link so they can choose a password.",
    data: { link: link ?? "", userId: data.user.id },
  };
}

export async function setupLinkForUserAction(userId: string): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const { data: target } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!target) return { message: "User not found" };
  const link = await createSetupLink(target.email);
  if (!link) return { message: "We couldn't create a link. Try again." };
  await supabase.rpc("admin_log", { p_action: "users.setup_link", p_target_type: "profiles", p_target_id: userId, p_metadata: {} });
  return { ok: true, message: "One-time sign-in link (send it only to this person):", data: { link } };
}

/** Start read-only "view as user" for support. */
export async function startImpersonationAction(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  if (!impersonationConfigured()) {
    return { message: "Add IMPERSONATION_COOKIE_SECRET to your environment variables first (see docs/SETUP.md)." };
  }
  if (!uuid.safeParse(userId).success || userId === viewer.id) return { message: "You can't view as this account." };
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { errors: { reason: "Say why (e.g. the support request) — it's recorded in the audit log" } };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles")
    .select("id, email, display_name, account_type, status, onboarding_completed_at").eq("id", userId).maybeSingle();
  if (!target) return { message: "User not found" };
  if (target.account_type === "super_admin") return { message: "Admin accounts can't be viewed as." };
  if (target.status !== "active") return { message: "Only active accounts can be viewed as." };
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (!authUser.user?.last_sign_in_at) return { message: "This person hasn't signed in yet, so there's nothing to view." };

  const { data: { session: adminSession } } = await supabase.auth.getSession();
  if (!adminSession) return { message: "Your session expired. Sign in again." };

  // A one-time sign-in token for the user, exchanged server-side (no email is sent, no password is seen).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return { message: "We couldn't start view-as mode. Try again." };
  const temp = createSupabaseClient(publicEnv.supabaseUrl(), publicEnv.supabaseKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await temp.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  const session = verified?.session;
  const sessionId = session ? jwtClaim(session.access_token, "session_id") : null;
  if (verifyError || !session || !sessionId) return { message: "We couldn't start view-as mode. Try again." };

  const { data: impId, error: recordError } = await admin.rpc("record_impersonation_start", {
    p_admin_id: viewer.id, p_target_user_id: userId, p_reason: reason, p_auth_session_id: sessionId,
  });
  if (recordError || !impId) {
    await temp.auth.signOut({ scope: "local" });
    return { message: dbErrorMessage(recordError, "We couldn't start view-as mode.") };
  }

  const home = target.account_type === "creator" ? "/creator" : "/company";
  const jar = await cookies();
  jar.set(IMPERSONATION_COOKIE, sealImpersonation({
    id: impId as string,
    targetUserId: userId,
    targetName: target.display_name ?? target.email,
    home,
    adminAccess: adminSession.access_token,
    adminRefresh: adminSession.refresh_token,
    expiresAt: Date.now() + IMPERSONATION_MINUTES * 60 * 1000,
  }), {
    httpOnly: true,
    secure: publicEnv.siteUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60, // outlives the 30-minute window so the banner can always offer "Exit"
  });
  await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  redirect(home);
}
