"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

function base(accountType: string) {
  return accountType === "creator" ? "/creator/support" : "/company/support";
}

export async function openSupportAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const subject = String(fd.get("subject") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const category = String(fd.get("category") ?? "general");
  const values = { subject, body, category };
  if (subject.length < 3) return { errors: { subject: "Add a short subject" }, values };
  if (body.length < 10) return { errors: { body: "Tell us a bit more (at least 10 characters)" }, values };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("open_support_request", { p_subject: subject, p_category: category, p_body: body });
  if (error || !id) return { message: dbErrorMessage(error), values };
  revalidatePath(base(viewer.accountType));
  redirect(`${base(viewer.accountType)}/${id}`);
}

export async function replySupportAction(requestId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  if (!uuid.safeParse(requestId).success) return { message: "Request not found" };
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { errors: { body: "Write a message" } };
  if (body.length > 5000) return { errors: { body: "Keep it under 5,000 characters" }, values: { body } };
  const supabase = await createClient();
  const { error } = await supabase.from("support_messages").insert({ request_id: requestId, author_id: viewer.id, body });
  if (error) return { message: error.code === "42501" ? "This request is closed. Open a new one if you still need help." : dbErrorMessage(error), values: { body } };
  revalidatePath(`${base(viewer.accountType)}/${requestId}`);
  return { ok: true, message: "Sent" };
}
