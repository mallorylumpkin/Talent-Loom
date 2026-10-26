import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { VerificationDecision } from "@/components/admin/trust-forms";
import { getAdminContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { compactNumber, dateTime, percent, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Verification queue" };

interface Req { id: string; subject_id: string; status: string; priority: number; created_at: string; decided_at: string | null; decision_notes: string | null }
interface Snap {
  id: string; captured_at: string; followers: number | null; avg_views: number | null; avg_likes: number | null; avg_comments: number | null;
  engagement_rate: number | null; growth_30d_pct: number | null;
  social_accounts: { handle: string; url: string | null; platforms: { label: string }; creator_profiles: { id: string; display_name: string | null; handle: string | null } };
}

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const decided = view === "decided";
  const { supabase } = await getAdminContext();
  const { data: sla } = await supabase.from("platform_settings").select("value").eq("key", "verification.sla_days").maybeSingle();
  let q = supabase.from("verification_requests").select("id, subject_id, status, priority, created_at, decided_at, decision_notes")
    .eq("subject_type", "analytics").limit(50);
  q = decided ? q.neq("status", "pending").order("decided_at", { ascending: false }) : q.eq("status", "pending").order("priority", { ascending: false }).order("created_at");
  const { data: reqs } = await q;
  const requests = (reqs ?? []) as Req[];
  const ids = requests.map((r) => r.subject_id);
  const [{ data: snaps }, { data: files }] = ids.length ? await Promise.all([
    supabase.from("analytics_snapshots").select("id, captured_at, followers, avg_views, avg_likes, avg_comments, engagement_rate, growth_30d_pct, social_accounts(handle, url, platforms(label), creator_profiles(id, display_name, handle))").in("id", ids),
    supabase.from("analytics_evidence").select("id, snapshot_id, file_name, storage_path, mime_type").in("snapshot_id", ids).is("deleted_at", null),
  ]) : [{ data: [] }, { data: [] }];
  const snapBy = new Map(((snaps ?? []) as unknown as Snap[]).map((s) => [s.id, s]));
  const evidence = (files ?? []) as { id: string; snapshot_id: string; file_name: string; storage_path: string; mime_type: string }[];
  const urls = new Map<string, string>();
  if (!decided && evidence.length) {
    const { data } = await createAdminClient().storage.from("analytics-evidence").createSignedUrls(evidence.map((e) => e.storage_path), 900);
    for (const u of data ?? []) if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl);
    await supabase.rpc("admin_log", { p_action: "verification.view_evidence", p_target_type: "verification_requests", p_target_id: "queue", p_metadata: { count: evidence.length } });
  }
  const slaDays = typeof sla?.value === "number" ? sla.value : 5;
  const tab = (a: boolean) => cn("rounded-full px-3.5 py-1.5 text-sm font-medium", a ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line");

  return (
    <>
      <PageHeader title="Verification queue" description={`Check screenshots against the numbers. Target: decide within ${slaDays} days. Creator Pro requests are listed first.`} />
      <nav className="mb-6 flex gap-2" aria-label="Queue view">
        <Link href="/admin/verification" className={tab(!decided)}>Pending</Link>
        <Link href="/admin/verification?view=decided" className={tab(decided)}>Recently decided</Link>
      </nav>
      {requests.length === 0 ? (
        <EmptyState icon={BadgeCheck} title={decided ? "Nothing decided yet" : "Queue is clear"} description="New requests appear here when creators upload evidence." />
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const s = snapBy.get(r.subject_id);
            const overdue = !decided && Date.now() - new Date(r.created_at).getTime() > slaDays * 86400000;
            return (
              <li key={r.id}>
                <Card>
                  <CardBody className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">
                        {s?.social_accounts.platforms.label} · @{s?.social_accounts.handle}
                        {s?.social_accounts.url && <a href={s.social_accounts.url} target="_blank" rel="noopener noreferrer nofollow" className="ml-1 inline-flex text-primary"><ExternalLink className="size-3.5" aria-label="Open profile" /></a>}
                      </p>
                      <span className="text-sm text-muted">by{" "}
                        <Link href={`/admin/creators/${s?.social_accounts.creator_profiles.id}`} className="text-primary hover:underline">
                          {s?.social_accounts.creator_profiles.display_name ?? s?.social_accounts.creator_profiles.handle}</Link>
                        {" "}· requested {dateTime(r.created_at)}</span>
                      {r.priority > 0 && <Badge tone="accent">Priority</Badge>}
                      {overdue && <Badge tone="danger">Overdue</Badge>}
                      {decided && <Badge tone={r.status === "verified" ? "success" : "danger"}>{r.status}</Badge>}
                    </div>
                    {s && (
                      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        {[["As of", shortDate(s.captured_at)], ["Followers", compactNumber(s.followers)], ["Engagement", percent(s.engagement_rate)],
                          ["Avg. views", compactNumber(s.avg_views)], ["Avg. likes", compactNumber(s.avg_likes)], ["Avg. comments", compactNumber(s.avg_comments)],
                          ["30-day growth", percent(s.growth_30d_pct, true)]].map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">{k}</dt><dd className="tabular font-medium text-ink">{v}</dd></div>
                        ))}
                      </dl>
                    )}
                    {!decided && (
                      <div className="flex flex-wrap gap-3">
                        {evidence.filter((e) => e.snapshot_id === r.subject_id).map((e) => (
                          urls.get(e.storage_path) ? (
                            <a key={e.id} href={urls.get(e.storage_path)} target="_blank" rel="noopener noreferrer"
                              className="group block w-40 overflow-hidden rounded-lg border border-line text-xs">
                              {e.mime_type.startsWith("image/")
                                ? <img src={urls.get(e.storage_path)} alt={e.file_name} className="h-28 w-full object-cover" />
                                : <span className="flex h-28 items-center justify-center bg-canvas"><FileText className="size-6 text-muted" aria-hidden /></span>}
                              <span className="block truncate px-2 py-1 text-primary group-hover:underline">{e.file_name}</span>
                            </a>
                          ) : null
                        ))}
                      </div>
                    )}
                    {decided ? (r.decision_notes && <p className="text-sm text-muted">Note: {r.decision_notes}</p>) : <VerificationDecision requestId={r.id} />}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
