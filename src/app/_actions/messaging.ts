"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { REPORT_REASONS } from "@/lib/messaging/types";

function refreshMessaging(conversationId?: string) {
  for (const base of ["/creator/messages", "/company/messages"]) {
    revalidatePath(base);
    if (conversationId) revalidatePath(`${base}/${conversationId}`);
  }
}

export async function sendMessageAction(conversationId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  if (!uuid.safeParse(conversationId).success) return { message: "Conversation not found" };
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { errors: { body: "Write a message first" } };
  if (body.length > 4000) return { errors: { body: "Keep messages under 4,000 characters" }, values: { body } };

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_user_id: viewer.id, body });
  if (error) {
    // RLS refusal = the conversation is closed, blocked, or your role can't send.
    if (error.code === "42501") return { message: "You can't send messages in this conversation.", values: { body } };
    return { message: dbErrorMessage(error), values: { body } };
  }
  refreshMessaging(conversationId);
  return { ok: true };
}

export async function setArchivedAction(conversationId: string, archived: boolean): Promise<FormState> {
  const viewer = await requireViewer();
  if (!uuid.safeParse(conversationId).success) return { message: "Conversation not found" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_participants")
    .upsert(
      { conversation_id: conversationId, user_id: viewer.id, archived_at: archived ? new Date().toISOString() : null },
      { onConflict: "conversation_id,user_id" },
    );
  if (error) return { message: dbErrorMessage(error) };
  refreshMessaging(conversationId);
  return { ok: true, message: archived ? "Archived" : "Moved to inbox" };
}

const TARGETS = ["company", "conversation", "message", "creator_profile", "user"] as const;

export async function reportAction(targetType: string, targetId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  if (!(TARGETS as readonly string[]).includes(targetType) || !uuid.safeParse(targetId).success) {
    return { message: "We couldn't file that report." };
  }
  const reason = String(fd.get("reason") ?? "");
  if (!REPORT_REASONS.some((r) => r.value === reason)) return { errors: { reason: "Choose a reason" } };
  const details = String(fd.get("details") ?? "").trim().slice(0, 3000) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_reports")
    .insert({ reporter_id: viewer.id, target_type: targetType, target_id: targetId, reason, details });
  if (error) return { message: dbErrorMessage(error) };
  return { ok: true, message: "Thanks — our team will review this. You can also block them at any time." };
}

export async function markAllNotificationsReadAction(): Promise<FormState> {
  const viewer = await requireViewer();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", viewer.id).is("read_at", null);
  revalidatePath("/creator", "layout");
  revalidatePath("/company", "layout");
  return { ok: true };
}
