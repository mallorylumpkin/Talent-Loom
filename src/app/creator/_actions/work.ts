"use server";

import { z } from "zod";
import { getCreatorContext } from "@/lib/creator/context";
import { refreshCompleteness } from "@/lib/creator/completeness";
import { dbErrorMessage, finish, formValues, httpsUrl, optionalText, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors } from "@/lib/validation/auth";
import { readUpload } from "@/lib/uploads";

const PORTFOLIO_PATHS = ["/creator", "/creator/portfolio"];
const visibility = z.enum(["public", "approved_companies", "private"]).catch("public");

// ---------- Portfolio ---------------------------------------------------
const itemSchema = z.object({
  title: z.string().trim().min(2, "Give this a title").max(120),
  description: optionalText(1000),
  platformId: z.string().optional().transform((v) => (v && uuid.safeParse(v).success ? v : null)),
  visibility,
});

export async function addPortfolioLinkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const raw = formValues(fd);
  const parsed = itemSchema.extend({ url: httpsUrl }).safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;

  const { error } = await supabase.from("portfolio_items").insert({
    creator_id: creator.id,
    title: d.title,
    description: d.description,
    item_type: "link",
    url: d.url,
    platform_id: d.platformId,
    visibility: d.visibility,
    is_featured: fd.get("featured") === "on",
  });
  if (error) return { message: dbErrorMessage(error), values: raw };
  await refreshCompleteness(supabase, creator.id);
  return finish(fd, PORTFOLIO_PATHS, "Added to your portfolio");
}

export async function addPortfolioFileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase, creator } = await getCreatorContext();
  const raw = formValues(fd);
  const upload = readUpload(fd, "portfolio-private", viewer.id);
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success || !upload) {
    if (upload) await supabase.storage.from("portfolio-private").remove([upload.storagePath]);
    return parsed.success
      ? { message: "That upload couldn't be verified. Please try again.", values: raw }
      : { errors: fieldErrors(parsed.error), values: raw };
  }
  const d = parsed.data;

  const { error } = await supabase.from("portfolio_items").insert({
    creator_id: creator.id,
    title: d.title,
    description: d.description,
    item_type: upload.mimeType === "application/pdf" ? "pdf" : "image",
    storage_path: upload.storagePath,
    platform_id: d.platformId,
    visibility: d.visibility,
    is_featured: fd.get("featured") === "on",
  });
  if (error) {
    await supabase.storage.from("portfolio-private").remove([upload.storagePath]);
    return { message: dbErrorMessage(error), values: raw };
  }
  await refreshCompleteness(supabase, creator.id);
  return finish(fd, PORTFOLIO_PATHS, "Added to your portfolio");
}

export async function updatePortfolioItemAction(itemId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const { error } = await supabase
    .from("portfolio_items")
    .update({ visibility: visibility.parse(fd.get("visibility")), is_featured: fd.get("featured") === "on" })
    .eq("id", itemId)
    .eq("creator_id", creator.id);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, PORTFOLIO_PATHS, "Saved");
}

export async function deletePortfolioItemAction(itemId: string): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const { data: item } = await supabase
    .from("portfolio_items")
    .select("id, storage_path")
    .eq("id", itemId)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (!item) return { message: "Item not found" };
  const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
  if (error) return { message: dbErrorMessage(error) };
  if (item.storage_path) await supabase.storage.from("portfolio-private").remove([item.storage_path]);
  await refreshCompleteness(supabase, creator.id);
  return finish(null, PORTFOLIO_PATHS, "Removed");
}

// ---------- Brand partnerships -------------------------------------------
const partnershipSchema = z.object({
  brandName: z.string().trim().min(1, "Enter the brand name").max(120),
  year: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 2000 || n > new Date().getFullYear() + 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid year" });
        return z.NEVER;
      }
      return n;
    }),
  categoryId: z.string().optional().transform((v) => (v && uuid.safeParse(v).success ? v : null)),
  description: optionalText(1000),
  link: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
    .refine((v) => v === null || /^https:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v), "Enter a valid https:// link"),
  visibility,
});

export async function addPartnershipAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const raw = formValues(fd);
  const parsed = partnershipSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;
  const { error } = await supabase.from("brand_partnerships").insert({
    creator_id: creator.id,
    brand_name: d.brandName,
    year: d.year,
    category_id: d.categoryId,
    description: d.description,
    link: d.link,
    visibility: d.visibility,
  });
  if (error) return { message: dbErrorMessage(error), values: raw };
  await refreshCompleteness(supabase, creator.id);
  return finish(fd, PORTFOLIO_PATHS, "Partnership added");
}

export async function deletePartnershipAction(id: string): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const { error } = await supabase.from("brand_partnerships").delete().eq("id", id).eq("creator_id", creator.id);
  if (error) return { message: dbErrorMessage(error) };
  await refreshCompleteness(supabase, creator.id);
  return finish(null, PORTFOLIO_PATHS, "Removed");
}

// ---------- Media kit ----------------------------------------------------
export async function uploadMediaKitAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase, creator } = await getCreatorContext();
  const upload = readUpload(fd, "media-kits", viewer.id);
  if (!upload) return { message: "That upload couldn't be verified. Please try again." };

  const { data: old } = await supabase.from("media_kits").select("id, storage_path, version").eq("creator_id", creator.id);
  const version = Math.max(0, ...(old ?? []).map((k: { version: number }) => k.version)) + 1;

  if (old && old.length) {
    await supabase.from("media_kits").delete().eq("creator_id", creator.id);
  }
  const { error } = await supabase.from("media_kits").insert({
    creator_id: creator.id,
    storage_path: upload.storagePath,
    file_name: upload.fileName,
    version,
    is_current: true,
  });
  if (error) {
    await supabase.storage.from("media-kits").remove([upload.storagePath]);
    return { message: dbErrorMessage(error) };
  }
  const oldPaths = (old ?? []).map((k: { storage_path: string | null }) => k.storage_path).filter(Boolean) as string[];
  if (oldPaths.length) await supabase.storage.from("media-kits").remove(oldPaths);

  await refreshCompleteness(supabase, creator.id);
  return finish(fd, ["/creator", "/creator/media-kit"], "Media kit uploaded");
}

export async function deleteMediaKitAction(): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const { data: kits } = await supabase.from("media_kits").select("storage_path").eq("creator_id", creator.id);
  const { error } = await supabase.from("media_kits").delete().eq("creator_id", creator.id);
  if (error) return { message: dbErrorMessage(error) };
  const paths = (kits ?? []).map((k: { storage_path: string | null }) => k.storage_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("media-kits").remove(paths);
  await refreshCompleteness(supabase, creator.id);
  return finish(null, ["/creator", "/creator/media-kit"], "Media kit removed");
}
