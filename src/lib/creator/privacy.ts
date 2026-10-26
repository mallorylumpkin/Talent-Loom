export const VISIBILITY_GROUPS = [
  "bio", "location", "social_links", "follower_counts", "engagement", "growth",
  "demographics", "media_kit", "partnerships", "portfolio",
] as const;

export type VisibilityGroup = (typeof VISIBILITY_GROUPS)[number];
export type VisibilityLevel = "public" | "approved_companies" | "private";

export const VISIBILITY_LABELS: Record<VisibilityGroup, { label: string; hint: string }> = {
  bio: { label: "Bio", hint: "Your About section" },
  location: { label: "Location", hint: "City, region and country" },
  social_links: { label: "Social handles and links", hint: "Platform names are always shown" },
  follower_counts: { label: "Follower counts", hint: "Per platform" },
  engagement: { label: "Engagement", hint: "Engagement rate, average views and likes" },
  growth: { label: "Growth", hint: "30-day follower growth" },
  demographics: { label: "Audience demographics", hint: "Age, gender and top countries" },
  media_kit: { label: "Media kit", hint: "Your uploaded media kit file" },
  partnerships: { label: "Brand partnerships", hint: "Each item also has its own setting" },
  portfolio: { label: "Portfolio", hint: "Each item also has its own setting" },
};

export const LEVEL_OPTIONS: { value: VisibilityLevel; label: string; hint: string }[] = [
  { value: "public", label: "Public", hint: "Anyone, including visitors" },
  { value: "approved_companies", label: "Approved companies", hint: "Only companies TalentLoom has vetted" },
  { value: "private", label: "Only me", hint: "Hidden from everyone" },
];
