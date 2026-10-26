"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCreatorContext, grantConsent } from "@/lib/creator/context";
import { refreshCompleteness } from "@/lib/creator/completeness";
import { dbErrorMessage, uuid } from "@/lib/actions/helpers";
import type { FormState } from "@/lib/actions/types";
import { publicEnv } from "@/lib/env";
import { newNonce, OAUTH_STATE_COOKIE, signState, tokenEncryptionConfigured } from "@/lib/social/crypto";
import { getProvider, redirectUriFor } from "@/lib/social/providers";
import { disconnectAccount, syncConnectedAccount } from "@/lib/social/sync";

const PATHS = ["/creator", "/creator/social-accounts", "/creator/analytics"];

/** Records consent, then sends the creator to the platform's own sign-in page. */
export async function startConnectAction(providerKey: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { viewer, supabase } = await getCreatorContext();
  const provider = getProvider(providerKey);
  if (!provider || !provider.configured() || !tokenEncryptionConfigured()) {
    return { message: "This connection isn't available yet." };
  }
  if (fd.get("connectConsent") !== "on") {
    return { errors: { connectConsent: "Please confirm this to connect your account" } };
  }
  for (const type of ["creator_data_consent", "platform_connection"]) {
    const error = await grantConsent(supabase, viewer.id, type);
    if (error) return { message: dbErrorMessage(error) };
  }

  const nonce = newNonce();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, signState({ nonce, userId: viewer.id, provider: provider.key, issuedAt: Date.now() }), {
    httpOnly: true,
    secure: publicEnv.siteUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/api/oauth",
    maxAge: 15 * 60,
  });
  redirect(provider.authorizeUrl(nonce, redirectUriFor(provider.key)));
}

async function ownedConnectedAccount(accountId: string) {
  const { supabase, creator } = await getCreatorContext();
  if (!uuid.safeParse(accountId).success) return null;
  const { data } = await supabase
    .from("social_accounts")
    .select("id, connection_type, social_connections(last_attempt_at)")
    .eq("id", accountId)
    .eq("creator_id", creator.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const conn = (data as unknown as { social_connections: { last_attempt_at: string | null } | { last_attempt_at: string | null }[] | null })
    .social_connections;
  const lastAttempt = Array.isArray(conn) ? conn[0]?.last_attempt_at : conn?.last_attempt_at;
  return { id: data.id as string, connected: data.connection_type === "oauth", lastAttempt: lastAttempt ?? null, supabase, creator };
}

export async function syncNowAction(accountId: string): Promise<FormState> {
  const acct = await ownedConnectedAccount(accountId);
  if (!acct?.connected) return { message: "This account isn't connected." };
  if (acct.lastAttempt && Date.now() - new Date(acct.lastAttempt).getTime() < 10 * 60 * 1000) {
    return { message: "Synced recently — please wait a few minutes before syncing again." };
  }
  const result = await syncConnectedAccount(acct.id);
  if (!result.ok) {
    for (const p of PATHS) revalidatePath(p);
    return { message: result.message };
  }
  await refreshCompleteness(acct.supabase, acct.creator.id);
  for (const p of PATHS) revalidatePath(p);
  return { ok: true, message: "Numbers updated" };
}

export async function disconnectAction(accountId: string): Promise<FormState> {
  const acct = await ownedConnectedAccount(accountId);
  if (!acct) return { message: "Account not found" };
  try {
    await disconnectAccount(acct.id);
  } catch (e) {
    console.error("[social:disconnect]", e);
    return { message: "We couldn't disconnect this account. Please try again." };
  }
  for (const p of PATHS) revalidatePath(p);
  return { ok: true, message: "Disconnected" };
}
