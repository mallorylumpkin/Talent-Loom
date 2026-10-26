import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Platform access tokens are encrypted with AES-256-GCM before they reach the
 * database, using a key that only exists in the server's environment
 * (TOKEN_ENCRYPTION_KEY). A database leak alone can't use them.
 */
function secret(): string {
  const value = process.env.TOKEN_ENCRYPTION_KEY;
  if (!value || value.length < 32) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY (32+ random characters, server only). See docs/SOCIAL-CONNECTIONS.md.");
  }
  return value;
}

export function tokenEncryptionConfigured(): boolean {
  return (process.env.TOKEN_ENCRYPTION_KEY ?? "").length >= 32;
}

function key(purpose: "tokens" | "oauth-state"): Buffer {
  return Buffer.from(hkdfSync("sha256", secret(), "talentloom", purpose, 32));
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("tokens"), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

export function decryptJson<T>(payload: string): T {
  if (!payload.startsWith("v1.")) throw new Error("Unknown token format");
  const raw = Buffer.from(payload.slice(3), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key("tokens"), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  return JSON.parse(text) as T;
}

/* ---------- Signed OAuth state (protects against forged callbacks) ---------- */

export const OAUTH_STATE_COOKIE = "tl_oauth_state";

export interface OAuthState {
  nonce: string;
  userId: string;
  provider: string;
  issuedAt: number;
}

export function newNonce(): string {
  return randomBytes(24).toString("base64url");
}

export function signState(state: OAuthState): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const mac = createHmac("sha256", key("oauth-state")).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** Returns the state if the signature is valid and it's less than 15 minutes old. */
export function verifyState(value: string | undefined): OAuthState | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key("oauth-state")).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (Date.now() - state.issuedAt > 15 * 60 * 1000) return null;
    return state;
  } catch {
    return null;
  }
}
