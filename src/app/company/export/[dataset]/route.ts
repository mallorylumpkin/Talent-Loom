import { NextResponse, type NextRequest } from "next/server";
import { getCompanyContext, feature } from "@/lib/company/context";
import { toCsv } from "@/lib/admin/csv";

export const dynamic = "force-dynamic";

/** Company CSV exports — only data the company can already see, only with the plan feature and permission. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const { supabase, company, permissions, entitlements } = await getCompanyContext();
  if (!company || !permissions.has("export.csv") || !feature(entitlements, "csv_export").enabled) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];
  const name = (c: { display_name?: string; handle?: string | null } | null) => c?.display_name ?? "";
  if (dataset === "pipeline") {
    const { data: pipelines } = await supabase.from("pipelines").select("id, name").eq("company_id", company.id);
    for (const p of (pipelines ?? []) as { id: string; name: string }[]) {
      const { data } = await supabase.rpc("pipeline_board", { p_pipeline_id: p.id });
      const b = data as { stages: { id: string; name: string }[]; entries: { stage_id: string; assignee: string | null; updated_at: string; creator: { display_name: string; handle: string | null } }[] };
      rows.push(...b.entries.map((e) => ({ pipeline: p.name, stage: b.stages.find((s) => s.id === e.stage_id)?.name, creator: name(e.creator),
        handle: e.creator.handle, assigned_to: e.assignee, updated_at: e.updated_at })));
    }
    columns = ["pipeline", "stage", "creator", "handle", "assigned_to", "updated_at"];
  } else if (dataset === "roster") {
    const { data } = await supabase.rpc("company_roster", { p_company_id: company.id });
    rows = ((data ?? []) as { status: string; signed_at: string; contract_end: string | null; notes: string | null; creator: { display_name: string; handle: string | null } }[])
      .map((r) => ({ creator: name(r.creator), handle: r.creator.handle, status: r.status, signed_at: r.signed_at, contract_end: r.contract_end, notes: r.notes }));
    columns = ["creator", "handle", "status", "signed_at", "contract_end", "notes"];
  } else if (dataset === "inquiries") {
    const { data } = await supabase.rpc("company_inquiries", { p_company_id: company.id });
    rows = ((data ?? []) as { subject: string; status: string; created_at: string; responded_at: string | null; sender: string | null; creator: { display_name: string; handle: string | null } }[])
      .map((i) => ({ creator: name(i.creator), handle: i.creator.handle, subject: i.subject, status: i.status, sent_by: i.sender, sent_at: i.created_at, responded_at: i.responded_at }));
    columns = ["creator", "handle", "subject", "status", "sent_by", "sent_at", "responded_at"];
  } else if (dataset === "saved") {
    const { data: lists } = await supabase.from("talent_lists").select("name, talent_list_members(creator_id, added_at:created_at)").eq("company_id", company.id);
    const ids = [...new Set(((lists ?? []) as { talent_list_members: { creator_id: string }[] }[]).flatMap((l) => l.talent_list_members.map((m) => m.creator_id)))];
    const { data: found } = ids.length ? await supabase.rpc("search_creators", { p_company_id: company.id, p_filters: { ids: ids.slice(0, 500) }, p_limit: 500 }) : { data: null };
    const items = ((found as { items?: { id: string; display_name: string; handle: string; total_followers?: number }[] } | null)?.items ?? []);
    rows = ((lists ?? []) as { name: string; talent_list_members: { creator_id: string }[] }[]).flatMap((l) => l.talent_list_members.map((m) => {
      const c = items.find((x) => x.id === m.creator_id);
      return { list: l.name, creator: c?.display_name ?? "(no longer discoverable)", handle: c?.handle ?? "" };
    }));
    columns = ["list", "creator", "handle"];
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }
  return new NextResponse(toCsv(rows, columns), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${company.slug}-${dataset}.csv"`, "Cache-Control": "no-store" },
  });
}
