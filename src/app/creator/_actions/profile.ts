"use server";

import { z } from "zod";
import { getCreatorContext } from "@/lib/creator/context";
import { refreshCompleteness } from "@/lib/creator/completeness";
import { dbErrorMessage, finish, formValues, optionalText, uuids } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors } from "@/lib/validation/auth";
import { readUpload } from "@/lib/uploads";

const RESERVED_HANDLES = new Set([
  "admin", "administrator", "talentloom", "support", "help", "creator", "creators", "company", "companies",
  "login", "signup", "settings", "api", "about", "pricing", "legal", "root", "staff", "official",
]);

const basicsSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter your name").max(80),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => v.replace(/^@/, ""))
      .pipe(z.string().regex(/^[a-z0-9_.]{3,30}$/, "Use 3–30 letters, numbers, dots or underscores")),
    headline: optionalText(120),
    bio: optionalText(2000),
    city: optionalText(80),
    region: optionalText(80),
    country: z
      .string()
      .optional()
      .transform((v) => (v && /^[A-Z]{2}$/.test(v) ? v : null)),
    contactPreference: z.enum(["platform_only", "email_after_accept"]).catch("platform_only"),
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email"),
  })
  .refine((d) => d.contactPreference !== "email_after_accept" || !!d.contactEmail, {
    message: "Add the email you'd like to share",
    path: ["contactEmail"],
  });

export async function saveBasicsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase, creator } = await getCreatorContext();
  const raw = formValues(fd);
  const parsed = basicsSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;

  if (RESERVED_HANDLES.has(d.handle)) {
    return { errors: { handle: "That handle is reserved. Try another." }, values: raw };
  }

  const { error } = await supabase
    .from("creator_profiles")
    .update({
      display_name: d.displayName,
      handle: d.handle,
      headline: d.headline,
      bio: d.bio,
      city: d.city,
      region: d.region,
      country: d.country,
      contact_preference: d.contactPreference,
      contact_email: d.contactEmail,
    })
    .eq("id", creator.id);

  if (error) {
    if (error.code === "23505") return { errors: { handle: "That handle is taken. Try another." }, values: raw };
    return { message: dbErrorMessage(error), values: raw };
  }

  await supabase.from("profiles").update({ display_name: d.displayName }).eq("id", viewer.id);
  await refreshCompleteness(supabase, creator.id);
  return finish(fd, ["/creator", "/creator/profile", `/creators/${d.handle}`], "Profile saved");
}

/** Avatar / cover upload. The file is already in Storage; this records it and removes the old one. */
async function saveImage(kind: "avatar" | "cover", fd: FormData): Promise<FormState> {
  const { viewer, supabase, creator } = await getCreatorContext();
  const bucket = kind === "avatar" ? "avatars" : "covers";
  const column = kind === "avatar" ? "avatar_path" : "cover_path";
  const upload = readUpload(fd, bucket, viewer.id);
  if (!upload) return { message: "That upload couldn't be verified. Please try again." };

  const old = creator[column];
  const { error } = await supabase.from("creator_profiles").update({ [column]: upload.storagePath }).eq("id", creator.id);
  if (error) {
    await supabase.storage.from(bucket).remove([upload.storagePath]);
    return { message: dbErrorMessage(error) };
  }
  if (old) await supabase.storage.from(bucket).remove([old]);
  await refreshCompleteness(supabase, creator.id);
  return finish(fd, ["/creator", "/creator/profile"], kind === "avatar" ? "Photo updated" : "Cover updated");
}

export async function uploadAvatarAction(_prev: FormState, fd: FormData) {
  return saveImage("avatar", fd);
}
export async function uploadCoverAction(_prev: FormState, fd: FormData) {
  return saveImage("cover", fd);
}

export async function removeImageAction(kind: "avatar" | "cover"): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const column = kind === "avatar" ? "avatar_path" : "cover_path";
  const path = creator[column];
  if (!path) return { ok: true };
  const { error } = await supabase.from("creator_profiles").update({ [column]: null }).eq("id", creator.id);
  if (error) return { message: dbErrorMessage(error) };
  await supabase.storage.from(kind === "avatar" ? "avatars" : "covers").remove([path]);
  await refreshCompleteness(supabase, creator.id);
  return finish(null, ["/creator", "/creator/profile"], "Removed");
}

/** Replace a creator's selections in a join table. */
async function replaceLinks(
  supabase: Awaited<ReturnType<typeof getCreatorContext>>["supabase"],
  table: string,
  column: string,
  creatorId: string,
  ids: string[],
) {
  const del = await supabase.from(table).delete().eq("creator_id", creatorId);
  if (del.error) return del.error;
  if (ids.length === 0) return null;
  const ins = await supabase.from(table).insert(ids.map((id) => ({ creator_id: creatorId, [column]: id })));
  return ins.error;
}

export async function saveInterestsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const niches = uuids(fd, "niches");
  const categories = uuids(fd, "categories");
  const industries = uuids(fd, "industries");

  const errors: Record<string, string> = {};
  if (niches.length === 0) errors.niches = "Choose at least one niche";
  if (niches.length > 5) errors.niches = "Choose up to 5 niches";
  if (categories.length > 6) errors.categories = "Choose up to 6 content types";
  if (industries.length > 10) errors.industries = "Choose up to 10 industries";
  if (Object.keys(errors).length) return { errors };

  for (const [table, column, ids] of [
    ["creator_niches", "niche_id", niches],
    ["creator_categories", "category_id", categories],
    ["creator_industries", "industry_id", industries],
  ] as const) {
    const error = await replaceLinks(supabase, table, column, creator.id, [...ids]);
    if (error) return { message: dbErrorMessage(error) };
  }

  await refreshCompleteness(supabase, creator.id);
  return finish(fd, ["/creator", "/creator/profile"], "Niches and categories saved");
}

export async function saveGoalsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const representation = z
    .enum(["unrepresented", "represented", "open_to_switch"])
    .safeParse(fd.get("representationStatus"));
  if (!representation.success) return { errors: { representationStatus: "Choose your current situation" } };
  const supportTypes = uuids(fd, "supportTypes");

  const { error } = await supabase
    .from("creator_profiles")
    .update({ seeking_management: fd.get("seekingManagement") === "on", representation_status: representation.data })
    .eq("id", creator.id);
  if (error) return { message: dbErrorMessage(error) };

  const linkError = await replaceLinks(supabase, "creator_support_types", "support_type_id", creator.id, supportTypes);
  if (linkError) return { message: dbErrorMessage(linkError) };

  return finish(fd, ["/creator", "/creator/profile"], "Goals saved");
}
