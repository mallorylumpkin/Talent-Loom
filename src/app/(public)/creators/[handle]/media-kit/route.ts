import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Opens a creator's media kit if (and only if) their privacy settings make it public.
 * The file stays in a private bucket; visitors get a 5-minute signed link.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(handle)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_creator_profile", { p_handle: handle });
  const path = (data as { media_kit_path?: string | null } | null)?.media_kit_path;
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: signed } = await createAdminClient().storage.from("media-kits").createSignedUrl(path, 300);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
