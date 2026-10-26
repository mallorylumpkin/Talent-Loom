import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AdminSupportReply, AdminSupportStatus } from "@/components/admin/platform-forms";
import { getAdminContext } from "@/lib/admin/context";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Support request" };

export default async function AdminSupportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getAdminContext();
  const [{ data: req }, { data: msgs }] = await Promise.all([
    supabase.from("support_requests").select("id, subject, category, status, created_at, requester_id, profiles:requester_id(email, display_name)").eq("id", id).maybeSingle(),
    supabase.from("support_messages").select("id, body, is_internal, created_at, author_id, profiles:author_id(display_name, email, account_type)").eq("request_id", id).order("created_at"),
  ]);
  if (!req) notFound();
  const r = req as unknown as { id: string; subject: string; category: string; status: string; created_at: string; requester_id: string | null;
    profiles: { email: string; display_name: string | null } | null };
  const messages = (msgs ?? []) as unknown as { id: string; body: string; is_internal: boolean; created_at: string; author_id: string | null;
    profiles: { display_name: string | null; email: string; account_type: string } | null }[];
  return (
    <>
      <PageHeader title={r.subject}
        description={<>{r.category.replace("_", " ")} · opened {dateTime(r.created_at)} by{" "}
          {r.requester_id ? <Link href={`/admin/users/${r.requester_id}`} className="text-primary hover:underline">{r.profiles?.display_name ?? r.profiles?.email}</Link> : "a deleted user"}</>} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardBody className="space-y-4">
            <ol className="space-y-3">
              {messages.map((m) => {
                const staff = m.profiles?.account_type === "super_admin";
                return (
                  <li key={m.id} className={cn("rounded-xl px-4 py-3 text-sm", m.is_internal ? "border border-dashed border-warning bg-warning-soft/50" : staff ? "bg-primary-soft/60" : "bg-canvas")}>
                    <p className="mb-1 text-xs text-muted">{m.is_internal ? "Internal note · " : ""}{m.profiles?.display_name ?? m.profiles?.email ?? "Deleted user"} · {dateTime(m.created_at)}</p>
                    <p className="whitespace-pre-wrap text-ink">{m.body}</p>
                  </li>
                );
              })}
            </ol>
            <AdminSupportReply requestId={r.id} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Status" />
          <CardBody><AdminSupportStatus requestId={r.id} status={r.status} /></CardBody>
        </Card>
      </div>
    </>
  );
}
