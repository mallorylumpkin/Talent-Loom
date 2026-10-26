import { NextResponse } from "next/server";
import { getCreatorContext } from "@/lib/creator/context";

/** Download everything TalentLoom stores about the signed-in creator, as JSON. */
export async function GET() {
  const { viewer, supabase, creator } = await getCreatorContext();
  const byCreator = (table: string) =>
    supabase.from(table).select("*").eq("creator_id", creator.id).then((r) => r.data ?? []);

  const [profile, privacy, niches, categories, industries, supportTypes, accounts, evidence, portfolio, mediaKits,
    partnerships, affiliateCodes, brandDeals, inquiries, consents] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", viewer.id).single().then((r) => r.data),
    supabase.from("creator_privacy_settings").select("*").eq("creator_id", creator.id).maybeSingle().then((r) => r.data),
    byCreator("creator_niches"), byCreator("creator_categories"), byCreator("creator_industries"),
    byCreator("creator_support_types"), byCreator("social_accounts"), byCreator("analytics_evidence"),
    byCreator("portfolio_items"), byCreator("media_kits"), byCreator("brand_partnerships"),
    byCreator("affiliate_codes"), byCreator("brand_deals"), byCreator("representation_inquiries"),
    supabase.from("consents").select("*").eq("user_id", viewer.id).then((r) => r.data ?? []),
  ]);

  const accountIds = (accounts as { id: string }[]).map((a) => a.id);
  const snapshots = accountIds.length
    ? (await supabase.from("analytics_snapshots").select("*, audience_demographics(*)").in("social_account_id", accountIds)).data ?? []
    : [];

  const body = {
    exported_at: new Date().toISOString(),
    note: "This is a copy of the data TalentLoom stores about you. Uploaded files are listed by name; download them from your dashboard.",
    account: profile,
    creator_profile: creator,
    privacy_settings: privacy,
    selections: { niches, categories, industries, support_types: supportTypes },
    social_accounts: accounts,
    analytics: snapshots,
    analytics_evidence: evidence,
    portfolio,
    media_kits: mediaKits,
    brand_partnerships: partnerships,
    affiliate_codes: affiliateCodes,
    brand_deals: brandDeals,
    representation_inquiries: inquiries,
    consents,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="talentloom-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
