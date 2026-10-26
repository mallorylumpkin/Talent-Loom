import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { refreshCompleteness } from "@/lib/creator/completeness";
import { encryptJson, OAUTH_STATE_COOKIE, verifyState } from "@/lib/social/crypto";
import { getProvider, ProviderError, redirectUriFor } from "@/lib/social/providers";
import { recordSnapshot } from "@/lib/social/sync";

export const dynamic = "force-dynamic";

function back(params: Record<string, string>) {
  const url = new URL("/creator/social-accounts", publicEnv.siteUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
  return res;
}

/**
 * The platform sends the creator back here after they approve (or cancel).
 * We check the signed state cookie, exchange the one-time code for tokens,
 * confirm which account it is, and save its numbers as API-verified.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: key } = await params;
  const provider = getProvider(key);
  if (!provider || !provider.configured()) return back({ connect_error: "unavailable" });

  const viewer = await getViewer();
  if (!viewer || viewer.accountType !== "creator" || viewer.status !== "active") {
    return NextResponse.redirect(new URL("/login?next=/creator/social-accounts", publicEnv.siteUrl()), { status: 303 });
  }

  const q = request.nextUrl.searchParams;
  const jar = await cookies();
  const state = verifyState(jar.get(OAUTH_STATE_COOKIE)?.value);
  if (!state || state.nonce !== q.get("state") || state.userId !== viewer.id || state.provider !== provider.key) {
    return back({ connect_error: "expired", platform: provider.key });
  }
  if (q.get("error") || !q.get("code")) {
    return back({ connect_error: "cancelled", platform: provider.key });
  }

  try {
    const tokens = await provider.exchangeCode(q.get("code")!, redirectUriFor(provider.key));
    // Most platforms share one account; Facebook can share several Pages at once.
    const accounts = provider.fetchAccounts
      ? await provider.fetchAccounts(tokens)
      : [{ data: await provider.fetchAccount(tokens), tokens }];

    const admin = createAdminClient();
    let connected = 0;
    let syncFailed = false;
    let lastError: string | null = null;
    for (const { data, tokens: accountTokens } of accounts) {
      const { data: accountId, error } = await admin.rpc("attach_oauth_account", {
        p_user_id: viewer.id,
        p_platform_key: provider.key,
        p_external_id: data.externalId,
        p_username: data.username,
        p_url: data.url,
        p_scopes: accountTokens.scopes,
        p_encrypted_tokens: encryptJson(accountTokens),
        p_token_expires_at: accountTokens.expiresAt ?? null,
      });
      if (error || !accountId) {
        console.error("[oauth:attach]", error?.code, error?.message);
        lastError = error?.message === "already_connected_elsewhere" ? "taken"
          : error?.message?.includes("social accounts") ? "limit" : "failed";
        continue;
      }
      connected++;
      const saved = await recordSnapshot(accountId as string, data);
      if (!saved.ok) syncFailed = true;
    }

    const supabase = await createClient();
    const { data: cp } = await supabase.from("creator_profiles").select("id").eq("user_id", viewer.id).single();
    if (cp) await refreshCompleteness(supabase, cp.id);
    if (!connected) return back({ connect_error: lastError ?? "failed", platform: provider.key });
    if (lastError) return back({ connected: provider.key, connect_error: lastError, platform: provider.key });
    return back(syncFailed ? { connected: provider.key, connect_error: "sync" } : { connected: provider.key });
  } catch (e) {
    if (!(e instanceof ProviderError)) console.error("[oauth:callback]", e);
    const code = e instanceof ProviderError
      ? e.message.includes("YouTube channel") ? "no_channel" : e.message.includes("No Facebook Pages") ? "no_pages" : "failed"
      : "failed";
    return back({ connect_error: code, platform: provider.key });
  }
}
