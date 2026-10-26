import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMPERSONATION_COOKIE, openImpersonation } from "@/lib/admin/impersonation";

export const dynamic = "force-dynamic";

/** Ends "view as user": closes the user's temporary session and restores the admin's own. */
export async function GET() {
  const jar = await cookies();
  const state = openImpersonation(jar.get(IMPERSONATION_COOKIE)?.value);
  const supabase = await createClient();

  // Only this browser's temporary session is closed — the user's own devices stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  jar.delete(IMPERSONATION_COOKIE);

  if (!state) return NextResponse.redirect(new URL("/login", publicEnv.siteUrl()), { status: 303 });

  await createAdminClient().rpc("record_impersonation_end", { p_session_id: state.id });
  const { error } = await supabase.auth.setSession({ access_token: state.adminAccess, refresh_token: state.adminRefresh });
  const target = error ? "/login?next=/admin" : `/admin/users/${state.targetUserId}`;
  return NextResponse.redirect(new URL(target, publicEnv.siteUrl()), { status: 303 });
}
