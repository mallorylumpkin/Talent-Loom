import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Stripe REST client (no SDK needed). Uses STRIPE_SECRET_KEY — keep it
 * a TEST key (sk_test_…) until you're ready to take real payments.
 * The API version is pinned so response shapes don't change underneath us.
 */
const API = "https://api.stripe.com/v1";
export const STRIPE_API_VERSION = "2025-03-31.basil";

// Trimmed, so a stray space or line break pasted into Vercel doesn't break it.
function secretKey(): string {
  return (process.env.STRIPE_SECRET_KEY ?? "").trim().replace(/^["']|["']$/g, "");
}
export function stripeConfigured(): boolean {
  return /^(sk|rk)_(test|live)_/.test(secretKey());
}
export function stripeTestMode(): boolean {
  return secretKey().includes("_test_");
}

type Params = Record<string, unknown>;

/** Stripe's form encoding: nested objects as a[b]=c, arrays as a[0]=x. */
function encode(params: Params, prefix = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") encode(item as Params, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      encode(v as Params, key, out);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export class StripeError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export async function stripe<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {},
  idempotencyKey?: string): Promise<T> {
  const key = secretKey();
  if (!key) throw new StripeError("Stripe isn't set up yet (STRIPE_SECRET_KEY is missing).");
  const body = encode(params).join("&");
  const url = method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method !== "GET" ? body : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } } & T;
  if (!res.ok) {
    console.error("[stripe]", method, path, res.status, json.error?.code, json.error?.message);
    throw new StripeError(json.error?.message ?? `Stripe error ${res.status}`, json.error?.code);
  }
  return json;
}

/** Verifies the Stripe-Signature header (HMAC-SHA256, 5-minute tolerance). */
export function verifyWebhook(payload: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return header.split(",").filter((p) => p.startsWith("v1=")).some((p) => {
    const given = Buffer.from(p.slice(3), "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export const toIso = (unix: unknown) => (typeof unix === "number" && unix > 0 ? new Date(unix * 1000).toISOString() : null);
