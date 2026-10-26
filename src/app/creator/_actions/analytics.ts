"use server";

import { z } from "zod";
import { getCreatorContext, grantConsent } from "@/lib/creator/context";
import { refreshCompleteness } from "@/lib/creator/completeness";
import { dbErrorMessage, finish, formValues, optionalDecimal, optionalInt, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { fieldErrors } from "@/lib/validation/auth";
import { readUpload } from "@/lib/uploads";
import { AGE_BUCKETS, GENDER_BUCKETS } from "@/lib/creator/demographics";

const PATHS = ["/creator", "/creator/analytics", "/creator/social-accounts"];

export async function grantDataConsentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase } = await getCreatorContext();
  if (fd.get("dataConsent") !== "on") return { errors: { dataConsent: "Please confirm to continue" } };
  const error = await grantConsent(supabase, viewer.id, "creator_data_consent");
  if (error) return { message: dbErrorMessage(error) };
  return finish(fd, PATHS, "Thanks — you can now add your numbers");
}

const snapshotSchema = z.object({
  followers: optionalInt("followers").refine((v) => v !== null, "Enter your follower count"),
  avgViews: optionalInt("average views"),
  avgLikes: optionalInt("average likes"),
  avgComments: optionalInt("average comments"),
  engagementRate: optionalDecimal("engagement rate", 0, 100),
  growth30d: optionalDecimal("30-day growth", -100, 10000),
  capturedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine((v) => v <= new Date().toISOString().slice(0, 10), "The date can't be in the future")
    .refine((v) => v >= "2005-01-01", "Choose a more recent date"),
});

/** Add or update the numbers for one account on a given date (one snapshot per day). */
export async function saveSnapshotAction(accountId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const raw = formValues(fd);
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const d = parsed.data;

  const { data: account } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("creator_id", creator.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!account) return { message: "Account not found" };

  const row = {
    followers: d.followers,
    avg_views: d.avgViews,
    avg_likes: d.avgLikes,
    avg_comments: d.avgComments,
    engagement_rate: d.engagementRate,
    growth_30d_pct: d.growth30d,
  };

  const { data: existing } = await supabase
    .from("analytics_snapshots")
    .select("id")
    .eq("social_account_id", accountId)
    .eq("captured_at", d.capturedAt)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("analytics_snapshots").update(row).eq("id", existing.id)
    : await supabase.from("analytics_snapshots").insert({ ...row, social_account_id: accountId, captured_at: d.capturedAt });

  if (error) {
    if (error.code === "42501") return { message: "Please give data consent at the top of this page first.", values: raw };
    return { message: dbErrorMessage(error), values: raw };
  }

  await refreshCompleteness(supabase, creator.id);
  return finish(fd, PATHS, existing ? "Numbers updated" : "Numbers saved");
}

/** Replace the audience demographics for a snapshot. Percentages per group can't exceed 100. */
export async function saveDemographicsAction(snapshotId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await getCreatorContext();
  if (!uuid.safeParse(snapshotId).success) return { message: "Numbers not found" };

  const rows: { snapshot_id: string; dimension: string; bucket: string; pct: number }[] = [];
  const errors: Record<string, string> = {};
  const totals: Record<string, number> = { age: 0, gender: 0, country: 0 };

  const add = (field: string, dimension: string, bucket: string) => {
    const v = String(fd.get(field) ?? "").trim();
    if (!v) return;
    const n = Number(v.replace("%", ""));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors[field] = "0–100";
      return;
    }
    if (n === 0) return;
    totals[dimension] += n;
    rows.push({ snapshot_id: snapshotId, dimension, bucket, pct: Math.round(n * 100) / 100 });
  };

  AGE_BUCKETS.forEach((b) => add(`age_${b}`, "age", b));
  GENDER_BUCKETS.forEach((b) => add(`gender_${b}`, "gender", b));
  for (let i = 1; i <= 5; i++) {
    const code = String(fd.get(`country_${i}`) ?? "");
    if (/^[A-Z]{2}$/.test(code)) add(`country_pct_${i}`, "country", code);
  }

  for (const [dim, total] of Object.entries(totals)) {
    if (total > 100.5) errors[`total_${dim}`] = `Your ${dim} percentages add up to ${Math.round(total)}%. They can't exceed 100%.`;
  }
  if (Object.keys(errors).length) {
    return { errors, values: formValues(fd), message: Object.values(errors).find((e) => e.length > 6) ?? "Check the highlighted numbers" };
  }

  const del = await supabase.from("audience_demographics").delete().eq("snapshot_id", snapshotId);
  if (del.error) return { message: dbErrorMessage(del.error) };
  if (rows.length) {
    const { error } = await supabase.from("audience_demographics").insert(rows);
    if (error) return { message: dbErrorMessage(error) };
  }
  return finish(fd, PATHS, "Audience demographics saved");
}

export async function uploadEvidenceAction(snapshotId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase, creator } = await getCreatorContext();
  const upload = readUpload(fd, "analytics-evidence", viewer.id);
  if (!upload || !uuid.safeParse(snapshotId).success) return { message: "That upload couldn't be verified. Please try again." };

  const { error } = await supabase.from("analytics_evidence").insert({
    creator_id: creator.id,
    snapshot_id: snapshotId,
    storage_path: upload.storagePath,
    file_name: upload.fileName,
    mime_type: upload.mimeType,
    size_bytes: upload.sizeBytes,
  });
  if (error) {
    await supabase.storage.from("analytics-evidence").remove([upload.storagePath]);
    return { message: dbErrorMessage(error) };
  }
  return finish(fd, PATHS, "Evidence uploaded");
}

export async function deleteEvidenceAction(evidenceId: string): Promise<FormState> {
  const { supabase, creator } = await getCreatorContext();
  const { data: row } = await supabase
    .from("analytics_evidence")
    .select("id, storage_path")
    .eq("id", evidenceId)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (!row) return { message: "File not found" };
  const { error } = await supabase.from("analytics_evidence").delete().eq("id", row.id);
  if (error) return { message: dbErrorMessage(error) };
  await supabase.storage.from("analytics-evidence").remove([row.storage_path]);
  return finish(null, PATHS, "File removed");
}

export async function requestVerificationAction(snapshotId: string): Promise<FormState> {
  const { supabase } = await getCreatorContext();
  const { error } = await supabase.rpc("request_verification", { p_snapshot_id: snapshotId });
  if (error) return { message: dbErrorMessage(error) };
  return finish(null, PATHS, "Verification requested");
}
