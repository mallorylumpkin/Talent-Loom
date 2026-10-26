"use server";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors, resetPasswordSchema } from "@/lib/validation/auth";

/** Change password for any signed-in account type. */
export async function changeOwnPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireViewer();
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { errors: { password: "Choose a password you haven't used before." } };
    if (error.code === "weak_password") return { errors: { password: error.message } };
    if (error.code === "reauthentication_needed") return { message: "For security, sign out and back in, then try again." };
    return { message: "We couldn't change your password. Please try again." };
  }
  return { ok: true, message: "Password updated" };
}
