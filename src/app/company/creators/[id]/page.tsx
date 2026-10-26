import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Handshake, MapPin, MessageCircle, Send, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CreatorListsForm } from "@/components/company/forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { saveCreatorAction } from "@/app/company/_actions/talent";
import { addToRosterAction, deleteNoteAction, removeEntryAction, withdrawInquiryAction } from "@/app/company/_actions/relationships";
import {
  AddToPipelineForm, AssignSelect, NoteForm, SendInquiryForm, StageSelect,
} from "@/components/company/relationship-forms";
import { ButtonLink } from "@/components/ui/button";
import { feature, requireCompany } from "@/lib/company/context";
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/lib/messaging/types";
import { INQUIRY_TONES } from "@/lib/messaging/inquiry";
import { relativeTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { countryName } from "@/lib/countries";
import { compactNumber, percent, representationLabels, shortDate } from "@/lib/format";
import { GENDER_LABELS } from "@/lib/creator/demographics";
import { formatLocation, type PublicProfile } from "@/lib/creator/public";
import { publicStorageUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: "Creator" };

type Detail = PublicProfile & { view_level: number; saved_list_ids: string[]; completeness_pct: number };

interface Relationship {
  inquiry: { id: string; status: InquiryStatus; created_at: string; responded_at: string | null; conversation_id: string | null } | null;
  conversation: { id: string; status: string } | null;
  pipelines: { entry_id: string; pipeline_id: string; pipeline: string; stage_id: string; stage: string; assigned_to: string | null }[];
  roster: { id: string; status: string; signed_at: string; contract_end: string | null } | null;
  blocked: boolean;
  reachable: boolean;
}
interface Note { id: string; body: string; visibility: "private" | "team"; created_at: string; mine: boolean; author: string | null }

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
  const { supabase, company, permissions, entitlements } = await requireCompany();

  const [{ data, error }, { data: lists }, { data: relData }, { data: notesData }, { data: pipelines }, { data: members }] = await Promise.all([
    supabase.rpc("get_creator_for_company", { p_company_id: company.id, p_creator_id: id }),
    supabase.from("talent_lists").select("id, name, is_private").eq("company_id", company.id).order("created_at"),
    supabase.rpc("creator_relationship", { p_company_id: company.id, p_creator_id: id }),
    supabase.rpc("creator_notes", { p_company_id: company.id, p_creator_id: id }),
    supabase.from("pipelines").select("id, name, is_default, pipeline_stages(id, name, position, kind)").eq("company_id", company.id)
      .order("is_default", { ascending: false }).order("created_at"),
    supabase.from("company_members").select("user_id, profiles(display_name, email)").eq("company_id", company.id).eq("status", "active"),
  ]);
  const rel = relData as Relationship | null;
  const notes = (notesData ?? []) as Note[];
  type StageRow = { id: string; name: string; position: number; kind: "open" | "signed" | "passed" };
  const kindOrder = { open: 0, signed: 1, passed: 2 } as const;
  const pipelineRows = ((pipelines ?? []) as { id: string; name: string; is_default: boolean; pipeline_stages: StageRow[] }[])
    .map((p) => ({ ...p, pipeline_stages: [...p.pipeline_stages].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.position - b.position) }));
  const memberRows = ((members ?? []) as unknown as { user_id: string; profiles: { display_name: string | null; email: string } | null }[])
    .map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? m.profiles?.email ?? "Teammate" }));
  const canAssign = feature(entitlements, "team_assignments").enabled;
  const canTeamNotes = feature(entitlements, "shared_notes").enabled;
  const hasRoster = feature(entitlements, "roster").enabled;
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
            {rel?.conversation?.status === "open" ? (
              <ButtonLink href={`/company/messages/${rel.conversation.id}`} size="sm"><MessageCircle className="size-4" aria-hidden /> Message</ButtonLink>
            ) : permissions.has("inquiries.send") && rel?.reachable && !rel.blocked && !(rel.inquiry && ["sent", "viewed"].includes(rel.inquiry.status)) ? (
              <ButtonLink href="#inquiry" size="sm"><Send className="size-4" aria-hidden /> Send inquiry</ButtonLink>
            ) : null}
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
          <Card id="inquiry" className="scroll-mt-24">
            <CardHeader title="Representation inquiry" />
            <CardBody className="space-y-4">
              {rel?.inquiry && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge tone={INQUIRY_TONES[rel.inquiry.status]}>{INQUIRY_STATUS_LABELS[rel.inquiry.status]}</Badge>
                    <span className="text-muted">sent {relativeTime(rel.inquiry.created_at)}</span>
                  </span>
                  {["sent", "viewed"].includes(rel.inquiry.status) && permissions.has("inquiries.send") && (
                    <ActionButton action={withdrawInquiryAction.bind(null, rel.inquiry.id)} tone="danger" confirm="Click again to withdraw">Withdraw</ActionButton>
                  )}
                </div>
              )}
              {rel?.conversation?.status === "open" ? (
                <ButtonLink href={`/company/messages/${rel.conversation.id}`} variant="secondary" size="sm">Open conversation</ButtonLink>
              ) : rel?.blocked ? (
                <p className="text-sm text-muted">This creator isn&apos;t accepting messages from your company.</p>
              ) : rel?.inquiry && ["sent", "viewed"].includes(rel.inquiry.status) ? (
                <p className="text-sm text-muted">Waiting for {p.display_name ?? "the creator"} to respond. You&apos;ll get a notification.</p>
              ) : !permissions.has("inquiries.send") ? (
                <p className="text-sm text-muted">Your role doesn&apos;t include sending inquiries.</p>
              ) : p.view_level === 0 ? (
                <p className="text-sm text-muted">You can send inquiries once TalentLoom approves your company.</p>
              ) : !rel?.reachable ? (
                <p className="text-sm text-muted">This creator isn&apos;t accepting inquiries right now.</p>
              ) : (
                <SendInquiryForm creatorId={p.id} firstName={(p.display_name ?? "there").split(/\s+/)[0]} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pipeline" />
            <CardBody className="space-y-4">
              {rel?.pipelines.map((e) => {
                const pl = pipelineRows.find((x) => x.id === e.pipeline_id);
                return (
                  <div key={e.entry_id} className="space-y-2 rounded-xl bg-canvas p-3">
                    <p className="text-xs font-medium text-muted">{e.pipeline}</p>
                    <StageSelect entryId={e.entry_id} stageId={e.stage_id} stages={pl?.pipeline_stages ?? []}
                      disabled={!permissions.has("pipeline.edit")} />
                    {canAssign && (
                      <AssignSelect entryId={e.entry_id} assignee={e.assigned_to} members={memberRows}
                        disabled={!permissions.has("pipeline.edit")} />
                    )}
                    {permissions.has("pipeline.edit") && (
                      <ActionButton action={removeEntryAction.bind(null, e.entry_id)} tone="danger" confirm="Click again to remove">Remove from pipeline</ActionButton>
                    )}
                  </div>
                );
              })}
              {permissions.has("pipeline.edit") && pipelineRows.some((pl) => !rel?.pipelines.some((e) => e.pipeline_id === pl.id)) && (
                <AddToPipelineForm creatorId={p.id}
                  pipelines={pipelineRows.filter((pl) => !rel?.pipelines.some((e) => e.pipeline_id === pl.id)).map((pl) => ({ id: pl.id, name: pl.name }))} />
              )}
              {rel?.roster ? (
                <p className="text-sm text-success-strong">On your roster{rel.roster.status === "ended" ? " (ended)" : ""} · <Link href="/company/roster" className="underline">View roster</Link></p>
              ) : hasRoster && permissions.has("roster.manage") ? (
                <ActionButton action={addToRosterAction.bind(null, p.id)} tone="primary">Add to signed roster</ActionButton>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Internal notes" description="Only your company sees these." />
            <CardBody className="space-y-4">
              {permissions.has("notes.write") && <NoteForm creatorId={p.id} allowTeam={canTeamNotes} />}
              {notes.length > 0 && (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-xl border border-line p-3 text-sm">
                      <p className="whitespace-pre-wrap text-ink">{n.body}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {n.author ?? "Teammate"} · {relativeTime(n.created_at)} · {n.visibility === "team" ? "Team" : "Only you"}
                        {n.mine && <ActionButton action={deleteNoteAction.bind(null, n.id, p.id)} tone="danger" confirm="Delete?">Delete</ActionButton>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-sm text-muted">Profile {p.completeness_pct}% complete.</CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
