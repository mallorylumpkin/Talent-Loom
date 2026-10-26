"use server";

import { z } from "zod";
import { requireCompany } from "@/lib/company/context";
import { createCompanyUser, createSetupLink, lastSignIns } from "@/lib/auth/company-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorMessage, finish, formValues, optionalText, uuid, uuids } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors } from "@/lib/validation/auth";
import { readUpload } from "@/lib/uploads";

function deny(): FormState {
  return { message: "Your role doesn't allow this. Ask your company owner." };
}

// ---------- Profile ---------------------------------------------------------
const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120),
  description: optionalText(3000),
  servicesDescription: optionalText(3000),
  website: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
    .refine((v) => v === null || /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v), "Enter a valid website"),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  city: optionalText(80),
  region: optionalText(80),
  country: z.string().optional().transform((v) => (v && /^[A-Z]{2}$/.test(v) ? v : null)),
  sizeBand: z.enum(["1", "2-5", "6-15", "16-50", "51-200", "200+"]).optional().catch(undefined),
  specialties: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12).map((s) => s.slice(0, 40))),
});

export async function saveCompanyProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("company.edit")) return deny();
  const raw = formValues(fd);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;

  const { error } = await supabase.from("companies").update({
    name: d.name,
    description: d.description,
    services_description: d.servicesDescription,
    website: d.website,
    contact_email: d.contactEmail,
    city: d.city,
    region: d.region,
    country: d.country,
    size_band: d.sizeBand ?? null,
    specialties: d.specialties,
  }).eq("id", company.id);
  if (error) return { message: dbErrorMessage(error), values: raw };

  const categories = uuids(fd, "categories").slice(0, 12);
  await supabase.from("company_categories").delete().eq("company_id", company.id);
  if (categories.length) {
    await supabase.from("company_categories").insert(categories.map((id) => ({ company_id: company.id, category_id: id })));
  }
  return finish(fd, ["/company", "/company/profile"], "Company profile saved");
}

export async function uploadLogoAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("company.edit")) return deny();
  const upload = readUpload(fd, "company-logos", company.id);
  if (!upload) return { message: "That upload couldn't be verified. Please try again." };
  const old = company.logo_path;
  const { error } = await supabase.from("companies").update({ logo_path: upload.storagePath }).eq("id", company.id);
  if (error) {
    await supabase.storage.from("company-logos").remove([upload.storagePath]);
    return { message: dbErrorMessage(error) };
  }
  if (old) await supabase.storage.from("company-logos").remove([old]);
  return finish(fd, ["/company", "/company/profile"], "Logo updated");
}

export async function submitForReviewAction(): Promise<FormState> {
  const { supabase, company } = await requireCompany();
  const { error } = await supabase.rpc("submit_company_for_review", { p_company_id: company.id });
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, ["/company", "/company/profile"], "Submitted for review");
}

// ---------- Team ------------------------------------------------------------
const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  roleId: uuid,
});

export async function inviteMemberAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("team.manage")) return deny();
  const raw = formValues(fd);
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;

  // Check the seat limit before creating an account (the database checks again).
  const [{ count }, { data: ent }] = await Promise.all([
    supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "active"),
    supabase.rpc("my_entitlements", { p_company_id: company.id }),
  ]);
  const seats = (ent as { feature_key: string; limit_value: number | null }[] | null)?.find((e) => e.feature_key === "seats.max")?.limit_value;
  if (seats != null && (count ?? 0) >= seats) {
    return { message: `Your plan includes ${seats} seat${seats === 1 ? "" : "s"}. Contact TalentLoom to add more.`, values: raw };
  }

  const user = await createCompanyUser(d.email, d.name);
  if (!user.ok) return { message: user.message, values: raw };

  // Membership is inserted as YOU, so the database checks your permission and role rules.
  const { error } = await supabase.from("company_members").insert({ company_id: company.id, user_id: user.userId, role_id: d.roleId });
  if (error) {
    await createAdminClient().auth.admin.deleteUser(user.userId); // don't leave an orphan account behind
    return { message: dbErrorMessage(error), values: raw };
  }

  const link = await createSetupLink(d.email);
  finish(null, ["/company/team"]);
  return { ok: true, message: `${d.name} was added. Send them this one-time link to set their password.`, data: { setupLink: link ?? "" } };
}

export async function changeMemberRoleAction(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("team.manage")) return deny();
  const roleId = uuid.safeParse(fd.get("roleId"));
  if (!roleId.success) return { message: "Choose a role" };
  const { error } = await supabase.from("company_members").update({ role_id: roleId.data })
    .eq("company_id", company.id).eq("user_id", userId);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, ["/company/team"], "Role updated");
}

export async function removeMemberAction(userId: string): Promise<FormState> {
  const { supabase, company, permissions } = await requireCompany();
  if (!permissions.has("team.manage")) return deny();
  const { error } = await supabase.from("company_members").update({ status: "removed" })
    .eq("company_id", company.id).eq("user_id", userId);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, ["/company/team"], "Removed from your team");
}

export async function memberSetupLinkAction(userId: string): Promise<FormState> {
  const { supabase, company, permissions, role } = await requireCompany();
  if (!permissions.has("team.manage")) return deny();
  const { data } = await supabase.from("company_members").select("profiles(email), company_roles(key)")
    .eq("company_id", company.id).eq("user_id", userId).eq("status", "active").maybeSingle();
  const email = (data?.profiles as { email?: string } | null)?.email;
  if (!email) return { message: "Member not found" };
  if ((data?.company_roles as { key?: string } | null)?.key === "owner" && role.key !== "owner") return deny();
  // Setup links sign someone in, so only issue them for accounts that have never been used.
  const signedIn = (await lastSignIns([userId])).get(userId);
  if (signedIn) return { message: "This teammate already set up their account. They can use “Forgot password” on the sign-in page." };
  const link = await createSetupLink(email);
  return link ? { ok: true, data: { setupLink: link } } : { message: "Couldn't create a link" };
}
