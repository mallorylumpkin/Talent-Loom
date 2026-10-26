"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { homeFor, safeNext } from "@/lib/auth/session";
import type { FormState } from "@/lib/actions/types";
import {
  fieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

async function currentTermsVersion(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "legal.terms_version")
    .maybeSingle();
  return typeof data?.value === "string" ? data.value : "unversioned";
}

/** Creator sign-up. Company accounts are created by TalentLoom staff (contact sales). */
export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = signUpSchema.safeParse(raw);
  const values = { displayName: raw.displayName ?? "", email: raw.email ?? "", dateOfBirth: raw.dateOfBirth ?? "" };
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl()}/auth/confirm?next=/creator`,
      // Only the 18+ confirmation is sent — the date of birth is never stored.
      data: {
        display_name: parsed.data.displayName,
        age_18_plus: "true",
        terms_version: await currentTermsVersion(),
      },
    },
  });

  if (error) {
    // Full details go to the server log (your Terminal locally, Vercel logs in production).
    console.error("[signup] Supabase error", { code: error.code, status: error.status, message: error.message });

    if (error.code === "weak_password") {
      return { errors: { password: error.message || "Choose a stronger password." }, values };
    }
    if (error.code === "email_address_invalid") {
      return { errors: { email: "That email address can't be used. Try a different one." }, values };
    }
    if (error.code === "email_address_not_authorized") {
      return {
        message:
          "Email sending isn't set up yet. Until a custom email provider is connected in Supabase, sign-up only works for email addresses on your Supabase team.",
        values,
      };
    }
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return { message: "Too many sign-up emails were sent recently. Please wait a while and try again.", values };
    }
    const detail = process.env.NODE_ENV !== "production" ? ` (${error.code ?? error.status}: ${error.message})` : "";
    return { message: `We couldn't create your account. Please try again.${detail}`, values };
  }

  // Same response whether or not the email already exists (prevents account discovery).
  redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = signInSchema.safeParse(raw);
  const values = { email: raw.email ?? "" };
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return { message: "Please confirm your email first. Check your inbox for the link we sent.", values };
    }
    if (error?.status === 429) {
      return { message: "Too many attempts. Please wait a minute and try again.", values };
    }
    return { message: "That email and password don't match our records.", values };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, status, onboarding_completed_at")
    .eq("id", data.user.id)
    .single();

  if (profile?.status !== "active") {
    redirect("/account-suspended");
  }
  await supabase.rpc("touch_last_active");

  const home = homeFor({
    accountType: profile.account_type,
    onboardingCompletedAt: profile.onboarding_completed_at,
  });
  redirect(safeNext(parsed.data.next, home));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?signed_out=1");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: { email: String(formData.get("email") ?? "") } };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl()}/auth/confirm?next=/reset-password`,
  });

  // Always the same answer, whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { message: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      message:
        error.code === "same_password"
          ? "Choose a password you haven't used before."
          : "We couldn't update your password. Request a new link and try again.",
    };
  }

  // New company users arrive here from their setup link: take them straight in.
  if (formData.get("welcome") === "1") {
    const { data: profile } = await supabase
      .from("profiles").select("account_type, onboarding_completed_at").eq("id", user.id).single();
    redirect(profile ? homeFor({ accountType: profile.account_type, onboardingCompletedAt: profile.onboarding_completed_at }) : "/");
  }
  redirect("/login?reset=1");
}
