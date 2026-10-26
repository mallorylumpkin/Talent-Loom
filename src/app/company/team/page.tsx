import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/creator/section";
import { InviteMemberForm, MemberLinkButton, RoleSelect } from "@/components/company/forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { removeMemberAction } from "@/app/company/_actions/company";
import { lastSignIns } from "@/lib/auth/company-users";
import { feature, requireCompany } from "@/lib/company/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { viewer, supabase, company, role, permissions, entitlements } = await requireCompany();
  const canManage = permissions.has("team.manage");

  const [{ data: members }, { data: roles }] = await Promise.all([
    supabase.from("company_members").select("user_id, role_id, created_at, profiles(email, display_name), company_roles(name, key)")
      .eq("company_id", company.id).eq("status", "active").order("created_at"),
    supabase.from("company_roles").select("id, name, key, company_id").order("created_at"),
  ]);
  const rows = (members ?? []) as unknown as {
    user_id: string; role_id: string; created_at: string;
    profiles: { email: string; display_name: string | null }; company_roles: { name: string; key: string };
  }[];
  const signIns = canManage ? await lastSignIns(rows.map((r) => r.user_id)) : new Map<string, string | null>();
  // Only owners may hand out the Owner role.
  const roleOptions = (roles ?? [])
    .filter((r: { key: string }) => role.key === "owner" || r.key !== "owner")
    .map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
  const seats = feature(entitlements, "seats.max");

  return (
    <>
      <PageHeader title="Team"
        description={seats.limit != null ? `${rows.length} of ${seats.limit} seat${seats.limit === 1 ? "" : "s"} used` : `${rows.length} members`} />
      <div className="space-y-6">
        <Section title="Members">
          <ul className="divide-y divide-line">
            {rows.map((m) => {
              const me = m.user_id === viewer.id;
              const isOwner = m.company_roles.key === "owner";
              const editable = canManage && !me && (role.key === "owner" || !isOwner);
              const signedIn = signIns.get(m.user_id);
              return (
                <li key={m.user_id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{m.profiles.display_name ?? m.profiles.email} {me && <Badge>You</Badge>}</p>
                    <p className="text-muted">{m.profiles.email}</p>
                    {canManage && !me && (
                      <p className="text-xs text-muted">{signedIn ? `Last signed in ${shortDate(signedIn)}` : "Hasn't signed in yet"}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editable ? (
                      <>
                        <RoleSelect userId={m.user_id} roleId={m.role_id} roles={roleOptions} />
                        {!signedIn && <MemberLinkButton userId={m.user_id} />}
                        <ActionButton action={removeMemberAction.bind(null, m.user_id)} tone="danger" confirm="Click again to remove">
                          Remove
                        </ActionButton>
                      </>
                    ) : (
                      <Badge tone={isOwner ? "primary" : "neutral"}>{m.company_roles.name}</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        {canManage && (
          <Section title="Add a teammate"
            description="We'll create their account and give you a one-time link to send them, so they can choose a password.">
            <InviteMemberForm roles={roleOptions} />
          </Section>
        )}

        <Section title="What each role can do">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="font-medium text-ink">Owner</dt><dd className="text-muted">Everything, including managing owners and billing.</dd></div>
            <div><dt className="font-medium text-ink">Admin</dt><dd className="text-muted">Everything except managing owners.</dd></div>
            <div><dt className="font-medium text-ink">Recruiter</dt><dd className="text-muted">Search, save, notes, pipeline, inquiries and messages.</dd></div>
            <div><dt className="font-medium text-ink">Viewer</dt><dd className="text-muted">Search and read-only access.</dd></div>
          </dl>
        </Section>
      </div>
    </>
  );
}
