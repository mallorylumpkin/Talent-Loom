import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/forms/confirm-action";
import { ReportForm } from "@/components/admin/trust-forms";
import { freezeCompanyOutreachAction } from "@/app/admin/_actions/trust";
import { getAdminContext } from "@/lib/admin/context";
import { dateTime } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/messaging/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Reports" };

interface Report { id: string; reporter_id: string | null; target_type: string; target_id: string; reason: string; details: string | null;
  status: string; resolution: string | null; created_at: string }
interface Msg { id: string; conversation_id: string; body: string; created_at: string; sender_user_id: string | null }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const closed = view === "closed";
  const { supabase } = await getAdminContext();
  const { data } = await supabase.from("user_reports").select("*")
    .in("status", closed ? ["actioned", "dismissed"] : ["open", "reviewing"]).order("created_at", { ascending: !closed }).limit(50);
  const reports = (data ?? []) as Report[];

  const ids = (t: string) => reports.filter((r) => r.target_type === t).map((r) => r.target_id);
  const reporterIds = reports.map((r) => r.reporter_id).filter(Boolean) as string[];
  const convIds = ids("conversation");
  const [{ data: companies }, { data: convs }, { data: msgs }, { data: reporters }, { data: single }] = await Promise.all([
    supabase.from("companies").select("id, name, outreach_frozen").in("id", ids("company").length ? ids("company") : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("conversations").select("id, company_id, creator_id, companies(name, outreach_frozen), creator_profiles(display_name, user_id)").in("id", convIds.length ? convIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("messages").select("id, conversation_id, body, created_at, sender_user_id").in("conversation_id", convIds.length ? convIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, email").in("id", reporterIds.length ? reporterIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("messages").select("id, conversation_id, body, created_at, sender_user_id").in("id", ids("message").length ? ids("message") : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  type Co = { id: string; name: string; outreach_frozen: boolean };
  const companyBy = new Map<string, Co>(((companies ?? []) as Co[]).map((c) => [c.id, c]));
  type Conv = { id: string; company_id: string; creator_id: string; companies: { name: string; outreach_frozen: boolean }; creator_profiles: { display_name: string | null; user_id: string } };
  const convBy = new Map(((convs ?? []) as unknown as Conv[]).map((c) => [c.id, c]));
  const reporterBy = new Map<string, string>(((reporters ?? []) as { id: string; email: string }[]).map((p) => [p.id, p.email]));
  const messages = (msgs ?? []) as Msg[];
  const singleBy = new Map(((single ?? []) as Msg[]).map((m) => [m.id, m]));
  const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;
  const tab = (a: boolean) => cn("rounded-full px-3.5 py-1.5 text-sm font-medium", a ? "bg-ink text-white" : "bg-surface text-ink/70 ring-1 ring-line");

  return (
    <>
      <PageHeader title="User reports" description="Oldest open reports first. Users who report are told when you close their report." />
      <nav className="mb-6 flex gap-2" aria-label="Report view">
        <Link href="/admin/reports" className={tab(!closed)}>Open</Link>
        <Link href="/admin/reports?view=closed" className={tab(closed)}>Closed</Link>
      </nav>
      {reports.length === 0 ? <EmptyState icon={Flag} title="No reports here" description="Reports from creators and companies appear here." /> : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const conv = r.target_type === "conversation" ? convBy.get(r.target_id) : undefined;
            const company = r.target_type === "company" ? companyBy.get(r.target_id) : conv ? { id: conv.company_id, name: conv.companies.name, outreach_frozen: conv.companies.outreach_frozen } : undefined;
            const thread = conv ? messages.filter((m) => m.conversation_id === conv.id).slice(0, 6).reverse() : [];
            const msg = r.target_type === "message" ? singleBy.get(r.target_id) : undefined;
            return (
              <li key={r.id}>
                <Card>
                  <CardBody className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="danger">{reasonLabel(r.reason)}</Badge>
                        <Badge>{r.target_type.replace("_", " ")}</Badge>
                        <span className="text-sm text-muted">{dateTime(r.created_at)} · from {r.reporter_id ? (reporterBy.get(r.reporter_id) ?? "a user") : "deleted user"}</span>
                      </div>
                      {r.details && <p className="rounded-lg bg-canvas px-3 py-2 text-sm whitespace-pre-wrap text-ink">{r.details}</p>}
                      {company && (
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          Company: <Link href={`/admin/companies/${company.id}`} className="font-medium text-primary hover:underline">{company.name}</Link>
                          <ActionButton action={freezeCompanyOutreachAction.bind(null, company.id, !company.outreach_frozen)} tone={company.outreach_frozen ? "primary" : "danger"}
                            confirm={company.outreach_frozen ? undefined : "Click again to pause their outreach"}>
                            {company.outreach_frozen ? "Resume outreach" : "Pause outreach"}
                          </ActionButton>
                        </p>
                      )}
                      {conv && (
                        <div className="space-y-1.5 rounded-lg border border-line p-3 text-sm">
                          <p className="text-xs font-medium text-muted">Latest messages ({conv.creator_profiles.display_name ?? "creator"} ↔ {conv.companies.name})</p>
                          {thread.map((m) => (
                            <p key={m.id}><span className="font-medium text-ink">{m.sender_user_id === conv.creator_profiles.user_id ? "Creator" : "Company"}:</span>{" "}
                              <span className="whitespace-pre-wrap text-ink/85">{m.body.slice(0, 400)}</span></p>
                          ))}
                        </div>
                      )}
                      {msg && <p className="rounded-lg border border-line p-3 text-sm whitespace-pre-wrap">{msg.body}</p>}
                      {(r.target_type === "user" || r.target_type === "creator_profile") && (
                        <Link href={r.target_type === "user" ? `/admin/users/${r.target_id}` : `/admin/creators/${r.target_id}`} className="text-sm font-medium text-primary hover:underline">Open reported account</Link>
                      )}
                    </div>
                    <ReportForm reportId={r.id} status={r.status} resolution={r.resolution} />
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
