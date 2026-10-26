"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/company/context";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

function refresh(creatorId?: string) {
  for (const p of ["/company", "/company/inquiries", "/company/pipeline", "/company/roster", "/company/messages"]) revalidatePath(p);
  if (creatorId) revalidatePath(`/company/creators/${creatorId}`);
}

function noPermission(what: string): FormState {
  return { message: `Your role doesn't allow ${what}. Ask your company owner.` };
}

/* ---------- Inquiries ---------- */

export async function sendInquiryAction(creatorId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("inquiries.send")) return noPermission("sending inquiries");
  if (!uuid.safeParse(creatorId).success) return { message: "Creator not found" };
  const subject = String(fd.get("subject") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const values = { subject, body };
  if (subject.length < 3 || subject.length > 120) return { errors: { subject: "Add a subject (3–120 characters)" }, values };
  if (body.length < 20) return { errors: { body: "Write at least 20 characters so they know why you're reaching out" }, values };
  if (body.length > 4000) return { errors: { body: "Keep it under 4,000 characters" }, values };

  const { error } = await supabase.rpc("send_inquiry", {
    p_company_id: company.id, p_creator_id: creatorId, p_subject: subject, p_body: body,
  });
  if (error) return { message: dbErrorMessage(error), values };
  refresh(creatorId);
  return { ok: true, message: "Inquiry sent. You'll be notified when they respond." };
}

export async function withdrawInquiryAction(inquiryId: string): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("inquiries.send")) return noPermission("withdrawing inquiries");
  if (!uuid.safeParse(inquiryId).success) return { message: "Inquiry not found" };
  const { error } = await supabase.rpc("withdraw_inquiry", { p_inquiry_id: inquiryId });
  if (error) return { message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Inquiry withdrawn" };
}

/* ---------- Pipeline ---------- */

export async function addToPipelineAction(creatorId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("pipeline.edit")) return noPermission("editing the pipeline");
  const pipelineId = String(fd.get("pipelineId") ?? "");
  if (!uuid.safeParse(creatorId).success || !uuid.safeParse(pipelineId).success) return { message: "Choose a pipeline" };
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, pipelines!inner(company_id)")
    .eq("pipeline_id", pipelineId)
    .eq("pipelines.company_id", company.id)
    .eq("kind", "open")
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!stage) return { message: "That pipeline has no open stages yet." };
  const { error } = await supabase.from("pipeline_entries").insert({ pipeline_id: pipelineId, creator_id: creatorId, stage_id: stage.id });
  if (error) return { message: error.code === "23505" ? "Already in that pipeline." : dbErrorMessage(error) };
  refresh(creatorId);
  return { ok: true, message: "Added to pipeline" };
}

export async function moveEntryAction(entryId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("pipeline.edit")) return noPermission("editing the pipeline");
  const stageId = String(fd.get("stageId") ?? "");
  if (!uuid.safeParse(entryId).success || !uuid.safeParse(stageId).success) return { message: "Choose a stage" };
  const { data, error } = await supabase.from("pipeline_entries").update({ stage_id: stageId }).eq("id", entryId).select("creator_id").maybeSingle();
  if (error || !data) return { message: dbErrorMessage(error, "Couldn't move this creator.") };
  refresh(data.creator_id as string);
  return { ok: true, message: "Moved" };
}

export async function assignEntryAction(entryId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("pipeline.edit")) return noPermission("assigning creators");
  const assignee = String(fd.get("assignee") ?? "");
  if (!uuid.safeParse(entryId).success || (assignee && !uuid.safeParse(assignee).success)) return { message: "Choose a teammate" };
  const { data, error } = await supabase.from("pipeline_entries").update({ assigned_to: assignee || null })
    .eq("id", entryId).select("creator_id").maybeSingle();
  if (error || !data) return { message: dbErrorMessage(error, "Couldn't assign this creator.") };
  refresh(data.creator_id as string);
  return { ok: true, message: "Assigned" };
}

export async function removeEntryAction(entryId: string): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("pipeline.edit")) return noPermission("editing the pipeline");
  if (!uuid.safeParse(entryId).success) return { message: "Not found" };
  const { error } = await supabase.from("pipeline_entries").delete().eq("id", entryId);
  if (error) return { message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Removed from pipeline" };
}

export async function createPipelineAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("pipeline.manage")) return noPermission("creating pipelines");
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) return { errors: { name: "Name your pipeline (up to 80 characters)" } };
  const { error } = await supabase.from("pipelines").insert({ company_id: company.id, name });
  if (error) return { message: dbErrorMessage(error), values: { name } };
  refresh();
  return { ok: true, message: "Pipeline created" };
}

export async function deletePipelineAction(pipelineId: string): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("pipeline.manage")) return noPermission("deleting pipelines");
  if (!uuid.safeParse(pipelineId).success) return { message: "Not found" };
  const { data, error } = await supabase.from("pipelines").delete().eq("id", pipelineId).eq("is_default", false).select("id");
  if (error || !data?.length) return { message: dbErrorMessage(error, "The main pipeline can't be deleted.") };
  refresh();
  return { ok: true, message: "Pipeline deleted" };
}

export async function addStageAction(pipelineId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("pipeline.manage")) return noPermission("editing stages");
  const name = String(fd.get("name") ?? "").trim();
  if (!uuid.safeParse(pipelineId).success) return { message: "Not found" };
  if (name.length < 1 || name.length > 40) return { errors: { name: "Name the stage (up to 40 characters)" } };
  const { data: last } = await supabase.from("pipeline_stages").select("position").eq("pipeline_id", pipelineId)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("pipeline_stages")
    .insert({ pipeline_id: pipelineId, name, position: ((last?.position as number | undefined) ?? 0) + 1, kind: "open" });
  if (error) {
    if (error.code === "42501") return { message: "Custom stages are part of the Management Agency Pro plan." };
    return { message: dbErrorMessage(error), values: { name } };
  }
  refresh();
  return { ok: true, message: "Stage added" };
}

export async function deleteStageAction(stageId: string): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("pipeline.manage")) return noPermission("editing stages");
  if (!uuid.safeParse(stageId).success) return { message: "Not found" };
  const { data, error } = await supabase.from("pipeline_stages").delete().eq("id", stageId).select("id");
  if (error?.code === "23503") return { message: "Move the creators out of this stage first." };
  if (error || !data?.length) return { message: dbErrorMessage(error, "Built-in stages can't be deleted.") };
  refresh();
  return { ok: true, message: "Stage deleted" };
}

/* ---------- Notes ---------- */

export async function addNoteAction(creatorId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, viewer, permissions } = await requireCompany();
  if (!permissions.has("notes.write")) return noPermission("writing notes");
  const body = String(fd.get("body") ?? "").trim();
  const visibility = fd.get("visibility") === "team" ? "team" : "private";
  if (!uuid.safeParse(creatorId).success) return { message: "Creator not found" };
  if (!body) return { errors: { body: "Write a note first" } };
  if (body.length > 5000) return { errors: { body: "Keep notes under 5,000 characters" }, values: { body } };
  const { error } = await supabase.from("internal_notes")
    .insert({ company_id: company.id, creator_id: creatorId, author_id: viewer.id, body, visibility });
  if (error) {
    if (error.code === "42501" && visibility === "team") {
      return { message: "Shared team notes are part of the Management Agency plan. Save it as a private note instead.", values: { body } };
    }
    return { message: dbErrorMessage(error), values: { body } };
  }
  refresh(creatorId);
  return { ok: true, message: "Note saved" };
}

export async function deleteNoteAction(noteId: string, creatorId: string): Promise<FormState> {
  const { supabase } = await requireCompany();
  if (!uuid.safeParse(noteId).success) return { message: "Not found" };
  const { error } = await supabase.from("internal_notes").delete().eq("id", noteId);
  if (error) return { message: dbErrorMessage(error) };
  refresh(creatorId);
  return { ok: true };
}

/* ---------- Roster ---------- */

export async function addToRosterAction(creatorId: string): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("roster.manage")) return noPermission("managing the roster");
  if (!uuid.safeParse(creatorId).success) return { message: "Creator not found" };
  const { error } = await supabase.from("roster_members").insert({ company_id: company.id, creator_id: creatorId });
  if (error) {
    if (error.code === "42501") return { message: "The signed-talent roster is part of the Management Agency plan." };
    if (error.code === "23505") return { message: "Already on your roster." };
    return { message: dbErrorMessage(error) };
  }
  refresh(creatorId);
  return { ok: true, message: "Added to roster" };
}

export async function updateRosterAction(rosterId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, permissions } = await requireCompany();
  if (!permissions.has("roster.manage")) return noPermission("managing the roster");
  if (!uuid.safeParse(rosterId).success) return { message: "Not found" };
  const status = fd.get("status") === "ended" ? "ended" : "active";
  const contractEnd = String(fd.get("contractEnd") ?? "");
  const signedAt = String(fd.get("signedAt") ?? "");
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 2000) || null;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (contractEnd && !date.test(contractEnd)) return { errors: { contractEnd: "Choose a date" } };
  if (signedAt && !date.test(signedAt)) return { errors: { signedAt: "Choose a date" } };
  const { error } = await supabase.from("roster_members").update({
    status, notes, contract_end: contractEnd || null, ...(signedAt ? { signed_at: signedAt } : {}),
  }).eq("id", rosterId);
  if (error) return { message: dbErrorMessage(error) };
  refresh();
  return { ok: true, message: "Saved" };
}
