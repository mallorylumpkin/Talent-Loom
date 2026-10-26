import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, ExternalLink, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/creator/section";
import { AddAccountForm } from "@/components/creator/account-forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { removeAccountAction, setPrimaryAccountAction } from "@/app/creator/_actions/accounts";
import { getCreatorContext, getLookups, hasConsent } from "@/lib/creator/context";
import { compactNumber, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Social accounts" };

interface AccountWithLatest {
  id: string;
  handle: string;
  url: string | null;
  is_primary: boolean;
  platforms: { label: string; key: string };
  analytics_snapshots: {
    id: string; followers: number | null; source: "self_reported" | "admin_verified" | "api_verified";
    verification_status: string; captured_at: string;
  }[];
}

export default async function SocialAccountsPage() {
  const { viewer, supabase, creator } = await getCreatorContext();
  const [{ platforms }, consent, { data: accounts }, { data: limits }] = await Promise.all([
    getLookups(supabase),
    hasConsent(supabase, viewer.id, "creator_data_consent"),
    supabase
      .from("social_accounts")
      .select("id, handle, url, is_primary, platforms(label, key), analytics_snapshots(id, followers, source, verification_status, captured_at)")
      .eq("creator_id", creator.id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at")
      .order("captured_at", { referencedTable: "analytics_snapshots", ascending: false })
      .limit(1, { referencedTable: "analytics_snapshots" }),
    supabase.rpc("my_entitlements"),
  ]);

  const list = (accounts ?? []) as unknown as AccountWithLatest[];
  const limit = (limits as { feature_key: string; limit_value: number | null }[] | null)
    ?.find((l) => l.feature_key === "social_accounts.max")?.limit_value;

  return (
    <>
      <PageHeader
        title="Social accounts"
        description="Add every platform you create on. Numbers you enter are labelled self-reported until verified."
      />
      <div className="space-y-6">
        <Section
          title="Your accounts"
          description={limit != null ? `${list.length} of ${limit} on your plan` : `${list.length} added`}
        >
          {list.length === 0 ? (
            <EmptyState icon={AtSign} title="Add your first platform"
              description="Start with the platform where you have the biggest or fastest-growing audience." />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((a) => {
                const latest = a.analytics_snapshots[0];
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {a.platforms.label}
                        {a.is_primary && <Badge tone="primary"><Star className="size-3" aria-hidden /> Primary</Badge>}
                      </p>
                      <p className="truncate text-sm text-muted">
                        @{a.handle}
                        {a.url && (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                            Open <ExternalLink className="size-3" aria-hidden />
                          </a>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-display text-lg font-semibold text-ink">{compactNumber(latest?.followers)}</p>
                      <p className="text-xs text-muted">{latest ? `as of ${shortDate(latest.captured_at)}` : "No numbers yet"}</p>
                    </div>
                    {latest && <ProvenanceBadge source={latest.source} />}
                    <div className="flex items-center gap-1">
                      <Link href={`/creator/analytics#${a.id}`} className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary-soft">
                        Numbers
                      </Link>
                      {!a.is_primary && (
                        <ActionButton action={setPrimaryAccountAction.bind(null, a.id)}>Make primary</ActionButton>
                      )}
                      <ActionButton action={removeAccountAction.bind(null, a.id)} tone="danger" confirm="Click again to remove">
                        Remove
                      </ActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Add an account">
          <AddAccountForm platforms={platforms} needsConsent={!consent} />
        </Section>

        <p className="text-sm text-muted">
          Official connections to Instagram, TikTok, YouTube and others — for automatically verified numbers — are planned.
          Until then, upload screenshots on the Analytics page to request admin verification.
        </p>
      </div>
    </>
  );
}
