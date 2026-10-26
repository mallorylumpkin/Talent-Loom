import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncConnectedAccount } from "@/lib/social/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily refresh of connected accounts (Vercel Cron, see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
 * Syncs the accounts that haven't synced for 20+ hours, a batch at a time.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("social_connections")
    .select("social_account_id")
    .eq("status", "active")
    .or(`last_attempt_at.is.null,last_attempt_at.lt."${cutoff}"`)
    .order("last_attempt_at", { ascending: true, nullsFirst: true })
    .limit(40);
  if (error) {
    console.error("[cron:sync-social]", error.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  let ok = 0;
  let failed = 0;
  const started = Date.now();
  for (const row of data ?? []) {
    if (Date.now() - started > 50_000) break; // stay inside the function time limit; the rest go tomorrow
    const result = await syncConnectedAccount(row.social_account_id as string);
    if (result.ok) ok++;
    else failed++;
  }
  return NextResponse.json({ synced: ok, failed, remaining: Math.max(0, (data?.length ?? 0) - ok - failed) });
}
