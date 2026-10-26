import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PersonAvatar } from "@/components/messaging/avatar";
import { CreatorAdminForm } from "@/components/admin/trust-forms";
import { getAdminContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { compactNumber, fileSize, percent, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Creator" };

interface Snapshot { id: string; captured_at: string; followers: number | null; engagement_rate: number | null; source: "self_reported" | "admin_verified" | "api_verified"; verification_status: string }
interface Account { id: string; handle: string; url: string | null; connection_type: string; deleted_at: string | null;
  platforms: { label: string }; analytics_snapshots: Snapshot[]; social_connections: { status: string; last_synced_at: string | null } | null }

export default async function AdminCreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getAdminContext();
  const { data: c } = await supabase.from("creator_profiles").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: accounts }, { data: evidence }, { data: portfolio }, { data: kit }] = await Promise.all([
    supabase.from("social_accounts").select("id, handle, url, connection_type, deleted_at, platforms(label), social_connections(status, last_synced_at), analytics_snapshots(id, captured_at, followers, engagement_rate, source, verification_status)")
      .eq("creator_id", id).order("created_at").order("captured_at", { referencedTable: "analytics_snapshots", ascending: false })
      .limit(3, { referencedTable: "analytics_snapshots" }),
    supabase.from("analytics_evidence").select("id, file_name, size_bytes, storage_path, created_at, deleted_at").eq("creator_id", id).order("created_at", { ascending: false }),
    supabase.from("portfolio_items").select("id, title, item_type, url, storage_path, visibility, deleted_at").eq("creator_id", id).is("deleted_at", null).order("sort"),
    supabase.from("media_kits").select("storage_path, file_name").eq("creator_id", id).eq("is_current", true).maybeSingle(),
  ]);

  // Short-lived links to private files (viewing them is logged).
  const admin = createAdminClient();
  const sign = async (bucket: string, paths: string[]) => {
    const map = new Map<string, string>();
    if (!paths.length) return map;
    const { data } = await admin.storage.from(bucket).createSignedUrls(paths, 600);
    for (const u of data ?? []) if (u.path && u.signedUrl) map.set(u.path, u.signedUrl);
    return map;
  };
  const ev = (evidence ?? []).filter((e: { deleted_at: string | null }) => !e.deleted_at) as { id: string; file_name: string; size_bytes: number; storage_path: string; created_at: string }[];
  const pf = (portfolio ?? []) as { id: string; title: string; item_type: string; url: string | null; storage_path: string | null; visibility: string }[];
  const [evUrls, pfUrls, kitUrls] = await Promise.all([
    sign("analytics-evidence", ev.map((e) => e.storage_path)),
    sign("portfolio-private", pf.map((p) => p.storage_path).filter(Boolean) as string[]),
    sign("media-kits", kit?.storage_path ? [kit.storage_path] : []),
  ]);
  if (ev.length || kit?.storage_path) {
    await supabase.rpc("admin_log", { p_action: "creators.view_files", p_target_type: "creator_profiles", p_target_id: id, p_metadata: {} });
  }
  const list = (accounts ?? []) as unknown as Account[];

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3"><PersonAvatar name={c.display_name ?? c.handle ?? "?"} path={c.avatar_path} />{c.display_name ?? "(no name)"}</span>}
        description={<>{c.handle ? `@${c.handle}` : "No handle"} · <Link href={`/admin/users/${c.user_id}`} className="text-primary hover:underline">Account</Link>
          {c.is_discoverable && c.handle && <> · <Link href={`/creators/${c.handle}`} className="text-primary hover:underline" target="_blank">Public profile</Link></>}</>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={c.is_discoverable ? "success" : "neutral"}>{c.is_discoverable ? "Discoverable" : "Hidden"}</Badge>
        {c.is_featured && <Badge tone="accent">Featured{c.featured_until ? ` until ${shortDate(c.featured_until)}` : ""}</Badge>}
        <Badge>{c.completeness_pct}% complete</Badge>
        <Badge>{c.profile_views_count} company views</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Platforms & numbers" />
            <CardBody className="space-y-4">
              {list.length === 0 && <p className="text-sm text-muted">No accounts added.</p>}
              {list.map((a) => (
                <div key={a.id} className="rounded-xl border border-line p-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    {a.platforms.label} <span className="text-sm font-normal text-muted">@{a.handle}</span>
                    {a.connection_type === "oauth" && <Badge tone="success">Connected</Badge>}
                    {a.deleted_at && <Badge tone="danger">Removed</Badge>}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {a.analytics_snapshots.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2">
                        <span className="w-28 text-muted">{shortDate(s.captured_at)}</span>
                        <span className="w-24 tabular">{compactNumber(s.followers)} followers</span>
                        <span className="w-20 tabular">{percent(s.engagement_rate)}</span>
                        <ProvenanceBadge source={s.source} />
                        {s.verification_status === "pending" && <Badge tone="warning">Pending review</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Evidence files" description="Private uploads for verification" />
            <CardBody>
              {ev.length === 0 ? <p className="text-sm text-muted">None.</p> : (
                <ul className="space-y-2 text-sm">
                  {ev.map((e) => (
                    <li key={e.id} className="flex items-center gap-2">
                      <FileText className="size-4 text-muted" aria-hidden />
                      {evUrls.get(e.storage_path)
                        ? <a href={evUrls.get(e.storage_path)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">{e.file_name}</a>
                        : <span className="min-w-0 flex-1 truncate">{e.file_name}</span>}
                      <span className="text-muted">{fileSize(e.size_bytes)} · {shortDate(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Portfolio & media kit" />
            <CardBody className="space-y-2 text-sm">
              {kit?.storage_path && kitUrls.get(kit.storage_path) && (
                <a href={kitUrls.get(kit.storage_path)} target="_blank" rel="noopener noreferrer" className="block font-medium text-primary hover:underline">
                  Media kit: {kit.file_name ?? "PDF"}
                </a>
              )}
              {pf.map((p) => {
                const href = p.url ?? (p.storage_path ? pfUrls.get(p.storage_path) : undefined);
                return (
                  <p key={p.id}>
                    {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">{p.title}</a> : p.title}
                    <span className="text-muted"> · {p.item_type} · {p.visibility.replace("_", " ")}</span>
                  </p>
                );
              })}
              {!pf.length && !kit?.storage_path && <p className="text-muted">Nothing uploaded.</p>}
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="Edit profile" description="Changes are logged." />
          <CardBody><CreatorAdminForm creator={c} /></CardBody>
        </Card>
      </div>
    </>
  );
}
