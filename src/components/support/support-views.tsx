import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { dateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { NewSupportForm, SupportReplyForm } from "./support-forms";

const STATUS = { open: ["We're on it", "warning"], pending: ["Waiting on you", "accent"], resolved: ["Resolved", "success"], closed: ["Closed", "neutral"] } as const;

export async function SupportHome({ base }: { base: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("support_requests").select("id, subject, status, updated_at").order("updated_at", { ascending: false });
  const rows = (data ?? []) as { id: string; subject: string; status: keyof typeof STATUS; updated_at: string }[];
  return (
    <>
      <PageHeader title="Support" description="Questions, problems or safety concerns — the TalentLoom team replies here and you'll get a notification." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader title="Your requests" />
          <CardBody>
            {rows.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted"><LifeBuoy className="size-4" aria-hidden /> No requests yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`${base}/${r.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.subject}</span>
                      <span className="text-xs text-muted">{relativeTime(r.updated_at)}</span>
                      <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="New request" />
          <CardBody><NewSupportForm /></CardBody>
        </Card>
      </div>
    </>
  );
}

export async function SupportThread({ id, base, viewerId }: { id: string; base: string; viewerId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: req }, { data: msgs }] = await Promise.all([
    supabase.from("support_requests").select("id, subject, status, created_at").eq("id", id).maybeSingle(),
    supabase.from("support_messages").select("id, body, author_id, created_at").eq("request_id", id).order("created_at"),
  ]);
  if (!req) notFound();
  const status = req.status as keyof typeof STATUS;
  return (
    <div className="max-w-3xl space-y-4">
      <Link href={base} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Support
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">{req.subject}</h1>
        <Badge tone={STATUS[status][1]}>{STATUS[status][0]}</Badge>
      </div>
      <ol className="space-y-3">
        {(msgs ?? []).map((m: { id: string; body: string; author_id: string | null; created_at: string }) => {
          const mine = m.author_id === viewerId;
          return (
            <li key={m.id} className={cn("rounded-xl px-4 py-3 text-sm", mine ? "bg-canvas" : "bg-primary-soft/60")}>
              <p className="mb-1 text-xs text-muted">{mine ? "You" : "TalentLoom support"} · {dateTime(m.created_at)}</p>
              <p className="whitespace-pre-wrap text-ink">{m.body}</p>
            </li>
          );
        })}
      </ol>
      {status === "closed" ? (
        <p className="text-sm text-muted">This request is closed. <Link href={base} className="text-primary hover:underline">Open a new one</Link> if you still need help.</p>
      ) : (
        <Card><CardBody><SupportReplyForm requestId={id} /></CardBody></Card>
      )}
    </div>
  );
}
