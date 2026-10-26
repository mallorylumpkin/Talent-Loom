import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PersonAvatar } from "@/components/messaging/avatar";
import { RosterForm } from "@/components/company/relationship-forms";
import { feature, requireCompany } from "@/lib/company/context";
import { shortDate } from "@/lib/format";
import type { CreatorCardInfo } from "@/lib/messaging/types";

export const metadata: Metadata = { title: "Roster" };

interface Row {
  id: string; status: "active" | "ended"; signed_at: string; contract_end: string | null; notes: string | null;
  creator: CreatorCardInfo; conversation_id: string | null;
}

export default async function RosterPage() {
  const { supabase, company, permissions, entitlements } = await requireCompany();
  const enabled = feature(entitlements, "roster").enabled;
  const { data } = await supabase.rpc("company_roster", { p_company_id: company.id });
  const rows = (data ?? []) as Row[];
  const canManage = permissions.has("roster.manage") && enabled;
  const active = rows.filter((r) => r.status === "active").length;

  return (
    <>
      <PageHeader title="Signed roster" description={`${active} active creator${active === 1 ? "" : "s"}. Moving a creator to “Signed” in your pipeline adds them here.`} />
      {!enabled && (
        <Alert tone="info" className="mb-6">The signed-talent roster is part of the Management Agency plan. Contact TalentLoom to upgrade.</Alert>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No signed creators yet" description="When you sign a creator, move them to “Signed” in your pipeline and they'll appear here." />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const soon = r.contract_end && r.status === "active" && new Date(r.contract_end).getTime() - Date.now() < 60 * 86400000;
            return (
              <li key={r.id}>
                <Card>
                  <CardBody className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <PersonAvatar name={r.creator.display_name} path={r.creator.avatar_path} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/company/creators/${r.creator.id}`} className="font-medium text-ink hover:underline">{r.creator.display_name}</Link>
                        <p className="text-sm text-muted">Signed {shortDate(r.signed_at)}{r.contract_end && ` · contract ends ${shortDate(r.contract_end)}`}</p>
                      </div>
                      <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status === "active" ? "Active" : "Ended"}</Badge>
                      {soon && <Badge tone="warning">Renewal soon</Badge>}
                      {r.conversation_id && (
                        <Link href={`/company/messages/${r.conversation_id}`} className="text-sm font-medium text-primary hover:underline">Message</Link>
                      )}
                    </div>
                    {canManage ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-primary">Edit contract details</summary>
                        <div className="pt-3">
                          <RosterForm rosterId={r.id} status={r.status} signedAt={r.signed_at} contractEnd={r.contract_end} notes={r.notes} />
                        </div>
                      </details>
                    ) : r.notes ? <p className="text-sm whitespace-pre-wrap text-muted">{r.notes}</p> : null}
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
