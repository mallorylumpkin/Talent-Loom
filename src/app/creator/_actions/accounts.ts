"use server";

import { z } from "zod";
import { getCreatorContext, grantConsent, hasConsent } from "@/lib/creator/context";
import { refreshCompleteness } from "@/lib/creator/completeness";
import { dbErrorMessage, finish, formValues, optionalInt, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors } from "@/lib/validation/auth";
import { todayIso } from "@/lib/format";
import { disconnectAccount } from "@/lib/social/sync";

const PATHS = ["/creator", "/creator/social-accounts", "/creator/analytics", "/creator/onboarding"];

const addSchema = z.object({
  platformId: uuid.catch(""),
  handle: z
    .string()
    .trim()
    .transform((v) => v.replace(/^https?:\/\/[^/]+\//i, "").replace(/^@/, "").replace(/\/+$/, ""))
    .pipe(z.string().min(1, "Enter your handle").max(100)),
  url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
    .refine((v) => v === null || /^https:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v), "Enter a valid https:// link"),
  followers: optionalInt("followers"),
});

export async function addAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase, creator } = await getCreatorContext();
  const raw = formValues(fd);
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;
  if (!d.platformId) return { errors: { platformId: "Choose a platform" }, values: raw };

  // Numbers can only be stored with creator data consent (also enforced in the database).
  if (d.followers !== null && !(await hasConsent(supabase, viewer.id, "creator_data_consent"))) {
    if (fd.get("dataConsent") !== "on") {
      return { errors: { dataConsent: "Please confirm this to save your follower count" }, values: raw };
    }
    const consentError = await grantConsent(supabase, viewer.id, "creator_data_consent");
    if (consentError) return { message: dbErrorMessage(consentError), values: raw };
  }

  const { data: platform } = await supabase
    .from("platforms")
    .select("key, profile_url_template")
    .eq("id", d.platformId)
    .maybeSingle();
  if (!platform) return { errors: { platformId: "Choose a platform" }, values: raw };

  const url =
    d.url ?? (platform.profile_url_template ? platform.profile_url_template.replace("{handle}", encodeURIComponent(d.handle)) : null);

  const { count } = await supabase
    .from("social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creator.id)
    .is("deleted_at", null);

  const { data: account, error } = await supabase
    .from("social_accounts")
    .insert({ creator_id: creator.id, platform_id: d.platformId, handle: d.handle, url, is_primary: (count ?? 0) === 0 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { errors: { handle: "You've already added this account." }, values: raw };
    return { message: dbErrorMessage(error), values: raw };
  }

  if (d.followers !== null) {
    const { error: snapError } = await supabase
      .from("analytics_snapshots")
      .insert({ social_account_id: account.id, followers: d.followers, captured_at: todayIso() });
    if (snapError) return { message: `Account added, but the follower count wasn't saved: ${dbErrorMessage(snapError)}` };
  }

  await refreshCompleteness(supabase, creator.id);
  return finish(fd, PATHS, "Account added");
}

export async function removeAccountAction(accountId: string): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  if (!uuid.safeParse(accountId).success) return { message: "Account not found" };

  // Connected accounts: revoke access at the platform and wipe tokens first.
  const { data: owned } = await supabase
    .from("social_accounts")
    .select("id, connection_type")
    .eq("id", accountId)
    .eq("creator_id", creator.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!owned) return { message: "Account not found" };
  if (owned.connection_type === "oauth") {
    await disconnectAccount(owned.id).catch((e) => console.error("[accounts:disconnect]", e));
  }

  const { data: removed, error } = await supabase
    .from("social_accounts")
    .update({ deleted_at: new Date().toISOString(), is_primary: false })
    .eq("id", accountId)
    .eq("creator_id", creator.id)
    .select("id")
    .maybeSingle();
  if (error || !removed) return { message: dbErrorMessage(error, "Account not found") };

  // Make sure one remaining account is primary.
  const { data: remaining } = await supabase
    .from("social_accounts")
    .select("id, is_primary")
    .eq("creator_id", creator.id)
    .is("deleted_at", null)
    .order("created_at");
  if (remaining && remaining.length > 0 && !remaining.some((a: { is_primary: boolean }) => a.is_primary)) {
    await supabase.from("social_accounts").update({ is_primary: true }).eq("id", remaining[0].id);
  }

  await refreshCompleteness(supabase, creator.id);
  return finish(null, PATHS, "Account removed");
}

export async function setPrimaryAccountAction(accountId: string): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  if (!uuid.safeParse(accountId).success) return { message: "Account not found" };
  await supabase.from("social_accounts").update({ is_primary: false }).eq("creator_id", creator.id);
  const { error } = await supabase
    .from("social_accounts")
    .update({ is_primary: true })
    .eq("id", accountId)
    .eq("creator_id", creator.id);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, PATHS, "Primary account updated");
}
