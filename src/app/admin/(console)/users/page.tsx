import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ACCOUNT_LABELS, getAdminContext } from "@/lib/admin/context";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Users" };

const STATUS_TONES = { active: "success", suspended: "warning", deleted: "danger" } as const;
const PAGE = 50;

export default async function UsersPage({ searchParams }: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; page?: string; deleted?: string }>;
}) {
  const sp = await searchParams;
  const { supabase } = await getAdminContext();
  const page = Math.max(1, Number(sp.page) || 1);
  let q = supabase.from("profiles")
    .select("id, email, display_name, account_type, status, created_at, last_active_at", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.type && ["creator", "company_member", "super_admin"].includes(sp.type)) q = q.eq("account_type", sp.type);
  if (sp.status && ["active", "suspended", "deleted"].includes(sp.status)) q = q.eq("status", sp.status);
  if (sp.q) {
    const term = sp.q.replace(/[%,()]/g, " ").trim().slice(0, 80);
    if (term) q = q.or(`email.ilike.%${term}%,display_name.ilike.%${term}%`);
  }
  const { data, count } = await q;
  const rows = (data ?? []) as { id: string; email: string; display_name: string | null; account_type: string; status: keyof typeof STATUS_TONES;
    created_at: string; last_active_at: string | null }[];
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ type: sp.type, status: sp.status, q: sp.q, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/users?${p}`;
  };
  const pill = (active: boolean) => cn("rounded-full px-3.5 py-1.5 text-sm font-medium", active ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line hover:text-ink");

  return (
    <>
      <PageHeader title="Users" description={`${count ?? 0} accounts`}
        action={<ButtonLink href="/admin/users/new"><Plus className="size-4" aria-hidden /> New creator</ButtonLink>} />
      {sp.deleted && <Alert tone="success" className="mb-4">The account was permanently deleted. The audit log keeps a record.</Alert>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filter by type">
          {[["", "All"], ["creator", "Creators"], ["company_member", "Companies"], ["super_admin", "Admins"]].map(([k, l]) => (
            <Link key={k} href={qs({ type: k || undefined, page: undefined })} className={pill((sp.type ?? "") === k)}>{l}</Link>
          ))}
          <span className="mx-1 w-px bg-line" aria-hidden />
          {[["", "Any status"], ["suspended", "Suspended"], ["deleted", "Deleted"]].map(([k, l]) => (
            <Link key={k} href={qs({ status: k || undefined, page: undefined })} className={pill((sp.status ?? "") === k)}>{l}</Link>
          ))}
        </nav>
        <form method="get" className="flex gap-2">
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q} placeholder="Search email or name" aria-label="Search users"
            className="h-9 rounded-lg border border-line bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No users match" description="Try a different filter or search." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{u.display_name ?? u.email}</p>
                    <p className="truncate text-sm text-muted">{u.email} · joined {shortDate(u.created_at)}
                      {u.last_active_at && ` · active ${shortDate(u.last_active_at)}`}</p>
                  </div>
                  <Badge tone="primary">{ACCOUNT_LABELS[u.account_type] ?? u.account_type}</Badge>
                  <Badge tone={STATUS_TONES[u.status]}>{u.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {(count ?? 0) > PAGE && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-primary">← Previous</Link> : <span />}
          {page * PAGE < (count ?? 0) && <Link href={qs({ page: String(page + 1) })} className="text-primary">Next →</Link>}
        </div>
      )}
    </>
  );
}
