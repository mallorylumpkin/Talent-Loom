import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * ⚠️  SERVICE-ROLE CLIENT — BYPASSES ROW LEVEL SECURITY.
 *
 * Only for: Supabase Auth admin operations (creating company accounts,
 * deleting users, impersonation sessions), Stripe webhooks, and seeding.
 * Always verify the caller's permissions BEFORE using it, and always write
 * an audit entry for admin actions. The `server-only` import makes the build
 * fail if this file is ever imported into browser code.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Missing SUPABASE_SECRET_KEY (server-only). See docs/SETUP.md.");
  }
  return createSupabaseClient(publicEnv.supabaseUrl(), secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
