"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors } from "@/lib/validation/auth";

const leadSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name").max(120),
  contactName: z.string().trim().min(2, "Enter your name").max(120),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid work email").max(254),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
    .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(v), "Enter a valid website"),
  phone: z.string().trim().max(40).optional(),
  teamSize: z.enum(["1", "2-5", "6-15", "16-50", "51-200", "200+"]).optional(),
  interestedPlan: z.string().max(40).optional(),
  message: z.string().trim().max(3000).optional(),
});

export async function submitLeadAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;

  // Honeypot: real people never fill the hidden "company_url" field.
  if (raw.company_url) {
    return { ok: true, message: "Thanks! Our team will be in touch within two business days." };
  }

  const parsed = leadSchema.safeParse({
    ...raw,
    teamSize: raw.teamSize || undefined,
    website: raw.website || undefined,
    phone: raw.phone || undefined,
    message: raw.message || undefined,
    interestedPlan: raw.interestedPlan || undefined,
  });
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_company_lead", {
    p_company_name: parsed.data.companyName,
    p_contact_name: parsed.data.contactName,
    p_contact_email: parsed.data.contactEmail,
    p_website: parsed.data.website ?? null,
    p_phone: parsed.data.phone ?? null,
    p_team_size: parsed.data.teamSize ?? null,
    p_categories: [],
    p_message: parsed.data.message ?? null,
    p_interested_plan: parsed.data.interestedPlan ?? null,
  });

  if (error) {
    // Rate-limit and validation messages from the database are written for humans.
    const friendly = error.code === "P0001" ? error.message : "Something went wrong. Please try again in a moment.";
    return { message: friendly, values: raw };
  }

  return { ok: true, message: "Thanks! Our team will be in touch within two business days." };
}
