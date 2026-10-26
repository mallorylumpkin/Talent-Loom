"use server";

import { z } from "zod";
import { requireCompany } from "@/lib/company/context";
import { dbErrorMessage, finish, uuid, uuids } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";

const PATHS = ["/company", "/company/search", "/company/lists"];

function deny(): FormState {
  return { message: "Your role doesn't allow saving creators." };
}

type Ctx = Awaited<ReturnType<typeof requireCompany>>;

/** The team's default "Saved" list, created on first use. */
async function defaultList(ctx: Ctx) {
  const { supabase, company, viewer } = ctx;
  const { data: existing } = await supabase.from("talent_lists").select("id").eq("company_id", company.id)
    .eq("is_private", false).order("created_at").limit(1).maybeSingle();
  if (existing) return { id: existing.id as string };
  const { data, error } = await supabase.from("talent_lists")
    .insert({ company_id: company.id, name: "Saved", created_by: viewer.id }).select("id").single();
  return error ? { error } : { id: data.id as string };
}

export async function saveCreatorAction(creatorId: string): Promise<FormState> {
  const ctx = await requireCompany();
  if (!ctx.permissions.has("talent.manage")) return deny();
  if (!uuid.safeParse(creatorId).success) return { message: "Creator not found" };
  const list = await defaultList(ctx);
  if ("error" in list) return { message: dbErrorMessage(list.error) };
  const { error } = await ctx.supabase.from("talent_list_members")
    .insert({ list_id: list.id, creator_id: creatorId, added_by: ctx.viewer.id });
  if (error && error.code !== "23505") return { message: dbErrorMessage(error) };
  return finish(null, [...PATHS, `/company/creators/${creatorId}`], "Saved");
}

export async function unsaveCreatorAction(creatorId: string): Promise<FormState> {
  const ctx = await requireCompany();
  if (!ctx.permissions.has("talent.manage")) return deny();
  const { data: lists } = await ctx.supabase.from("talent_lists").select("id").eq("company_id", ctx.company.id);
  const ids = (lists ?? []).map((l: { id: string }) => l.id);
  if (ids.length) {
    const { error } = await ctx.supabase.from("talent_list_members").delete().in("list_id", ids).eq("creator_id", creatorId);
    if (error) return { message: dbErrorMessage(error) };
  }
  return finish(null, [...PATHS, `/company/creators/${creatorId}`], "Removed");
}

/** Set exactly which lists a creator is on (from the creator details page). */
export async function setCreatorListsAction(creatorId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  if (!ctx.permissions.has("talent.manage")) return deny();
  const wanted = new Set(uuids(fd, "lists"));
  const { data: lists } = await ctx.supabase.from("talent_lists").select("id").eq("company_id", ctx.company.id);
  const visible: string[] = (lists ?? []).map((l: { id: string }) => l.id);
  const { data: current } = await ctx.supabase.from("talent_list_members").select("list_id")
    .in("list_id", visible.length ? visible : ["00000000-0000-0000-0000-000000000000"]).eq("creator_id", creatorId);
  const have = new Set<string>((current ?? []).map((m: { list_id: string }) => m.list_id));

  const toRemove = [...have].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !have.has(id) && visible.includes(id));
  if (toRemove.length) {
    await ctx.supabase.from("talent_list_members").delete().in("list_id", toRemove).eq("creator_id", creatorId);
  }
  for (const listId of toAdd) {
    const { error } = await ctx.supabase.from("talent_list_members")
      .insert({ list_id: listId, creator_id: creatorId, added_by: ctx.viewer.id });
    if (error) return { message: dbErrorMessage(error) };
  }
  return finish(null, [...PATHS, `/company/creators/${creatorId}`], "Lists updated");
}

const listSchema = z.object({ name: z.string().trim().min(1, "Name your list").max(80) });

export async function createListAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  if (!ctx.permissions.has("talent.manage")) return deny();
  const parsed = listSchema.safeParse({ name: fd.get("name") });
  if (!parsed.success) return { errors: { name: "Name your list" } };
  const { error } = await ctx.supabase.from("talent_lists").insert({
    company_id: ctx.company.id, name: parsed.data.name, created_by: ctx.viewer.id, is_private: fd.get("isPrivate") === "on",
  });
  if (error) {
    if (error.code === "42501") return { message: "Private lists are part of Management Agency Pro." };
    return { message: dbErrorMessage(error) };
  }
  return finish(null, ["/company/lists"], "List created");
}

export async function renameListAction(listId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCompany();
  const parsed = listSchema.safeParse({ name: fd.get("name") });
  if (!parsed.success) return { errors: { name: "Name your list" } };
  const { error } = await ctx.supabase.from("talent_lists").update({ name: parsed.data.name })
    .eq("id", listId).eq("company_id", ctx.company.id);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, ["/company/lists", `/company/lists/${listId}`], "Renamed");
}

export async function deleteListAction(listId: string): Promise<FormState> {
  const ctx = await requireCompany();
  const { error } = await ctx.supabase.from("talent_lists").delete().eq("id", listId).eq("company_id", ctx.company.id);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, ["/company/lists"], "List deleted");
}

export async function removeFromListAction(listId: string, creatorId: string): Promise<FormState> {
  const ctx = await requireCompany();
  const { error } = await ctx.supabase.from("talent_list_members").delete().eq("list_id", listId).eq("creator_id", creatorId);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, [`/company/lists/${listId}`, "/company/lists"], "Removed");
}
