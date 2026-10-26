"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorContext } from "@/lib/creator/context";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

const PATHS = ["/creator", "/creator/inquiries", "/creator/messages", "/creator/notifications"];

export async function respondInquiryAction(inquiryId: string, accept: boolean): Promise<FormState> {
  const { supabase } = await getCreatorContext();
  if (!uuid.safeParse(inquiryId).success) return { message: "Inquiry not found" };
  const { data: conversationId, error } = await supabase.rpc("respond_to_inquiry", { p_inquiry_id: inquiryId, p_accept: accept });
  if (error) return { message: dbErrorMessage(error) };
  for (const p of PATHS) revalidatePath(p);
  revalidatePath(`/creator/inquiries/${inquiryId}`);
  if (accept && conversationId) redirect(`/creator/messages/${conversationId}`);
  return { ok: true, message: "Declined. The company has been told." };
}

export async function blockCompanyAction(companyId: string): Promise<FormState> {
  const { supabase, viewer } = await getCreatorContext();
  if (!uuid.safeParse(companyId).success) return { message: "Company not found" };
  const { error } = await supabase.from("user_blocks").insert({ blocker_user_id: viewer.id, blocked_company_id: companyId });
  if (error && error.code !== "23505") return { message: dbErrorMessage(error) };
  for (const p of PATHS) revalidatePath(p, "layout");
  return { ok: true, message: "Blocked. They can't contact you or see your conversation anymore." };
}

export async function unblockCompanyAction(companyId: string): Promise<FormState> {
  const { supabase, viewer } = await getCreatorContext();
  if (!uuid.safeParse(companyId).success) return { message: "Company not found" };
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_user_id", viewer.id).eq("blocked_company_id", companyId);
  if (error) return { message: dbErrorMessage(error) };
  for (const p of PATHS) revalidatePath(p, "layout");
  return { ok: true, message: "Unblocked" };
}
