import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionButton } from "@/components/forms/confirm-action";
import { ImpersonateForm, PermanentDeleteForm, SetupLinkButton, StatusForm } from "@/components/admin/user-forms";
import { setSuperAdminAction } from "@/app/admin/_actions/users";
import { ACCOUNT_LABELS, getAdminContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateTime, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, viewer } = await getAdminContext();
  const [{ data: u }, { data: creator }, { data: memberships }, { data: consents }, { data: imps }, { data: audit }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("creator_profiles").select("id, handle, is_discoverable, completeness_pct").eq("user_id", id).maybeSingle(),
    supabase.from("company_members").select("status, companies(id, name), company_roles(name)").eq("user_id", id),
    supabase.from("consents").select("consent_type, granted_at, revoked_at, document_version").eq("user_id", id).order("granted_at"),
    supabase.from("impersonation_sessions").select("id, reason, started_at, ended_at, admin_id").eq("target_user_id", id)
      .order("started_at", { ascending: false }).limit(5),
    supabase.from("audit_logs").select("id, action, actor_email, created_at").or(`target_id.eq.${id},actor_id.eq.${id}`)
      .order("created_at", { ascending: false }).limit(10),
  ]);
  if (!u) notFound();
  const { data: authUser } = await createAdminClient().auth.admin.getUserById(id);
  const lastSignIn = authUser.user?.last_sign_in_at ?? null;
  const self = id === viewer.id;
  const isAdmin = u.account_type === "super_admin";

  return (
    <>
      <PageHeader title={u.display_name ?? u.email} description={u.email} />
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone="primary">{ACCOUNT_LABELS[u.account_type]}</Badge>
        <Badge tone={u.status === "active" ? "success" : u.status === "suspended" ? "warning" : "danger"}>{u.status}</Badge>
        {u.age_attested_at && <Badge>18+ confirmed {shortDate(u.age_attested_at)}</Badge>}
      </div>
      {u.status === "suspended" && u.suspended_reason && <Alert tone="warning" className="mb-6">Suspended: {u.suspended_reason}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Joined</dt><dd className="text-ink">{dateTime(u.created_at)}</dd></div>
                <div><dt className="text-muted">Last sign-in</dt><dd className="text-ink">{lastSignIn ? dateTime(lastSignIn) : "Never"}</dd></div>
                <div><dt className="text-muted">Last active</dt><dd className="text-ink">{u.last_active_at ? dateTime(u.last_active_at) : "—"}</dd></div>
                <div><dt className="text-muted">Onboarding</dt><dd className="text-ink">{u.onboarding_completed_at ? "Complete" : "Not finished"}</dd></div>
              </dl>
              {creator && (
                <p className="mt-4 text-sm">
                  Creator profile {creator.handle ? `@${creator.handle}` : "(no handle yet)"} · {creator.completeness_pct}% complete ·{" "}
                  {creator.is_discoverable ? "discoverable" : "hidden"} ·{" "}
                  <Link href={`/admin/creators/${creator.id}`} className="font-medium text-primary hover:underline">Open creator</Link>
                </p>
              )}
              {(memberships ?? []).map((m: { status: string; companies: { id: string; name: string } | null; company_roles: { name: string } | null }) => m.companies && (
                <p key={m.companies.id} className="mt-2 text-sm">
                  {m.company_roles?.name} at <Link href={`/admin/companies/${m.companies.id}`} className="font-medium text-primary hover:underline">{m.companies.name}</Link>
                  {m.status !== "active" && <span className="text-muted"> ({m.status})</span>}
                </p>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Consents" />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {(consents ?? []).map((c: { consent_type: string; granted_at: string; revoked_at: string | null; document_version: string }, i: number) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ink">{c.consent_type.replace(/_/g, " ")}</span>
                    <span className="text-muted">{shortDate(c.granted_at)} · v{c.document_version}{c.revoked_at && ` · withdrawn ${shortDate(c.revoked_at)}`}</span>
                  </li>
                ))}
                {!consents?.length && <li className="text-muted">None recorded.</li>}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent activity" description="From the audit log" action={<Link href={`/admin/audit-logs?target=${id}`} className="text-sm text-primary">All</Link>} />
            <CardBody>
              <ul className="space-y-1.5 text-sm">
                {(audit ?? []).map((a: { id: number; action: string; actor_email: string | null; created_at: string }) => (
                  <li key={a.id} className="flex justify-between gap-3"><span className="font-mono text-xs text-ink">{a.action}</span>
                    <span className="text-muted">{a.actor_email ?? "system"} · {dateTime(a.created_at)}</span></li>
                ))}
                {!audit?.length && <li className="text-muted">Nothing yet.</li>}
              </ul>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          {!self && (
            <Card>
              <CardHeader title="Actions" />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {u.status !== "active" && <StatusForm userId={id} status="active" label="Reactivate" tone="primary" />}
                  {u.status === "active" && <StatusForm userId={id} status="suspended" label="Suspend" tone="danger" needsReason />}
                  {u.status !== "deleted" && <StatusForm userId={id} status="deleted" label="Soft-delete" tone="danger" />}
                </div>
                <SetupLinkButton userId={id} />
                {u.status === "active" && (
                  isAdmin ? (
                    <ActionButton action={setSuperAdminAction.bind(null, id, false)} tone="danger" confirm="Click again to remove admin role">Remove super admin</ActionButton>
                  ) : (
                    <ActionButton action={setSuperAdminAction.bind(null, id, true)} confirm="Click again — they'll get full admin access">Make super admin</ActionButton>
                  )
                )}
              </CardBody>
            </Card>
          )}
          {!self && !isAdmin && u.status === "active" && (
            <Card>
              <CardHeader title="View as user" description="For support: see exactly what they see." />
              <CardBody>
                {lastSignIn ? <ImpersonateForm userId={id} /> : <p className="text-sm text-muted">Available after they&apos;ve signed in once.</p>}
                {(imps ?? []).length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted">
                    {(imps ?? []).map((s: { id: string; reason: string; started_at: string; ended_at: string | null }) => (
                      <li key={s.id}>{dateTime(s.started_at)} — {s.reason}{s.ended_at ? "" : " (not ended)"}</li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
          {!self && u.status === "deleted" && !isAdmin && (
            <Card>
              <CardHeader title="Permanent deletion" description="Removes their login, profile, messages they own and uploaded files. Can't be undone." />
              <CardBody><PermanentDeleteForm userId={id} email={u.email} /></CardBody>
            </Card>
          )}
          {self && <Alert tone="info">This is your account. Ask another admin to change it.</Alert>}
        </aside>
      </div>
    </>
  );
}
