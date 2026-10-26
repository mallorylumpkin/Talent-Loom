import type { Metadata } from "next";
import Link from "next/link";
import { Columns3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/forms/confirm-action";
import { PersonAvatar } from "@/components/messaging/avatar";
import { AddStageForm, AssignSelect, CreatePipelineForm, StageSelect } from "@/components/company/relationship-forms";
import { deletePipelineAction, deleteStageAction } from "@/app/company/_actions/relationships";
import { feature, requireCompany } from "@/lib/company/context";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CreatorCardInfo } from "@/lib/messaging/types";

export const metadata: Metadata = { title: "Pipeline" };

interface Stage { id: string; name: string; kind: "open" | "signed" | "passed"; position: number; is_system: boolean }
interface Entry { id: string; stage_id: string; updated_at: string; assigned_to: string | null; assignee: string | null; creator: CreatorCardInfo }

const KIND_ORDER = { open: 0, signed: 1, passed: 2 } as const;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ p?: string; mine?: string }> }) {
  const sp = await searchParams;
  const { supabase, company, viewer, permissions, entitlements } = await requireCompany();
  const { data: pipelines } = await supabase.from("pipelines").select("id, name, is_default")
    .eq("company_id", company.id).order("is_default", { ascending: false }).order("created_at");
  const list = (pipelines ?? []) as { id: string; name: string; is_default: boolean }[];
  const current = list.find((p) => p.id === sp.p) ?? list[0];
  if (!current) return <EmptyState icon={Columns3} title="No pipeline yet" description="Your company's pipeline will appear here." />;

  const [{ data: board }, { data: members }] = await Promise.all([
    supabase.rpc("pipeline_board", { p_pipeline_id: current.id }),
    supabase.from("company_members").select("user_id, profiles(display_name, email)").eq("company_id", company.id).eq("status", "active"),
  ]);
  const stages = ((board as { stages: Stage[] } | null)?.stages ?? [])
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.position - b.position);
  let entries = (board as { entries: Entry[] } | null)?.entries ?? [];
  if (sp.mine === "1") entries = entries.filter((e) => e.assigned_to === viewer.id);
  const memberRows = ((members ?? []) as unknown as { user_id: string; profiles: { display_name: string | null; email: string } | null }[])
    .map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? m.profiles?.email ?? "Teammate" }));

  const canEdit = permissions.has("pipeline.edit");
  const canManage = permissions.has("pipeline.manage");
  const assignments = feature(entitlements, "team_assignments").enabled;
  const customStages = feature(entitlements, "custom_stages").enabled;
  const pipelineLimit = feature(entitlements, "pipelines.max").limit;
  const canAddPipeline = canManage && (pipelineLimit === null || list.length < pipelineLimit);
  const tab = (active: boolean) => cn("rounded-lg px-3 py-1.5 text-sm font-medium", active ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-ink/5");
  const qs = (p: string, mine?: boolean) => `/company/pipeline?p=${p}${mine ? "&mine=1" : ""}`;

  return (
    <>
      <PageHeader title="Pipeline" description="Track every creator from first look to signed. Sending an inquiry and acceptance move creators forward automatically."
        action={<ButtonLink href="/company/search" size="sm">Find creators</ButtonLink>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {list.length > 1 && list.map((p) => (
          <Link key={p.id} href={qs(p.id)} className={tab(p.id === current.id)} aria-current={p.id === current.id ? "page" : undefined}>{p.name}</Link>
        ))}
        {assignments && (
          <Link href={qs(current.id, sp.mine !== "1")} className={cn(tab(sp.mine === "1"), "ml-auto")}>
            {sp.mine === "1" ? "Showing my creators" : "Only my creators"}
          </Link>
        )}
      </div>

      {entries.length === 0 && (
        <Alert tone="info" className="mb-4">
          {sp.mine === "1" ? "No creators are assigned to you in this pipeline." : "Nobody here yet. Add creators from their profile page, or send an inquiry — they're added automatically."}
        </Alert>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <ol className="flex min-w-max gap-4" aria-label={`${current.name} stages`}>
          {stages.map((s) => {
            const items = entries.filter((e) => e.stage_id === s.id);
            return (
              <li key={s.id} className="w-72 shrink-0">
                <div className={cn("mb-2 flex items-center justify-between rounded-lg px-3 py-2",
                  s.kind === "signed" ? "bg-success-soft" : s.kind === "passed" ? "bg-ink/5" : "bg-primary-soft/60")}>
                  <h2 className="text-sm font-semibold text-ink">{s.name}</h2>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    {items.length}
                    {canManage && customStages && !s.is_system && items.length === 0 && (
                      <ActionButton action={deleteStageAction.bind(null, s.id)} tone="danger" confirm="Delete?" className="h-6 px-1.5 text-xs">×</ActionButton>
                    )}
                  </span>
                </div>
                <ul className="space-y-2">
                  {items.map((e) => (
                    <li key={e.id} className="space-y-2 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
                      <Link href={`/company/creators/${e.creator.id}`} className="flex items-center gap-2">
                        <PersonAvatar name={e.creator.display_name} path={e.creator.avatar_path} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink hover:underline">{e.creator.display_name}</span>
                          <span className="block text-xs text-muted">Updated {relativeTime(e.updated_at)}</span>
                        </span>
                      </Link>
                      {canEdit && <StageSelect entryId={e.id} stageId={e.stage_id} stages={stages} label={`Stage for ${e.creator.display_name}`} />}
                      {assignments ? (
                        <AssignSelect entryId={e.id} assignee={e.assigned_to} members={memberRows} disabled={!canEdit} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      {canManage && (
        <Card className="mt-6">
          <CardHeader title="Pipeline settings" />
          <CardBody className="space-y-5">
            {customStages ? <AddStageForm pipelineId={current.id} /> : (
              <p className="text-sm text-muted">Custom stages are part of the Management Agency Pro plan.</p>
            )}
            {canAddPipeline ? <CreatePipelineForm /> : (
              <p className="text-sm text-muted">Your plan includes {pipelineLimit} pipeline{pipelineLimit === 1 ? "" : "s"}.</p>
            )}
            {!current.is_default && (
              <ActionButton action={deletePipelineAction.bind(null, current.id)} tone="danger" confirm="Click again — creators in it will be removed from this pipeline">
                Delete “{current.name}”
              </ActionButton>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
