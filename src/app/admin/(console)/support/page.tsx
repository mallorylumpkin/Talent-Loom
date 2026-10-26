import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAdminContext } from "@/lib/admin/context";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Support" };
const TONE = { open: "danger", pending: "warning", resolved: "success", closed: "neutral" } as const;

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const done = view === "done";
  const { supabase } = await getAdminContext();
  const { data } = await supabase.from("support_requests").select("id, subject, category, status, updated_at, profiles:requester_id(email, display_name)")
    .in("status", done ? ["resolved", "closed"] : ["open", "pending"]).order("updated_at", { ascending: !done }).limit(100);
  const rows = (data ?? []) as unknown as { id: string; subject: string; category: string; status: keyof typeof TONE; updated_at: string;
    profiles: { email: string; display_name: string | null } | null }[];
  const tab = (a: boolean) => cn("rounded-full px-3.5 py-1.5 text-sm font-medium", a ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line");
  return (
    <>
      <PageHeader title="Support requests" />
      <nav className="mb-6 flex gap-2" aria-label="Support view">
        <Link href="/admin/support" className={tab(!done)}>Active</Link>
        <Link href="/admin/support?view=done" className={tab(done)}>Resolved & closed</Link>
      </nav>
      {rows.length === 0 ? <EmptyState icon={LifeBuoy} title="No requests here" description="Requests from creators and companies show up here." /> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/support/${r.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{r.subject}</p>
                    <p className="text-sm text-muted">{r.profiles?.display_name ?? r.profiles?.email ?? "Deleted user"} · {r.category.replace("_", " ")} · {relativeTime(r.updated_at)}</p>
                  </div>
                  <Badge tone={TONE[r.status]}>{r.status === "open" ? "Needs reply" : r.status === "pending" ? "Waiting on user" : r.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
