import "server-only";
import { publicEnv } from "@/lib/env";

/**
 * Official platform connections. Each provider talks only to the platform's
 * documented OAuth + API endpoints; nothing is scraped or estimated.
 *
 * Engagement rate is calculated the same way for every platform:
 *   (average likes + average comments) ÷ followers × 100
 * over the account's most recent posts (up to 12 on Instagram/YouTube, 20 on TikTok).
 */

export type ProviderKey = "instagram" | "tiktok" | "youtube";
export const PROVIDER_KEYS: ProviderKey[] = ["instagram", "tiktok", "youtube"];

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null; // ISO
  refreshExpiresAt?: string | null;
  obtainedAt: string; // ISO
  scopes: string[];
}

export interface AccountData {
  externalId: string;
  username: string;
  url: string | null;
  followers: number | null;
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  engagementRate: number | null;
  raw: Record<string, unknown>;
}

/** An error whose message is safe to show the creator (never contains tokens). */
export class ProviderError extends Error {
  constructor(message: string, readonly authFailed = false) {
    super(message);
  }
}

export interface Provider {
  key: ProviderKey;
  label: string;
  /** Which kinds of accounts can connect, shown before connecting. */
  requirement: string;
  configured(): boolean;
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  needsRefresh(tokens: TokenSet): boolean;
  refresh(tokens: TokenSet): Promise<TokenSet>;
  fetchAccount(tokens: TokenSet): Promise<AccountData>;
  /** Best effort; some platforms have no revoke endpoint. */
  revoke(tokens: TokenSet): Promise<void>;
}

export function redirectUriFor(key: ProviderKey): string {
  return `${publicEnv.siteUrl()}/api/oauth/${key}/callback`;
}

/* ---------- helpers ---------- */

const TIMEOUT_MS = 15_000;

async function call<T>(label: string, url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ProviderError(`${label} didn't respond. Please try again in a few minutes.`);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    // Log the platform's error code only (never the URL, which can contain tokens).
    const code = typeof body === "object" && body ? JSON.stringify(body).slice(0, 300) : String(res.status);
    console.error(`[social:${label}] HTTP ${res.status}`, code);
    // Meta reports expired/revoked tokens as error code 190; TikTok as access_token_invalid.
    const err = (body as { error?: { code?: unknown } } | null)?.error;
    const authFailed = res.status === 401 || err?.code === 190 || err?.code === "access_token_invalid";
    throw new ProviderError(
      authFailed || res.status === 403
        ? `${label} says the connection is no longer authorized. Please reconnect.`
        : `${label} returned an error (${res.status}). Please try again later.`,
      authFailed,
    );
  }
  return body as T;
}

function form(data: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data).toString(),
  };
}

function isoIn(seconds: number | undefined | null): string | null {
  return typeof seconds === "number" && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;
}

function engagement(followers: number | null, likes: number | null, comments: number | null): number | null {
  if (!followers || followers <= 0 || (likes === null && comments === null)) return null;
  return Math.min(100, Math.round((((likes ?? 0) + (comments ?? 0)) / followers) * 100 * 1000) / 1000);
}

function expiresSoon(iso: string | null | undefined, withinMs: number): boolean {
  return !!iso && new Date(iso).getTime() - Date.now() < withinMs;
}

/* ---------- YouTube (Google OAuth + YouTube Data API v3) ---------- */

const youtube: Provider = {
  key: "youtube",
  label: "YouTube",
  requirement: "Any YouTube channel. Choose the channel's Google account (or Brand Account) when asked.",
  configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  authorizeUrl(state, redirectUri) {
    const p = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  },
  async exchangeCode(code, redirectUri) {
    const t = await call<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>(
      "YouTube",
      "https://oauth2.googleapis.com/token",
      form({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    );
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: isoIn(t.expires_in),
      obtainedAt: new Date().toISOString(),
      scopes: (t.scope ?? "").split(" ").filter(Boolean),
    };
  },
  needsRefresh: (t) => !!t.refreshToken && expiresSoon(t.expiresAt, 5 * 60 * 1000),
  async refresh(t) {
    if (!t.refreshToken) throw new ProviderError("YouTube needs you to reconnect.", true);
    const r = await call<{ access_token: string; expires_in?: number; refresh_token?: string }>(
      "YouTube",
      "https://oauth2.googleapis.com/token",
      form({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: t.refreshToken,
        grant_type: "refresh_token",
      }),
    );
    return { ...t, accessToken: r.access_token, refreshToken: r.refresh_token ?? t.refreshToken, expiresAt: isoIn(r.expires_in), obtainedAt: new Date().toISOString() };
  },
  async fetchAccount(t) {
    const auth = { headers: { Authorization: `Bearer ${t.accessToken}` } };
    const ch = await call<{
      items?: {
        id: string;
        snippet?: { title?: string; customUrl?: string };
        statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean; viewCount?: string; videoCount?: string };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }[];
    }>("YouTube", "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true", auth);
    const channel = ch.items?.[0];
    if (!channel) throw new ProviderError("That Google account doesn't have a YouTube channel. Try again and pick the account that owns your channel.");

    const custom = channel.snippet?.customUrl?.replace(/^@/, "") ?? null;
    const followers = channel.statistics?.hiddenSubscriberCount ? null : num(channel.statistics?.subscriberCount);

    let views: (number | null)[] = [];
    let likes: (number | null)[] = [];
    let comments: (number | null)[] = [];
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      const pl = await call<{ items?: { contentDetails?: { videoId?: string } }[] }>(
        "YouTube",
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=12&playlistId=${encodeURIComponent(uploads)}`,
        auth,
      );
      const ids = (pl.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean) as string[];
      if (ids.length) {
        const v = await call<{ items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(
          "YouTube",
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.map(encodeURIComponent).join(",")}`,
          auth,
        );
        views = (v.items ?? []).map((i) => num(i.statistics?.viewCount));
        likes = (v.items ?? []).map((i) => num(i.statistics?.likeCount));
        comments = (v.items ?? []).map((i) => num(i.statistics?.commentCount));
      }
    }
    const avgLikes = average(likes);
    const avgComments = average(comments);
    return {
      externalId: channel.id,
      username: custom ?? channel.snippet?.title ?? channel.id,
      url: custom ? `https://www.youtube.com/@${custom}` : `https://www.youtube.com/channel/${channel.id}`,
      followers,
      avgViews: average(views),
      avgLikes,
      avgComments,
      engagementRate: engagement(followers, avgLikes, avgComments),
      raw: {
        platform: "youtube",
        subscribers_hidden: !!channel.statistics?.hiddenSubscriberCount,
        total_views: num(channel.statistics?.viewCount),
        video_count: num(channel.statistics?.videoCount),
        recent_videos_sampled: views.length,
      },
    };
  },
  async revoke(t) {
    const token = t.refreshToken ?? t.accessToken;
    await fetch("https://oauth2.googleapis.com/revoke", { ...form({ token }), signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => {});
  },
};

/* ---------- Instagram (Instagram API with Instagram Login) ---------- */

const IG_GRAPH = "https://graph.instagram.com";

const instagram: Provider = {
  key: "instagram",
  label: "Instagram",
  requirement: "Instagram Business or Creator accounts only (switch for free in Instagram → Settings → Account type).",
  configured: () => !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
  authorizeUrl(state, redirectUri) {
    const p = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "instagram_business_basic",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${p}`;
  },
  async exchangeCode(code, redirectUri) {
    // Step 1: short-lived token. (Instagram may append "#_" to the code.)
    const short = await call<
      { access_token?: string; permissions?: string | string[]; data?: { access_token: string; permissions?: string | string[] }[] }
    >(
      "Instagram",
      "https://api.instagram.com/oauth/access_token",
      form({
        client_id: process.env.INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code.replace(/#_$/, ""),
      }),
    );
    const s = short.data?.[0] ?? short;
    if (!s.access_token) throw new ProviderError("Instagram didn't return an access token. Please try again.");
    const perms = Array.isArray(s.permissions) ? s.permissions : (s.permissions ?? "").split(",").filter(Boolean);

    // Step 2: long-lived token (60 days, refreshed by the daily sync).
    const long = await call<{ access_token: string; expires_in?: number }>(
      "Instagram",
      `${IG_GRAPH}/access_token?${new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        access_token: s.access_token,
      })}`,
    );
    return { accessToken: long.access_token, expiresAt: isoIn(long.expires_in), obtainedAt: new Date().toISOString(), scopes: perms };
  },
  // Long-lived tokens can be refreshed once they're 24h old; refresh well before the 60 days run out.
  needsRefresh: (t) =>
    Date.now() - new Date(t.obtainedAt).getTime() > 24 * 3600 * 1000 && expiresSoon(t.expiresAt, 30 * 24 * 3600 * 1000),
  async refresh(t) {
    const r = await call<{ access_token: string; expires_in?: number }>(
      "Instagram",
      `${IG_GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: t.accessToken })}`,
    );
    return { ...t, accessToken: r.access_token, expiresAt: isoIn(r.expires_in), obtainedAt: new Date().toISOString() };
  },
  async fetchAccount(t) {
    const me = await call<{ id: string; user_id?: string | number; username?: string; followers_count?: number; media_count?: number }>(
      "Instagram",
      `${IG_GRAPH}/me?${new URLSearchParams({ fields: "id,user_id,username,followers_count,media_count", access_token: t.accessToken })}`,
    );
    if (!me.username) throw new ProviderError("Instagram didn't return a username for this account.");
    const media = await call<{ data?: { like_count?: number; comments_count?: number }[] }>(
      "Instagram",
      `${IG_GRAPH}/me/media?${new URLSearchParams({ fields: "id,like_count,comments_count,timestamp", limit: "12", access_token: t.accessToken })}`,
    );
    const posts = media.data ?? [];
    const followers = num(me.followers_count);
    const avgLikes = average(posts.map((p) => num(p.like_count)));
    const avgComments = average(posts.map((p) => num(p.comments_count)));
    return {
      externalId: String(me.user_id ?? me.id),
      username: me.username,
      url: `https://www.instagram.com/${me.username}`,
      followers,
      avgViews: null, // needs Instagram's insights permission; not requested yet
      avgLikes,
      avgComments,
      engagementRate: engagement(followers, avgLikes, avgComments),
      raw: { platform: "instagram", media_count: num(me.media_count), recent_posts_sampled: posts.length },
    };
  },
  async revoke() {
    // Instagram Login has no token-revoke endpoint. Tokens are deleted on our side;
    // creators can also remove TalentLoom in Instagram → Settings → Website permissions.
  },
};

/* ---------- TikTok (Login Kit v2 + Display API) ---------- */

const TT_API = "https://open.tiktokapis.com/v2";

interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string };
}

function ttCheck<T>(body: TikTokEnvelope<T>): T {
  if (body.error && body.error.code && body.error.code !== "ok") {
    console.error("[social:TikTok]", body.error.code);
    throw new ProviderError(
      body.error.code === "access_token_invalid" ? "TikTok says the connection is no longer authorized. Please reconnect." : "TikTok returned an error. Please try again later.",
      body.error.code === "access_token_invalid",
    );
  }
  return body.data as T;
}

const tiktok: Provider = {
  key: "tiktok",
  label: "TikTok",
  requirement: "Any public TikTok account.",
  configured: () => !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
  authorizeUrl(state, redirectUri) {
    const p = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      scope: "user.info.basic,user.info.profile,user.info.stats,video.list",
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
  },
  async exchangeCode(code, redirectUri) {
    const t = await call<{
      access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; scope?: string; error?: string;
    }>(
      "TikTok",
      `${TT_API}/oauth/token/`,
      form({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    );
    if (!t.access_token) throw new ProviderError("TikTok didn't return an access token. Please try again.");
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: isoIn(t.expires_in),
      refreshExpiresAt: isoIn(t.refresh_expires_in),
      obtainedAt: new Date().toISOString(),
      scopes: (t.scope ?? "").split(",").filter(Boolean),
    };
  },
  needsRefresh: (t) => !!t.refreshToken && expiresSoon(t.expiresAt, 10 * 60 * 1000),
  async refresh(t) {
    if (!t.refreshToken || (t.refreshExpiresAt && expiresSoon(t.refreshExpiresAt, 0))) {
      throw new ProviderError("TikTok needs you to reconnect.", true);
    }
    const r = await call<{ access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number }>(
      "TikTok",
      `${TT_API}/oauth/token/`,
      form({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: t.refreshToken,
      }),
    );
    if (!r.access_token) throw new ProviderError("TikTok needs you to reconnect.", true);
    return {
      ...t,
      accessToken: r.access_token,
      refreshToken: r.refresh_token ?? t.refreshToken,
      expiresAt: isoIn(r.expires_in),
      refreshExpiresAt: isoIn(r.refresh_expires_in) ?? t.refreshExpiresAt,
      obtainedAt: new Date().toISOString(),
    };
  },
  async fetchAccount(t) {
    const auth = { Authorization: `Bearer ${t.accessToken}` };
    const info = ttCheck(
      await call<TikTokEnvelope<{ user?: {
        open_id?: string; username?: string; display_name?: string; follower_count?: number; likes_count?: number; video_count?: number;
      } }>>(
        "TikTok",
        `${TT_API}/user/info/?fields=open_id,username,display_name,follower_count,likes_count,video_count`,
        { headers: auth },
      ),
    );
    const u = info?.user;
    if (!u?.open_id) throw new ProviderError("TikTok didn't return account details.");
    const username = u.username || u.display_name;
    if (!username) throw new ProviderError("TikTok didn't return a username. Make sure the profile permission was allowed.");

    let videos: { view_count?: number; like_count?: number; comment_count?: number }[] = [];
    if (t.scopes.includes("video.list")) {
      const list = ttCheck(
        await call<TikTokEnvelope<{ videos?: typeof videos }>>(
          "TikTok",
          `${TT_API}/video/list/?fields=id,view_count,like_count,comment_count`,
          { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ max_count: 20 }) },
        ),
      );
      videos = list?.videos ?? [];
    }
    const followers = num(u.follower_count);
    const avgLikes = average(videos.map((v) => num(v.like_count)));
    const avgComments = average(videos.map((v) => num(v.comment_count)));
    return {
      externalId: u.open_id,
      username,
      url: u.username ? `https://www.tiktok.com/@${u.username}` : null,
      followers,
      avgViews: average(videos.map((v) => num(v.view_count))),
      avgLikes,
      avgComments,
      engagementRate: engagement(followers, avgLikes, avgComments),
      raw: { platform: "tiktok", total_likes: num(u.likes_count), video_count: num(u.video_count), recent_videos_sampled: videos.length },
    };
  },
  async revoke(t) {
    await fetch(`${TT_API}/oauth/revoke/`, {
      ...form({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, token: t.accessToken }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => {});
  },
};

const PROVIDERS: Record<ProviderKey, Provider> = { instagram, tiktok, youtube };

export function getProvider(key: string): Provider | null {
  return (PROVIDER_KEYS as string[]).includes(key) ? PROVIDERS[key as ProviderKey] : null;
}

/** Providers whose developer-app keys are set in the environment. */
export function configuredProviders(): Provider[] {
  return PROVIDER_KEYS.map((k) => PROVIDERS[k]).filter((p) => p.configured());
}
