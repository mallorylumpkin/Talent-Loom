import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJson, encryptJson } from "./crypto";
import { getProvider, ProviderError, type AccountData, type TokenSet } from "./providers";

/**
 * Server-only sync of one connected account: refresh the token if needed,
 * read the numbers from the platform and store them as API-verified.
 * Uses the service-role client — callers must check the creator owns the account
 * (the cron job syncs everyone's).
 */
export async function syncConnectedAccount(accountId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("social_connections")
    .select("social_account_id, provider, status, encrypted_tokens, social_accounts!inner(external_account_id, handle, connection_type, deleted_at)")
    .eq("social_account_id", accountId)
    .maybeSingle();
  const account = (conn as unknown as { social_accounts: { external_account_id: string | null; handle: string; connection_type: string; deleted_at: string | null } } | null)
    ?.social_accounts;
  if (!conn || conn.status !== "active" || !conn.encrypted_tokens || !account || account.connection_type !== "oauth" || account.deleted_at) {
    return { ok: false, message: "This account isn't connected." };
  }
  const provider = getProvider(conn.provider);
  if (!provider?.configured()) {
    return { ok: false, message: `${provider?.label ?? "This platform"} connections aren't set up on TalentLoom right now.` };
  }

  const now = new Date().toISOString();
  try {
    let tokens = decryptJson<TokenSet>(conn.encrypted_tokens);
    if (provider.needsRefresh(tokens)) {
      tokens = await provider.refresh(tokens);
      await admin
        .from("social_connections")
        .update({ encrypted_tokens: encryptJson(tokens), token_expires_at: tokens.expiresAt ?? null })
        .eq("social_account_id", accountId);
    }

    const data = await provider.fetchAccount(tokens);
    if (account.external_account_id && data.externalId !== account.external_account_id) {
      throw new ProviderError(`${provider.label} returned a different account than the one connected. Please reconnect.`, true);
    }
    const saved = await recordSnapshot(accountId, data);
    if (!saved.ok) throw new ProviderError(saved.message);

    // Keep the handle in step with the platform (renames happen).
    if (data.username && data.username !== account.handle) {
      await admin.from("social_accounts").update({ handle: data.username.slice(0, 100), url: data.url }).eq("id", accountId);
      await admin.from("social_connections").update({ external_username: data.username }).eq("social_account_id", accountId);
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : "We couldn't sync this account. Please try again later.";
    if (!(e instanceof ProviderError)) console.error("[social:sync]", e);
    const authFailed = e instanceof ProviderError && e.authFailed;
    await admin
      .from("social_connections")
      .update({ last_error: message.slice(0, 500), last_attempt_at: now, ...(authFailed ? { status: "expired" } : {}) })
      .eq("social_account_id", accountId);
    return { ok: false, message };
  }
}

export async function recordSnapshot(accountId: string, d: AccountData): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_api_snapshot", {
    p_account_id: accountId,
    p_followers: d.followers,
    p_avg_views: d.avgViews,
    p_avg_likes: d.avgLikes,
    p_avg_comments: d.avgComments,
    p_engagement_rate: d.engagementRate,
    p_raw: d.raw,
  });
  if (error) {
    console.error("[social:record]", error.code, error.message);
    return { ok: false, message: "We read your numbers but couldn't save them. Please try again." };
  }
  return { ok: true };
}

/** Disconnect: revoke at the platform (best effort), then wipe tokens. Past verified snapshots stay, labelled with their date. */
export async function disconnectAccount(accountId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("social_connections")
    .select("provider, encrypted_tokens")
    .eq("social_account_id", accountId)
    .maybeSingle();
  if (conn?.encrypted_tokens) {
    const provider = getProvider(conn.provider);
    try {
      if (provider?.configured()) await provider.revoke(decryptJson<TokenSet>(conn.encrypted_tokens));
    } catch (e) {
      console.error("[social:revoke]", e instanceof Error ? e.message : e);
    }
  }
  const { error } = await admin.rpc("disconnect_oauth_account", { p_account_id: accountId });
  if (error) throw new Error(`disconnect failed: ${error.message}`);
}
