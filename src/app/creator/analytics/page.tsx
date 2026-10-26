import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ChartNoAxesColumn, Clock, FileText, ShieldCheck, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/creator/section";
import { DataConsentForm, DemographicsForm, EvidenceUpload, SnapshotForm } from "@/components/creator/analytics-forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { deleteEvidenceAction, requestVerificationAction } from "@/app/creator/_actions/analytics";
import { getCreatorContext, hasConsent } from "@/lib/creator/context";
import { compactNumber, fileSize, percent, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics" };

interface SnapshotRow {
  id: string; followers: number | null; avg_views: number | null; avg_likes: number | null; avg_comments: number | null;
  engagement_rate: number | null; growth_30d_pct: number | null; captured_at: string;
  source: "self_reported" | "admin_verified" | "api_verified"; verification_status: "none" | "pending" | "verified" | "rejected";
  audience_demographics: { dimension: string; bucket: string; pct: number }[];
  analytics_evidence: { id: string; file_name: string; size_bytes: number; storage_path: string; deleted_at: string | null }[];
}
interface AccountRow {
  id: string; handle: string; platforms: { label: string };
  analytics_snapshots: SnapshotRow[];
}

function VerificationStatus({ s }: { s: SnapshotRow }) {
  if (s.source !== "self_reported") return null;
  if (s.verification_status === "pending")
    return <Badge tone="warning"><Clock className="size-3.5" aria-hidden /> Verification pending</Badge>;
  if (s.verification_status === "rejected")
    return <Badge tone="danger"><XCircle className="size-3.5" aria-hidden /> Not verified — upload clearer evidence</Badge>;
  return null;
}

export default async function AnalyticsPage() {
  const { viewer, supabase, creator } = await getCreatorContext();
  const consent = await hasConsent(supabase, viewer.id, "creator_data_consent");

  const { data } = await supabase
    .from("social_accounts")
    .select(`id, handle, platforms(label),
      analytics_snapshots(id, followers, avg_views, avg_likes, avg_comments, engagement_rate, growth_30d_pct, captured_at,
        source, verification_status, audience_demographics(dimension, bucket, pct),
        analytics_evidence(id, file_name, size_bytes, storage_path, deleted_at))`)
    .eq("creator_id", creator.id)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("created_at")
    .order("captured_at", { referencedTable: "analytics_snapshots", ascending: false });
  const accounts = (data ?? []) as unknown as AccountRow[];

  // Short-lived links so you can open your own evidence files.
  const evidencePaths = accounts.flatMap((a) => a.analytics_snapshots[0]?.analytics_evidence.map((e) => e.storage_path) ?? []);
  const signed = new Map<string, string>();
  if (evidencePaths.length) {
    const { data: urls } = await supabase.storage.from("analytics-evidence").createSignedUrls(evidencePaths, 600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Add your latest numbers for each platform. Upload screenshots from the platform's own analytics to request verification."
      />

      {!consent ? (
        <Section title="Before you add numbers" description="We need your permission to store your analytics.">
          <DataConsentForm />
        </Section>
      ) : accounts.length === 0 ? (
        <EmptyState icon={ChartNoAxesColumn} title="Add a social account first"
          description="Numbers are tracked per platform."
          action={<ButtonLink href="/creator/social-accounts">Add social accounts</ButtonLink>} />
      ) : (
        <div className="space-y-6">
          <Alert tone="info" title="How verification works">
            Numbers you type are always shown as <strong>Self-reported</strong>. Upload a screenshot of your platform analytics
            (showing your handle and the numbers) and request verification. When TalentLoom confirms them, they're labelled{" "}
            <strong>Admin-verified</strong>.
          </Alert>

          {accounts.map((a) => {
            const latest = a.analytics_snapshots[0] ?? null;
            const evidence = (latest?.analytics_evidence ?? []).filter((e) => !e.deleted_at);
            return (
              <Section key={a.id} id={a.id}
                title={<span className="flex flex-wrap items-center gap-2">{a.platforms.label} <span className="font-sans text-sm font-normal text-muted">@{a.handle}</span></span>}
                description={latest ? `Latest numbers as of ${shortDate(latest.captured_at)}` : "No numbers yet"}
                action={latest ? <div className="flex flex-wrap justify-end gap-1.5"><ProvenanceBadge source={latest.source} /><VerificationStatus s={latest} /></div> : undefined}
              >
                <div className="space-y-8">
                  {latest && (
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ["Followers", compactNumber(latest.followers)],
                        ["Engagement", percent(latest.engagement_rate)],
                        ["Avg. views", compactNumber(latest.avg_views)],
                        ["30-day growth", percent(latest.growth_30d_pct, true)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-canvas px-4 py-3">
                          <dt className="text-xs text-muted">{label}</dt>
                          <dd className="tabular mt-0.5 font-display text-lg font-semibold text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <div>
                    <h3 className="mb-3 text-base font-semibold text-ink">{latest ? "Update numbers" : "Add numbers"}</h3>
                    <SnapshotForm accountId={a.id} latest={latest} />
                  </div>

                  {latest && (
                    <>
                      <div>
                        <h3 className="text-base font-semibold text-ink">Audience demographics</h3>
                        <p className="mb-3 text-sm text-muted">Percent of your audience in each group, from your platform analytics.</p>
                        <DemographicsForm snapshotId={latest.id} existing={latest.audience_demographics} />
                      </div>

                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                          <ShieldCheck className="size-4 text-success" aria-hidden /> Verification evidence
                        </h3>
                        <p className="mb-3 text-sm text-muted">Private — only you and TalentLoom staff can see these files.</p>
                        {evidence.length > 0 && (
                          <ul className="mb-4 space-y-2">
                            {evidence.map((e) => (
                              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                                {signed.get(e.storage_path) ? (
                                  <a href={signed.get(e.storage_path)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">{e.file_name}</a>
                                ) : (
                                  <span className="min-w-0 flex-1 truncate">{e.file_name}</span>
                                )}
                                <span className="text-muted">{fileSize(e.size_bytes)}</span>
                                <ActionButton action={deleteEvidenceAction.bind(null, e.id)} tone="danger" confirm="Remove?">Remove</ActionButton>
                              </li>
                            ))}
                          </ul>
                        )}
                        <EvidenceUpload snapshotId={latest.id} userId={viewer.id} />
                        {latest.source === "self_reported" && latest.verification_status !== "pending" && (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <ActionButton action={requestVerificationAction.bind(null, latest.id)} tone="primary">
                              <BadgeCheck className="size-4" aria-hidden /> Request verification
                            </ActionButton>
                            <span className="text-xs text-muted">Creator Pro members get priority review.</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Section>
            );
          })}
          <p className="text-sm text-muted">
            Need another platform? <Link href="/creator/social-accounts" className="font-medium text-primary hover:underline">Add a social account</Link>.
          </p>
        </div>
      )}
    </>
  );
}
