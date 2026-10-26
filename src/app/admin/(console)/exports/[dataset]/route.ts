import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/admin/csv";

export const dynamic = "force-dynamic";

// Each export reads through the admin's own session, so database rules (MFA super admin) apply.
const DATASETS: Record<string, { table: string; columns: string[]; order: string }> = {
  users: { table: "profiles", order: "created_at", columns: ["id", "email", "display_name", "account_type", "status", "created_at", "last_active_at", "deleted_at"] },
  creators: { table: "creator_profiles", order: "created_at", columns: ["id", "user_id", "handle", "display_name", "city", "region", "country", "seeking_management", "representation_status", "is_discoverable", "is_featured", "completeness_pct", "profile_views_count", "created_at"] },
  companies: { table: "companies", order: "created_at", columns: ["id", "name", "slug", "status", "website", "city", "region", "country", "size_band", "is_verified_badge", "outreach_frozen", "approved_at", "created_at"] },
  inquiries: { table: "representation_inquiries", order: "created_at", columns: ["id", "company_id", "creator_id", "sender_user_id", "subject", "status", "created_at", "responded_at"] },
  leads: { table: "company_leads", order: "created_at", columns: ["id", "company_name", "contact_name", "contact_email", "website", "team_size", "status", "created_at"] },
  support: { table: "support_requests", order: "created_at", columns: ["id", "requester_id", "subject", "category", "status", "created_at", "updated_at"] },
  audit_logs: { table: "audit_logs", order: "created_at", columns: ["id", "created_at", "actor_email", "impersonator_id", "action", "target_type", "target_id", "before", "after", "metadata"] },
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const spec = DATASETS[dataset];
  if (!spec) return NextResponse.json({ error: "Unknown export" }, { status: 404 });

  const supabase = await createClient();
  // admin_log only succeeds for an MFA-verified super admin — it doubles as the permission check.
  const { error: denied } = await supabase.rpc("admin_log", { p_action: "exports.download", p_target_type: spec.table, p_target_id: dataset, p_metadata: {} });
  if (denied) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from(spec.table).select(spec.columns.join(",")).order(spec.order, { ascending: false }).range(from, from + 999);
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  const csv = toCsv(rows, spec.columns);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="talentloom-${dataset}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
