"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext, TAXONOMY_TABLES } from "@/lib/admin/context";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

/* ---------- Taxonomy (niches, categories, industries, support types, platforms) ---------- */

type TaxTable = (typeof TAXONOMY_TABLES)[number];
const isTable = (t: string): t is TaxTable => (TAXONOMY_TABLES as readonly string[]).includes(t);

function keyFrom(label: string) {
  return label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export async function addTaxonomyAction(table: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!isTable(table)) return { message: "Unknown list" };
  const label = String(fd.get("label") ?? "").trim().slice(0, 60);
  if (!label) return { errors: { label: "Enter a name" } };
  const key = keyFrom(label);
  if (!key) return { errors: { label: "Use letters or numbers" }, values: { label } };
  const { data: last } = await supabase.from(table).select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
  const row: Record<string, unknown> = { key, label, sort: ((last?.sort as number | undefined) ?? 0) + 10 };
  if (table === "platforms") {
    const tpl = String(fd.get("template") ?? "").trim();
    if (tpl && !/^https:\/\/[^\s]+\{handle\}/.test(tpl)) return { errors: { template: "Use an https:// link containing {handle}" }, values: { label, template: tpl } };
    row.profile_url_template = tpl || null;
    row.icon = "link";
  }
  const { error } = await supabase.from(table).insert(row);
  if (error) return { message: error.code === "23505" ? "That one already exists." : dbErrorMessage(error), values: { label } };
  revalidatePath("/admin/taxonomy");
  return { ok: true, message: "Added" };
}

export async function updateTaxonomyAction(table: string, id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  if (!isTable(table) || !uuid.safeParse(id).success) return { message: "Not found" };
  const label = String(fd.get("label") ?? "").trim().slice(0, 60);
  const sort = Number(fd.get("sort"));
  if (!label) return { errors: { label: "Enter a name" } };
  const patch: Record<string, unknown> = { label, active: fd.get("active") === "on" };
  if (Number.isFinite(sort)) patch.sort = Math.round(sort);
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/taxonomy");
  return { ok: true, message: "Saved" };
}

/* ---------- Platform settings ---------- */

export async function updateSettingAction(key: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  const raw = String(fd.get("value") ?? "").trim();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // Friendly: plain text becomes a string.
    value = raw;
  }
  const { data: current } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
  if (!current) return { message: "Setting not found" };
  if (typeof current.value !== typeof value) {
    return { errors: { value: `This setting expects ${typeof current.value === "boolean" ? "true or false" : typeof current.value === "number" ? "a number" : "text"}` }, values: { value: raw } };
  }
  if (typeof value === "number" && (value < 0 || value > 100000)) return { errors: { value: "Choose a number between 0 and 100000" } };
  const { error } = await supabase.from("platform_settings").update({ value, updated_by: viewer.id, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved" };
}

export async function updateTemplateAction(key: string, channel: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 3 || body.length > 300) return { errors: { body: "Keep it between 3 and 300 characters" }, values: { body } };
  const { error } = await supabase.from("notification_templates")
    .update({ body, enabled: fd.get("enabled") === "on", updated_at: new Date().toISOString() })
    .eq("key", key).eq("channel", channel);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved" };
}

/* ---------- Legal pages ---------- */

export async function updateLegalAction(slug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const body = String(fd.get("body") ?? "");
  const version = String(fd.get("version") ?? "").trim().slice(0, 40);
  if (!title) return { errors: { title: "Enter a title" } };
  if (body.trim().length < 20) return { errors: { body: "The page needs content" } };
  if (!/^[\w.-]+$/.test(version)) return { errors: { version: "Use letters, numbers, dots or dashes (e.g. 2026-11)" } };
  const reviewed = fd.get("reviewed") === "on";
  const { error } = await supabase.from("legal_pages").update({
    title, body_md: body, version, requires_legal_review: !reviewed, published_at: new Date().toISOString(),
    updated_by: viewer.id, updated_at: new Date().toISOString(),
  }).eq("slug", slug);
  if (error) return { message: dbErrorMessage(error) };
  // New Terms/Privacy versions are stamped on future consents.
  if ((slug === "terms" || slug === "privacy") && fd.get("bumpTerms") === "on") {
    await supabase.from("platform_settings").update({ value: version, updated_by: viewer.id }).eq("key", "legal.terms_version");
  }
  revalidatePath("/admin/legal");
  revalidatePath(`/legal/${slug}`);
  return { ok: true, message: "Published" };
}

/* ---------- Support ---------- */

export async function adminSupportReplyAction(requestId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  if (!uuid.safeParse(requestId).success) return { message: "Not found" };
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { errors: { body: "Write a reply" } };
  if (body.length > 5000) return { errors: { body: "Keep it under 5,000 characters" }, values: { body } };
  const { error } = await supabase.from("support_messages")
    .insert({ request_id: requestId, author_id: viewer.id, body, is_internal: fd.get("internal") === "on" });
  if (error) return { message: dbErrorMessage(error), values: { body } };
  revalidatePath(`/admin/support/${requestId}`);
  revalidatePath("/admin/support");
  return { ok: true, message: fd.get("internal") === "on" ? "Internal note added" : "Reply sent" };
}

export async function adminSupportStatusAction(requestId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, viewer } = await getAdminContext();
  const status = String(fd.get("status") ?? "");
  if (!["open", "pending", "resolved", "closed"].includes(status)) return { message: "Choose a status" };
  const { error } = await supabase.from("support_requests")
    .update({ status, assigned_admin_id: fd.get("mine") === "on" ? viewer.id : undefined }).eq("id", requestId);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath(`/admin/support/${requestId}`);
  revalidatePath("/admin/support");
  return { ok: true, message: "Saved" };
}
