export interface PublicAccount {
  platform: string;
  platform_key: string;
  handle: string | null;
  url: string | null;
  is_primary: boolean;
  followers: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  avg_likes: number | null;
  growth_30d_pct: number | null;
  source: "self_reported" | "admin_verified" | "api_verified" | null;
  captured_at: string | null;
  demographics: { dimension: string; bucket: string; pct: number }[] | null;
}

export interface PublicProfile {
  id: string;
  handle: string;
  display_name: string | null;
  headline: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  bio: string | null;
  location: { city: string | null; region: string | null; country: string | null } | null;
  seeking_management: boolean;
  representation_status: string;
  is_featured: boolean;
  is_discoverable: boolean;
  is_owner_preview: boolean;
  niches: string[];
  categories: string[];
  industries: string[];
  support_types: string[];
  social_accounts: PublicAccount[];
  partnerships: { brand_name: string; year: number | null; description: string | null; link: string | null; category: string | null }[];
  portfolio: {
    id: string; title: string; description: string | null; item_type: string; url: string | null;
    storage_path: string | null; is_featured: boolean; platform: string | null;
  }[];
  media_kit_path: string | null;
}

export interface DirectoryItem {
  handle: string;
  display_name: string | null;
  headline: string | null;
  avatar_path: string | null;
  location: { city: string | null; region: string | null; country: string | null } | null;
  seeking_management: boolean;
  is_featured: boolean;
  niches: string[];
  top_account: { platform: string; platform_key: string; followers: number | null; source: PublicAccount["source"] } | null;
}

export function formatLocation(loc: PublicProfile["location"], countryName: (c: string | null) => string | null): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.region, loc.country === "US" ? null : countryName(loc.country)].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
