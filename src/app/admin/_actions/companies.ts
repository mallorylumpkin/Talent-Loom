"use server";

import { z } from "zod";
import { getAdminContext } from "@/lib/admin/context";
import { createCompanyUser, createSetupLink } from "@/lib/auth/company-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorMessage, finish, formValues, optionalText, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors } from "@/lib/validation/auth";

type Client = Awaited<ReturnType<typeof getAdminContext>>["supabase"];

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "company";
}

async function uniqueSlug(supabase: Client, name: string) {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { count } = await supabase.from("companies").select("id", { count: "exact", head: true }).eq("slug", slug);
    if (!count) return slug.length >= 3 ? slug : `${slug}-co`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function roleId(supabase: Client, key: string) {
  const { data } = await supabase.from("company_roles").select("id").is("company_id", null).eq("key", key).single();
  return data?.id as string | undefined;
}

/** Give a company a plan (complimentary until Stripe billing arrives in Phase 6). */
async function assignPlan(supabase: Client, companyId: string, planKey: string, compExpires: string | null) {
  const { data: plan } = await supabase.from("plans").select("id").eq("key", planKey).eq("audience", "company").single();
  if (!plan) return { message: "Choose a plan" };
  await supabase
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("owner_type", "company")
    .eq("owner_id", companyId)
    .in("status", ["active", "trialing", "complimentary"]);
  const { error } = await supabase.from("subscriptions").insert({
    owner_type: "company",
    owner_id: companyId,
    plan_id: plan.id,
    status: "complimentary",
    collection_method: "none",
    is_complimentary: true,
    comp_expires_at: compExpires ? new Date(`${compExpires}T23:59:59Z`).toISOString() : null,
  });
  return error ? { message: dbErrorMessage(error) } : null;
}

async function notifyMembers(supabase: Client, companyId: string, type: string, title: string, _body?: string) {
  const { data: members } = await supabase
    .from("company_members").select("user_id").eq("company_id", companyId).eq("status", "active");
  // Goes through the editable notification templates (Admin → Settings).
  for (const m of (members ?? []) as { user_id: string }[]) {
    await supabase.rpc("admin_notify", { p_user_id: m.user_id, p_type: type, p_fallback_title: title, p_link: "/company", p_vars: {} });
  }
}

// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120),
  website: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null)),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  city: optionalText(80),
  region: optionalText(80),
  country: z.string().optional().transform((v) => (v && /^[A-Z]{2}$/.test(v) ? v : null)),
  sizeBand: z.enum(["1", "2-5", "6-15", "16-50", "51-200", "200+"]).optional().catch(undefined),
  planKey: z.string().min(1, "Choose a plan"),
  compExpires: z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  status: z.enum(["approved", "draft"]),
  ownerName: z.string().trim().min(2, "Enter the owner's name").max(80),
  ownerEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  leadId: z.string().optional(),
});

export async function createCompanyAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const raw = formValues(fd);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;

  // 1. Company
  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      name: d.name,
      slug: await uniqueSlug(supabase, d.name),
      website: d.website,
      contact_email: d.contactEmail,
      city: d.city,
      region: d.region,
      country: d.country,
      size_band: d.sizeBand ?? null,
      status: d.status,
      approved_at: d.status === "approved" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !company) return { message: dbErrorMessage(error), values: raw };

  // 2. Plan
  const planError = await assignPlan(supabase, company.id, d.planKey, d.compExpires);
  if (planError) return { message: `Company created, but the plan wasn't set: ${planError.message}`, values: raw };

  // 3. Lead → converted
  if (d.leadId && uuid.safeParse(d.leadId).success) {
    await supabase.from("company_leads").update({ status: "converted", converted_company_id: company.id }).eq("id", d.leadId);
  }

  // 4. Owner account + membership + setup link
  const owner = await createCompanyUser(d.ownerEmail, d.ownerName);
  if (!owner.ok) {
    return {
      ok: false,
      message: `Company created. ${owner.message} Add the owner from the company page.`,
      data: { companyId: company.id },
    };
  }
  const ownerRole = await roleId(supabase, "owner");
  const { error: memberError } = await supabase
    .from("company_members")
    .insert({ company_id: company.id, user_id: owner.userId, role_id: ownerRole });
  if (memberError) return { message: dbErrorMessage(memberError), data: { companyId: company.id } };

  const link = await createSetupLink(d.ownerEmail);
  finish(null, ["/admin", "/admin/companies", "/admin/leads"]);
  return {
    ok: true,
    message: `${d.name} is set up. Send ${d.ownerName} this link to choose a password and sign in.`,
    data: { companyId: company.id, setupLink: link ?? "" },
  };
}

// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  decision: z.enum(["approve", "request_info", "reject", "suspend", "reactivate"]),
  message: optionalText(2000),
});

export async function reviewCompanyAction(companyId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase } = await getAdminContext();
  const parsed = reviewSchema.safeParse(formValues(fd));
  if (!parsed.success) return { message: "Choose a decision" };
  const { decision, message } = parsed.data;
  if ((decision === "request_info" || decision === "reject") && !message) {
    return { errors: { message: "Add a short note so the company knows what to do next" } };
  }

  const status = {
    approve: "approved", request_info: "info_requested", reject: "rejected", suspend: "suspended", reactivate: "approved",
  }[decision];

  const { error } = await supabase
    .from("companies")
    .update({ status, ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}) })
    .eq("id", companyId);
  if (error) return { message: dbErrorMessage(error) };

  await supabase.from("company_applications").insert({
    company_id: companyId,
    status,
    info_request_message: decision === "request_info" ? message : null,
    admin_notes: message,
    reviewed_by: viewer.id,
    reviewed_at: new Date().toISOString(),
    payload: { decision },
  });

  const copy: Record<string, [string, string]> = {
    approve: ["company.approved", "Your company has been approved. You can now contact creators."],
    reactivate: ["company.approved", "Your company has been reactivated."],
    request_info: ["company.info_requested", "TalentLoom needs more information to review your company."],
    reject: ["company.rejected", "Your company application was not approved."],
    suspend: ["account.suspended", "Your company has been suspended. Contact support for details."],
  };
  const [type, title] = copy[decision];
  await notifyMembers(supabase, companyId, type, title, message ?? undefined);

  return finish(null, ["/admin", "/admin/companies", `/admin/companies/${companyId}`], "Decision saved");
}

export async function setCompanyPlanAction(companyId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const planKey = String(fd.get("planKey") ?? "");
  const compExpires = String(fd.get("compExpires") ?? "");
  const err = await assignPlan(supabase, companyId, planKey, /^\d{4}-\d{2}-\d{2}$/.test(compExpires) ? compExpires : null);
  if (err) return err;
  await notifyMembers(supabase, companyId, "subscription.updated", "Your TalentLoom plan has been updated.");
  return finish(null, [`/admin/companies/${companyId}`], "Plan updated");
}

export async function setCompanyFlagsAction(companyId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const { error } = await supabase
    .from("companies")
    .update({
      is_verified_badge: fd.get("verifiedBadge") === "on",
      outreach_frozen: fd.get("outreachFrozen") === "on",
      is_featured: fd.get("featured") === "on",
    })
    .eq("id", companyId);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, [`/admin/companies/${companyId}`], "Saved");
}

const memberSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["owner", "admin", "recruiter", "viewer"]),
});

export async function adminAddMemberAction(companyId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const raw = formValues(fd);
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;

  const user = await createCompanyUser(d.email, d.name);
  if (!user.ok) return { message: user.message, values: raw };
  const { error } = await supabase
    .from("company_members")
    .insert({ company_id: companyId, user_id: user.userId, role_id: await roleId(supabase, d.role) });
  if (error) return { message: dbErrorMessage(error), values: raw };

  const link = await createSetupLink(d.email);
  finish(null, [`/admin/companies/${companyId}`]);
  return { ok: true, message: `Added ${d.name}. Send them this setup link.`, data: { setupLink: link ?? "" } };
}

/** New one-time link for someone who hasn't set a password yet (or forgot it). */
export async function adminSetupLinkAction(companyId: string, userId: string): Promise<FormState> {
  const { viewer, supabase } = await getAdminContext();
  const { data: member } = await supabase
    .from("company_members").select("user_id, profiles(email)").eq("company_id", companyId).eq("user_id", userId).single();
  const email = (member?.profiles as { email?: string } | null)?.email;
  if (!email) return { message: "Member not found" };
  const link = await createSetupLink(email);
  if (!link) return { message: "Couldn't create a link" };
  // A setup link can sign someone in, so every one an admin issues is recorded.
  await createAdminClient().from("audit_logs").insert({
    actor_id: viewer.id, actor_email: viewer.email, action: "admin.setup_link_issued",
    target_type: "profile", target_id: userId, metadata: { company_id: companyId },
  });
  return { ok: true, message: "New setup link created", data: { setupLink: link } };
}

// ---------------------------------------------------------------------------

export async function updateLeadAction(leadId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getAdminContext();
  const status = z.enum(["new", "contacted", "qualified", "converted", "declined"]).safeParse(fd.get("status"));
  if (!status.success) return { message: "Choose a status" };
  const notes = String(fd.get("adminNotes") ?? "").trim().slice(0, 3000) || null;
  const { error } = await supabase.from("company_leads").update({ status: status.data, admin_notes: notes }).eq("id", leadId);
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, ["/admin/leads", "/admin"], "Lead updated");
}
