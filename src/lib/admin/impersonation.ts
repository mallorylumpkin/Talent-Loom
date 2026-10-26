import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Support impersonation ("view as user").
 *
 * - Only an MFA-verified super admin can start it, and never for another admin.
 * - The admin's own session is kept in an encrypted, httpOnly cookie and restored on exit.
 * - The user's session created for it is READ-ONLY: the database refuses every write from
 *   that session (see private.is_impersonated_session), and the proxy blocks form actions.
 * - Start, end, admin, user and reason are written to the audit log. Passwords are never seen.
 */
export const IMPERSONATION_COOKIE = "tl_imp";
export const IMPERSONATION_MINUTES = 30;

export interface ImpersonationState {
  id: string;
  targetUserId: string;
  targetName: string;
  home: string;
  adminAccess: string;
  adminRefresh: string;
  expiresAt: number;
}

function key(): Buffer {
  const secret = process.env.IMPERSONATION_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new Error("Missing IMPERSONATION_COOKIE_SECRET (32+ random characters).");
  return Buffer.from(hkdfSync("sha256", secret, "talentloom", "impersonation", 32));
}

export function impersonationConfigured(): boolean {
  return (process.env.IMPERSONATION_COOKIE_SECRET ?? "").length >= 32;
}

export function sealImpersonation(state: ImpersonationState): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(state), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function openImpersonation(value: string | undefined): ImpersonationState | null {
  if (!value || !impersonationConfigured()) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as ImpersonationState;
  } catch {
    return null;
  }
}

/** Current impersonation (if this browser is viewing as someone). */
export async function getImpersonation(): Promise<ImpersonationState | null> {
  const jar = await cookies();
  return openImpersonation(jar.get(IMPERSONATION_COOKIE)?.value);
}

/** Reads one claim from a JWT without verifying it (the token came straight from Supabase). */
export function jwtClaim(token: string, claim: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const v = payload[claim];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}
