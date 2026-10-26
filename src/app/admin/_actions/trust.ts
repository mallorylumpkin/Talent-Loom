"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin/context";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

/* ---------- Creators ---------- */

export async function updateCreatorAdminAction(creatorId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!uuid.safeParse(creatorId).success) return { message: "Creator not found" };
  const text = (k: string, max: number) => {
    const v = String(fd.get(k) ?? "").trim();
    return v ? v.slice(0, max) : null;
  };
  const featuredUntil = String(fd.get("featuredUntil") ?? "");
  const patch: Record<string, unknown> = {
    display_name: text("displayName", 80),
    headline: text("headline", 120),
    bio: text("bio", 2000),
    is_featured: fd.get("featured") === "on",
    featured_until: fd.get("featured") === "on" && /^\d{4}-\d{2}-\d{2}$/.test(featuredUntil) ? `${featuredUntil}T23:59:59Z` : null,
  };
  // Admins can hide a profile, but only the creator can make it discoverable (it needs their consent).
  if (fd.get("hide") === "on") patch.is_discoverable = false;

  const { error } = await supabase.from("creator_profiles").update(patch).eq("id", creatorId);
  if (error) return { message: dbErrorMessage(error) };
  await supabase.rpc("admin_log", { p_action: "creators.edit", p_target_type: "creator_profiles", p_target_id: creatorId,
    p_metadata: { fields: Object.keys(patch) } });
  revalidatePath(`/admin/creators/${creatorId}`);
  revalidatePath("/admin/creators");
  revalidatePath("/creators");
  return { ok: true, message: "Saved" };
}

/* ---------- Verification ---------- */

export async function reviewVerificationAction(requestId: string, approve: boolean, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!uuid.safeParse(requestId).success) return { message: "Request not found" };
  const note = String(fd.get("note") ?? "").trim();
  const { error } = await supabase.rpc("admin_review_verification", { p_request_id: requestId, p_approve: approve, p_note: note || null });
  if (error) return { message: dbErrorMessage(error), values: { note } };
  revalidatePath("/admin/verification");
  revalidatePath("/admin");
  return { ok: true, message: approve ? "Approved — the creator has been notified." : "Rejected — the creator has been told why." };
}

/* ---------- Reports ---------- */

export async function updateReportAction(reportId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  if (!uuid.safeParse(reportId).success) return { message: "Report not found" };
  const status = String(fd.get("status") ?? "");
  if (!["open", "reviewing", "actioned", "dismissed"].includes(status)) return { errors: { status: "Choose a status" } };
  const resolution = String(fd.get("resolution") ?? "").trim().slice(0, 2000) || null;
  if ((status === "actioned" || status === "dismissed") && !resolution) {
    return { errors: { resolution: "Note what you decided (internal)" } };
  }
  const closed = status === "actioned" || status === "dismissed";
  const { data: report, error } = await supabase.from("user_reports").update({
    status, resolution, reviewed_by: viewer.id, resolved_at: closed ? new Date().toISOString() : null,
  }).eq("id", reportId).select("reporter_id").single();
  if (error) return { message: dbErrorMessage(error) };
  if (closed && report?.reporter_id) {
    await supabase.rpc("admin_notify", { p_user_id: report.reporter_id, p_type: "report.reviewed",
      p_fallback_title: "We reviewed your report. Thank you for helping keep TalentLoom safe.", p_link: "/", p_vars: {} });
  }
  revalidatePath("/admin/reports");
  return { ok: true, message: "Saved" };
}

export async function freezeCompanyOutreachAction(companyId: string, frozen: boolean): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!uuid.safeParse(companyId).success) return { message: "Company not found" };
  const { error } = await supabase.from("companies").update({ outreach_frozen: frozen }).eq("id", companyId);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/companies/${companyId}`);
  return { ok: true, message: frozen ? "Outreach paused" : "Outreach resumed" };
}
