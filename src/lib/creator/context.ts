import "server-only";
import { cache } from "react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface Lookup {
  id: string;
  key: string;
  label: string;
}

export interface CreatorRow {
  id: string;
  user_id: string;
  handle: string | null;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  seeking_management: boolean;
  representation_status: "unrepresented" | "represented" | "open_to_switch";
  contact_preference: "platform_only" | "email_after_accept";
  contact_email: string | null;
  is_discoverable: boolean;
  completeness_pct: number;
  profile_views_count: number;
}

/** Signed-in creator, a user-scoped Supabase client (RLS applies) and their creator row. */
export async function getCreatorContext() {
  const viewer = await requireRole("creator", "/creator");
  const supabase = await createClient();
  const { data, error } = await supabase.from("creator_profiles").select("*").eq("user_id", viewer.id).single();
  if (error || !data) {
    throw new Error("Your creator profile could not be loaded. Please sign out and back in.");
  }
  return { viewer, supabase, creator: data as CreatorRow };
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** Admin-managed option lists (niches, categories, …). Cached per request. */
export const getLookups = cache(async (supabase: Client) => {
  const pick = (table: string) =>
    supabase.from(table).select("id, key, label").order("sort").then((r) => (r.data ?? []) as Lookup[]);
  const [niches, categories, industries, supportTypes, platforms] = await Promise.all([
    pick("niches"),
    pick("content_categories"),
    pick("industries"),
    pick("support_types"),
    pick("platforms"),
  ]);
  return { niches, categories, industries, supportTypes, platforms };
});

export async function hasConsent(supabase: Client, userId: string, type: string): Promise<boolean> {
  const { count } = await supabase
    .from("consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("consent_type", type)
    .is("revoked_at", null);
  return (count ?? 0) > 0;
}

export async function currentTermsVersion(supabase: Client): Promise<string> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "legal.terms_version").maybeSingle();
  return typeof data?.value === "string" ? data.value : "unversioned";
}

export async function grantConsent(supabase: Client, userId: string, type: string) {
  if (await hasConsent(supabase, userId, type)) return null;
  const { error } = await supabase
    .from("consents")
    .insert({ user_id: userId, consent_type: type, document_version: await currentTermsVersion(supabase) });
  return error;
}
