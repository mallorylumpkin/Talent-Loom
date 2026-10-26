"use server";

import { redirect } from "next/navigation";
import { getCreatorContext } from "@/lib/creator/context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors, resetPasswordSchema } from "@/lib/validation/auth";

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getCreatorContext();
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { errors: { password: "Choose a password you haven't used before." } };
    if (error.code === "weak_password") return { errors: { password: error.message } };
    if (error.code === "reauthentication_needed") {
      return { message: "For security, sign out and back in, then change your password." };
    }
    return { message: "We couldn't change your password. Please try again." };
  }
  return { ok: true, message: "Password updated" };
}

const USER_BUCKETS = ["avatars", "covers", "portfolio-private", "portfolio-public", "media-kits", "analytics-evidence", "verification-docs", "support-attachments"];

/**
 * Permanently deletes the account and every file in the user's storage folders.
 * Database rows are removed by ON DELETE CASCADE; the audit log keeps a record.
 * (Phase 6 will also cancel any Stripe subscription here.)
 */
export async function deleteAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase } = await getCreatorContext();
  if (String(fd.get("confirm") ?? "").trim() !== "DELETE") {
    return { errors: { confirm: 'Type DELETE in capital letters to confirm' } };
  }

  const admin = createAdminClient();

  for (const bucket of USER_BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(viewer.id, { limit: 1000 });
    const paths = (files ?? []).filter((f) => f.name).map((f) => `${viewer.id}/${f.name}`);
    if (paths.length) await admin.storage.from(bucket).remove(paths);
  }

  const { error } = await admin.auth.admin.deleteUser(viewer.id);
  if (error) {
    console.error("[delete-account]", error);
    return { message: "We couldn't delete your account. Please contact support." };
  }

  await supabase.auth.signOut().catch(() => undefined);
  redirect("/?account_deleted=1");
}
