import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin/context";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };
const PAGE = 100;

interface Row { id: number; actor_email: string | null; impersonator_id: string | null; action: string; target_type: string | null;
  target_id: string | null; before: unknown; after: unknown; metadata: unknown; created_at: string }

function short(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = JSON.stringify(v);
  return s === "{}" ? "" : s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

export default async function AuditLogPage({ searchParams }: {
  searchParams: Promise<{ action?: string; actor?: string; target?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase } = await getAdminContext();
  let q = supabase.from("audit_logs").select("id, actor_email, impersonator_id, action, target_type, target_id, before, after, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const clean = (v?: string) => (v ?? "").replace(/[%,()]/g, "").trim().slice(0, 80);
  if (clean(sp.action)) q = q.ilike("action", `${clean(sp.action)}%`);
  if (clean(sp.actor)) q = q.ilike("actor_email", `%${clean(sp.actor)}%`);
  if (clean(sp.target)) q = q.eq("target_id", clean(sp.target));
  const { data, count } = await q;
  const rows = (data ?? []) as Row[];
  const qs = (p: number) => `/admin/audit-logs?${new URLSearchParams(Object.entries({ action: sp.action, actor: sp.actor, target: sp.target, page: String(p) }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader title="Audit log" description={`${count ?? 0} entries. Append-only — nobody can edit or delete them.`} />
      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <input name="action" defaultValue={sp.action} placeholder="Action starts with (e.g. profiles)" aria-label="Action"
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm" />
        <input name="actor" defaultValue={sp.actor} placeholder="Actor email" aria-label="Actor email" className="h-9 rounded-lg border border-line bg-surface px-3 text-sm" />
        <input name="target" defaultValue={sp.target} placeholder="Record id" aria-label="Record id" className="h-9 w-80 rounded-lg border border-line bg-surface px-3 text-sm" />
        <button className="h-9 rounded-lg bg-ink px-3 text-sm font-medium text-white">Filter</button>
        <Link href="/admin/exports" className="ml-auto self-center text-sm text-primary">Export CSV</Link>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs text-muted">
            <tr><th className="px-4 py-2 font-medium">When</th><th className="px-4 py-2 font-medium">Who</th><th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Record</th><th className="px-4 py-2 font-medium">Change</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-2 whitespace-nowrap text-muted">{dateTime(r.created_at)}</td>
                <td className="px-4 py-2">{r.actor_email ?? <span className="text-muted">system</span>}{r.impersonator_id && <span className="block text-xs text-warning-strong">via view-as</span>}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.target_type}{r.target_id && <Link href={`/admin/audit-logs?target=${r.target_id}`} className="block text-primary">{r.target_id.slice(0, 13)}…</Link>}</td>
                <td className="max-w-md px-4 py-2 font-mono text-[11px] break-all text-muted">
                  {short(r.before) && <span className="block">− {short(r.before)}</span>}
                  {short(r.after) && <span className="block text-ink">+ {short(r.after)}</span>}
                  {short(r.metadata) && <span className="block">{short(r.metadata)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={qs(page - 1)} className="text-primary">← Newer</Link> : <span />}
        {page * PAGE < (count ?? 0) && <Link href={qs(page + 1)} className="text-primary">Older →</Link>}
      </div>
    </>
  );
}
