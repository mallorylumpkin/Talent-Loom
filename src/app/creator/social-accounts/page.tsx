import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, ExternalLink, Link2, RefreshCw, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/creator/section";
import { AddAccountForm } from "@/components/creator/account-forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { removeAccountAction, setPrimaryAccountAction } from "@/app/creator/_actions/accounts";
import { disconnectAction, syncNowAction } from "@/app/creator/_actions/connections";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { tokenEncryptionConfigured } from "@/lib/social/crypto";
import { configuredProviders, getProvider } from "@/lib/social/providers";
import { getCreatorContext, getLookups, hasConsent } from "@/lib/creator/context";
import { compactNumber, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Social accounts" };

interface AccountWithLatest {
  id: string;
  handle: string;
  url: string | null;
  is_primary: boolean;
  connection_type: "manual" | "oauth";
  platforms: { label: string; key: string };
  social_connections: Connection | Connection[] | null;
  analytics_snapshots: {
    id: string; followers: number | null; source: "self_reported" | "admin_verified" | "api_verified";
    verification_status: string; captured_at: string;
  }[];
}

interface Connection {
  status: "active" | "expired" | "revoked" | "error";
  last_synced_at: string | null;
  last_error: string | null;
}

const CONNECT_ERRORS: Record<string, string> = {
  unavailable: "That connection isn't switched on yet.",
  expired: "The sign-in took too long or was started in another browser. Please try again.",
  cancelled: "Connection cancelled — nothing was changed.",
  taken: "That account is already connected to another TalentLoom creator. If it's yours, contact support.",
  limit: "You've reached the number of social accounts on your plan. Remove one or upgrade to Creator Pro, then try again.",
  no_channel: "That Google account doesn't have a YouTube channel. Try again and choose the account that owns your channel.",
  sync: "Your account is connected, but we couldn't read its numbers yet. Use “Sync now” in a few minutes.",
  failed: "We couldn't connect that account. Please try again — for Instagram, make sure it's a Business or Creator account.",
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connect_error?: string; platform?: string }>;
}) {
  const sp = await searchParams;
  const { viewer, supabase, creator } = await getCreatorContext();
  const [{ platforms }, consent, { data: accounts }, { data: limits }] = await Promise.all([
    getLookups(supabase),
    hasConsent(supabase, viewer.id, "creator_data_consent"),
    supabase
      .from("social_accounts")
      .select("id, handle, url, is_primary, connection_type, platforms(label, key), social_connections(status, last_synced_at, last_error), analytics_snapshots(id, followers, source, verification_status, captured_at)")
      .eq("creator_id", creator.id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at")
      .order("captured_at", { referencedTable: "analytics_snapshots", ascending: false })
      .limit(1, { referencedTable: "analytics_snapshots" }),
    supabase.rpc("my_entitlements"),
  ]);

  const list = (accounts ?? []) as unknown as AccountWithLatest[];
  const limit = (limits as { feature_key: string; limit_value: number | null }[] | null)
    ?.find((l) => l.feature_key === "social_accounts.max")?.limit_value;
  const connectable = tokenEncryptionConfigured() ? configuredProviders() : [];
  const connectedKeys = new Set(list.filter((a) => a.connection_type === "oauth").map((a) => a.platforms.key));
  const connectedLabel = sp.connected ? getProvider(sp.connected)?.label : null;

  return (
    <>
      <PageHeader
        title="Social accounts"
        description="Connect your platforms so companies see verified numbers, or add them manually as self-reported."
      />
      <div className="space-y-6">
        {connectedLabel && !sp.connect_error && (
          <Alert tone="success" title={`${connectedLabel} connected`}>Your numbers were read from {connectedLabel} and are now labelled Verified.</Alert>
        )}
        {sp.connect_error && (
          <Alert tone={sp.connect_error === "cancelled" || sp.connect_error === "sync" ? "warning" : "danger"}>
            {CONNECT_ERRORS[sp.connect_error] ?? CONNECT_ERRORS.failed}
          </Alert>
        )}

        <Section
          title="Connect for verified numbers"
          description="Sign in with the platform. Companies see these numbers labelled Verified, and they refresh daily."
        >
          {connectable.length === 0 ? (
            <p className="text-sm text-muted">
              Official connections to Instagram, TikTok and YouTube are being set up. Until then, add accounts below and upload
              screenshots on the Analytics page to request verification.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {connectable.map((p) => (
                <ButtonLink key={p.key} href={`/creator/connect/${p.key}`} variant={connectedKeys.has(p.key) ? "secondary" : "primary"}>
                  <Link2 className="size-4" aria-hidden />
                  {connectedKeys.has(p.key) ? `Connect another ${p.label} account` : `Connect ${p.label}`}
                </ButtonLink>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Your accounts"
          description={limit != null ? `${list.length} of ${limit} on your plan` : `${list.length} added`}
        >
          {list.length === 0 ? (
            <EmptyState icon={AtSign} title="Add your first platform"
              description="Start with the platform where you have the biggest or fastest-growing audience." />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((a) => {
                const latest = a.analytics_snapshots[0];
                const conn = one(a.social_connections);
                const connected = a.connection_type === "oauth";
                const needsReconnect = connected && conn?.status === "expired";
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                        {a.platforms.label}
                        {a.is_primary && <Badge tone="primary"><Star className="size-3" aria-hidden /> Primary</Badge>}
                        {connected && !needsReconnect && <Badge tone="success"><Link2 className="size-3" aria-hidden /> Connected</Badge>}
                        {needsReconnect && <Badge tone="warning">Reconnect needed</Badge>}
                      </p>
                      <p className="truncate text-sm text-muted">
                        @{a.handle}
                        {a.url && (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                            Open <ExternalLink className="size-3" aria-hidden />
                          </a>
                        )}
                      </p>
                      {connected && (
                        <p className={cn("text-xs", conn?.last_error ? "text-danger-strong" : "text-muted")}>
                          {conn?.last_error
                            ? conn.last_error
                            : conn?.last_synced_at
                              ? `Synced ${shortDate(conn.last_synced_at)} · refreshes daily`
                              : "Waiting for first sync"}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="tabular font-display text-lg font-semibold text-ink">{compactNumber(latest?.followers)}</p>
                      <p className="text-xs text-muted">{latest ? `as of ${shortDate(latest.captured_at)}` : "No numbers yet"}</p>
                    </div>
                    {latest && <ProvenanceBadge source={latest.source} />}
                    <div className="flex items-center gap-1">
                      <Link href={`/creator/analytics#${a.id}`} className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary-soft">
                        Numbers
                      </Link>
                      {connected && !needsReconnect && (
                        <ActionButton action={syncNowAction.bind(null, a.id)}>
                          <RefreshCw className="size-3.5" aria-hidden /> Sync now
                        </ActionButton>
                      )}
                      {needsReconnect && getProvider(a.platforms.key)?.configured() && (
                        <Link href={`/creator/connect/${a.platforms.key}`} className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary-soft">
                          Reconnect
                        </Link>
                      )}
                      {connected && (
                        <ActionButton action={disconnectAction.bind(null, a.id)} confirm="Click again to disconnect">
                          Disconnect
                        </ActionButton>
                      )}
                      {!connected && connectable.some((p) => p.key === a.platforms.key) && (
                        <Link href={`/creator/connect/${a.platforms.key}`} className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary-soft">
                          Connect
                        </Link>
                      )}
                      {!a.is_primary && (
                        <ActionButton action={setPrimaryAccountAction.bind(null, a.id)}>Make primary</ActionButton>
                      )}
                      <ActionButton action={removeAccountAction.bind(null, a.id)} tone="danger" confirm="Click again to remove">
                        Remove
                      </ActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Add an account manually" description="For platforms without a connection. Numbers you type are labelled Self-reported.">
          <AddAccountForm platforms={platforms} needsConsent={!consent} />
        </Section>

        <p className="text-sm text-muted">
          For platforms without a connection, upload screenshots on the Analytics page to request admin verification.
        </p>
      </div>
    </>
  );
}
