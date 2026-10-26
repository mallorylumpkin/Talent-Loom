import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

/** The ten things that make a profile complete. Drives the dashboard checklist and completeness_pct. */
export async function getChecklist(supabase: Client, creatorId: string): Promise<ChecklistItem[]> {
  const head = { count: "exact" as const, head: true };
  const [{ data: c }, niches, accounts, snapshots, portfolio, partnerships, mediaKit] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select("display_name, handle, headline, bio, avatar_path, city, country, is_discoverable")
      .eq("id", creatorId)
      .single(),
    supabase.from("creator_niches").select("niche_id", head).eq("creator_id", creatorId),
    supabase.from("social_accounts").select("id", head).eq("creator_id", creatorId).is("deleted_at", null),
    supabase.from("analytics_snapshots").select("id, social_accounts!inner(creator_id)", head)
      .eq("social_accounts.creator_id", creatorId),
    supabase.from("portfolio_items").select("id", head).eq("creator_id", creatorId).is("deleted_at", null),
    supabase.from("brand_partnerships").select("id", head).eq("creator_id", creatorId).is("deleted_at", null),
    supabase.from("media_kits").select("id", head).eq("creator_id", creatorId).eq("is_current", true),
  ]);

  return [
    { key: "basics", label: "Add your name and handle", href: "/creator/profile", done: !!c?.display_name && !!c?.handle },
    { key: "headline", label: "Write a one-line headline", href: "/creator/profile", done: !!c?.headline },
    { key: "bio", label: "Tell companies about yourself", href: "/creator/profile", done: !!c?.bio },
    { key: "photo", label: "Upload a profile photo", href: "/creator/profile", done: !!c?.avatar_path },
    { key: "location", label: "Add your location", href: "/creator/profile", done: !!(c?.city || c?.country) },
    { key: "niches", label: "Choose your niches", href: "/creator/profile#interests", done: (niches.count ?? 0) > 0 },
    { key: "accounts", label: "Add your social accounts", href: "/creator/social-accounts", done: (accounts.count ?? 0) > 0 },
    { key: "numbers", label: "Add your audience numbers", href: "/creator/analytics", done: (snapshots.count ?? 0) > 0 },
    { key: "work", label: "Show your best work or past partnerships", href: "/creator/portfolio",
      done: (portfolio.count ?? 0) + (partnerships.count ?? 0) > 0 },
    { key: "media_kit", label: "Upload a media kit", href: "/creator/media-kit", done: (mediaKit.count ?? 0) > 0 },
  ];
}

/** Recalculate and store completeness_pct (used to rank the directory). */
export async function refreshCompleteness(supabase: Client, creatorId: string) {
  const items = await getChecklist(supabase, creatorId);
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  await supabase.from("creator_profiles").update({ completeness_pct: pct }).eq("id", creatorId);
  return { items, pct };
}
