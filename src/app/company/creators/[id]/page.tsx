import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText, Handshake, MapPin, Send, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CreatorListsForm } from "@/components/company/forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { saveCreatorAction } from "@/app/company/_actions/talent";
import { requireCompany } from "@/lib/company/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { countryName } from "@/lib/countries";
import { compactNumber, percent, representationLabels, shortDate } from "@/lib/format";
import { GENDER_LABELS } from "@/lib/creator/demographics";
import { formatLocation, type PublicProfile } from "@/lib/creator/public";
import { publicStorageUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: "Creator" };

type Detail = PublicProfile & { view_level: number; saved_list_ids: string[]; completeness_pct: number };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="tabular font-display font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default async function CompanyCreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, company, permissions } = await requireCompany();

  const [{ data, error }, { data: lists }] = await Promise.all([
    supabase.rpc("get_creator_for_company", { p_company_id: company.id, p_creator_id: id }),
    supabase.from("talent_lists").select("id, name, is_private").eq("company_id", company.id).order("created_at"),
  ]);
  if (error?.code === "42501") {
    return <Alert tone="warning">Your role doesn't include viewing creator profiles.</Alert>;
  }
  const p = data as Detail | null;
  if (!p) notFound();

  const filePaths = p.portfolio.map((i) => i.storage_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (filePaths.length) {
    const { data: urls } = await createAdminClient().storage.from("portfolio-private").createSignedUrls(filePaths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const avatar = publicStorageUrl("avatars", p.avatar_path);
  const location = formatLocation(p.location, countryName);
  const canSave = permissions.has("talent.manage");

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <span className="size-14 shrink-0 overflow-hidden rounded-full bg-accent-soft">
              {avatar && <img src={avatar} alt="" className="size-full object-cover" />}
            </span>
            <span>
              {p.display_name ?? p.handle}
              <span className="block font-sans text-base font-normal text-muted">
                @{p.handle}{location && <span className="ml-2 inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{location}</span>}
              </span>
            </span>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {canSave && p.saved_list_ids.length === 0 && (
              <ActionButton action={saveCreatorAction.bind(null, p.id)} tone="primary">Save creator</ActionButton>
            )}
            <span title="Representation inquiries arrive in the next build phase"
              className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-xl bg-primary/50 px-3 text-sm font-medium text-white">
              <Send className="size-4" aria-hidden /> Send inquiry (soon)
            </span>
          </div>
        }
      />

      {p.view_level === 0 && (
        <Alert tone="warning" className="mb-6">You're seeing public information only until TalentLoom approves your company.</Alert>
      )}
      {p.view_level === 1 && (
        <Alert tone="info" className="mb-6">
          Detailed analytics (engagement, growth and audience) shared with approved companies are part of the Management Agency plan.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {p.is_featured && <Badge tone="accent"><Star className="size-3" aria-hidden /> Featured</Badge>}
                {p.seeking_management && <Badge tone="accent">Seeking management</Badge>}
                <Badge>{representationLabels[p.representation_status]}</Badge>
                {p.niches.map((n) => <Badge key={n} tone="primary">{n}</Badge>)}
                {p.categories.map((c) => <Badge key={c}>{c}</Badge>)}
              </div>
              {p.headline && <p className="text-lg text-ink/90">{p.headline}</p>}
              {p.bio && <p className="leading-7 whitespace-pre-line text-ink/85">{p.bio}</p>}
              {(p.support_types.length > 0 || p.industries.length > 0) && (
                <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2 text-sm">
                  {p.support_types.length > 0 && (
                    <div><p className="font-medium text-ink">Looking for</p><p className="text-muted">{p.support_types.join(", ")}</p></div>
                  )}
                  {p.industries.length > 0 && (
                    <div><p className="font-medium text-ink">Industries of interest</p><p className="text-muted">{p.industries.join(", ")}</p></div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Platforms and analytics" description="Numbers show where they came from. Self-reported numbers haven't been independently checked." />
            <CardBody className="space-y-6">
              {p.social_accounts.map((a, idx) => (
                <div key={`${a.platform_key}-${idx}`} className="border-b border-line pb-5 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">
                      {a.platform}
                      {a.handle && (a.url
                        ? <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="ml-2 text-sm font-normal text-primary hover:underline">@{a.handle}</a>
                        : <span className="ml-2 text-sm font-normal text-muted">@{a.handle}</span>)}
                    </p>
                    {a.source && <ProvenanceBadge source={a.source} />}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Followers" value={compactNumber(a.followers)} />
                    <Stat label="Engagement" value={percent(a.engagement_rate)} />
                    <Stat label="Avg. views" value={compactNumber(a.avg_views)} />
                    <Stat label="30-day growth" value={percent(a.growth_30d_pct, true)} />
                  </dl>
                  {a.demographics && a.demographics.length > 0 && (
                    <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                      {(["age", "gender", "country"] as const).map((dim) => {
                        const rows = a.demographics!.filter((d) => d.dimension === dim);
                        if (!rows.length) return null;
                        return (
                          <div key={dim}>
                            <p className="font-medium text-ink capitalize">{dim}</p>
                            {rows.slice(0, 5).map((d) => (
                              <p key={d.bucket}>
                                {dim === "gender" ? GENDER_LABELS[d.bucket] ?? d.bucket : dim === "country" ? countryName(d.bucket) : d.bucket}: {percent(d.pct)}
                              </p>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {a.captured_at && <p className="mt-2 text-xs text-muted">As of {shortDate(a.captured_at)}</p>}
                </div>
              ))}
            </CardBody>
          </Card>

          {p.portfolio.length > 0 && (
            <Card>
              <CardHeader title="Work" />
              <CardBody>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {p.portfolio.map((i) => {
                    const href = i.url ?? (i.storage_path ? signed.get(i.storage_path) : undefined);
                    return (
                      <li key={i.id} className="overflow-hidden rounded-xl border border-line">
                        {i.item_type === "image" && href
                          ? <img src={href} alt="" className="aspect-video w-full object-cover" />
                          : <div className="flex aspect-video items-center justify-center bg-canvas text-muted"><FileText className="size-8" aria-hidden /></div>}
                        <div className="p-3 text-sm">
                          {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink hover:underline">{i.title}</a>
                            : <span className="font-medium text-ink">{i.title}</span>}
                          {i.description && <p className="mt-1 text-muted">{i.description}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          )}

          {p.partnerships.length > 0 && (
            <Card>
              <CardHeader title="Brand partnerships" />
              <CardBody>
                <ul className="space-y-3">
                  {p.partnerships.map((b, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <Handshake className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      <span><span className="font-medium text-ink">{b.brand_name}</span>{b.year && <span className="text-muted"> · {b.year}</span>}
                        {b.description && <span className="block text-muted">{b.description}</span>}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {canSave && (
            <Card>
              <CardHeader title="Your lists" />
              <CardBody><CreatorListsForm creatorId={p.id} lists={lists ?? []} selected={p.saved_list_ids} /></CardBody>
            </Card>
          )}
          {p.media_kit_path && (
            <a href={`/company/creators/${p.id}/media-kit`} target="_blank" rel="noopener"
              className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-primary">
              <FileText className="size-6 text-primary" aria-hidden />
              <span className="font-medium text-ink">Open media kit</span>
            </a>
          )}
          <Card>
            <CardBody className="text-sm text-muted">
              Profile {p.completeness_pct}% complete. Notes, pipeline stages and inquiries arrive in the next build phase.
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
