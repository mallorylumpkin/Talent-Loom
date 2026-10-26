"use server";

import { revalidatePath } from "next/cache";
import { getCreatorContext } from "@/lib/creator/context";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { DEAL_STAGES } from "@/lib/creator/pro";

const text = (fd: FormData, k: string, max: number) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, max) : null;
};
const date = (fd: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(fd.get(k) ?? "")) ? String(fd.get(k)) : null);
const num = (fd: FormData, k: string, min: number, max: number) => {
  const raw = String(fd.get(k) ?? "").replace(/[$,%\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
};
const link = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
const PRO_MSG = "This is a Creator Pro tool. Upgrade on the Billing page to add or edit entries — your existing entries stay visible.";

/* ---------- Affiliate Code Vault ---------- */

export async function saveAffiliateAction(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const values = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const brand = text(fd, "brand", 120);
  if (!brand) return { errors: { brand: "Enter the brand" }, values };
  const rate = num(fd, "rate", 0, 100);
  if (Number.isNaN(rate)) return { errors: { rate: "0–100" }, values };
  const cookie = num(fd, "cookieDays", 0, 3650);
  if (Number.isNaN(cookie)) return { errors: { cookieDays: "Whole number of days" }, values };
  const expires = date(fd, "expires");
  const row = {
    brand_name: brand, product: text(fd, "product", 200), code: text(fd, "code", 80), affiliate_link: link(fd, "link"),
    network: text(fd, "network", 80), commission_rate: rate, cookie_days: cookie === null ? null : Math.round(cookie),
    starts_on: date(fd, "starts"), expires_on: expires, restrictions: text(fd, "restrictions", 1000),
    brand_contact: text(fd, "contact", 200), notes: text(fd, "notes", 3000), associated_content: text(fd, "content", 1000),
    payout_status: ["none", "pending", "paid", "disputed"].includes(String(fd.get("payout"))) ? String(fd.get("payout")) : "none",
    status: expires && expires < new Date().toISOString().slice(0, 10) ? "expired" : "active",
  };
  const { error } = id && uuid.safeParse(id).success
    ? await supabase.from("affiliate_codes").update(row).eq("id", id)
    : await supabase.from("affiliate_codes").insert({ ...row, creator_id: creator.id });
  if (error) return { message: error.code === "42501" ? PRO_MSG : dbErrorMessage(error), values };
  revalidatePath("/creator/affiliate-vault");
  return { ok: true, message: id ? "Saved" : "Added to your vault" };
}

export async function deleteAffiliateAction(id: string): Promise<FormState> {
  const { supabase } = await getCreatorContext();
  const { error } = await supabase.from("affiliate_codes").delete().eq("id", id);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/creator/affiliate-vault");
  return { ok: true };
}

/* ---------- Brand-Deal Tracker ---------- */


export async function saveDealAction(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const values = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const brand = text(fd, "brand", 120);
  if (!brand) return { errors: { brand: "Enter the brand" }, values };
  const proposed = num(fd, "proposed", 0, 10_000_000);
  const agreed = num(fd, "agreed", 0, 10_000_000);
  if (Number.isNaN(proposed)) return { errors: { proposed: "Enter dollars" }, values };
  if (Number.isNaN(agreed)) return { errors: { agreed: "Enter dollars" }, values };
  const pick = (k: string, opts: string[], d: string) => (opts.includes(String(fd.get(k))) ? String(fd.get(k)) : d);
  const deliverables = String(fd.get("deliverables") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30)
    .map((l) => ({ item: l.slice(0, 200) }));
  const row = {
    brand, contact: text(fd, "contact", 200), opportunity: text(fd, "opportunity", 300),
    stage: pick("stage", DEAL_STAGES, "lead"),
    proposed_cents: proposed === null ? null : Math.round(proposed * 100), agreed_cents: agreed === null ? null : Math.round(agreed * 100),
    deliverables, due_date: date(fd, "due"), publish_date: date(fd, "publish"), exclusivity_until: date(fd, "exclusivity"),
    approval_status: pick("approval", ["not_submitted", "submitted", "changes_requested", "approved"], "not_submitted"),
    usage_rights: text(fd, "usage", 1000),
    invoice_status: pick("invoice", ["not_sent", "sent", "overdue", "void"], "not_sent"),
    payment_status: pick("payment", ["unpaid", "partial", "paid"], "unpaid"),
    notes: text(fd, "notes", 5000),
  };
  const { error } = id && uuid.safeParse(id).success
    ? await supabase.from("brand_deals").update(row).eq("id", id)
    : await supabase.from("brand_deals").insert({ ...row, creator_id: creator.id });
  if (error) return { message: error.code === "42501" ? PRO_MSG : dbErrorMessage(error), values };
  revalidatePath("/creator/brand-deals");
  return { ok: true, message: id ? "Saved" : "Deal added" };
}

export async function deleteDealAction(id: string): Promise<FormState> {
  const { supabase } = await getCreatorContext();
  const { error } = await supabase.from("brand_deals").delete().eq("id", id);
  if (error) return { message: dbErrorMessage(error) };
  revalidatePath("/creator/brand-deals");
  return { ok: true };
}
