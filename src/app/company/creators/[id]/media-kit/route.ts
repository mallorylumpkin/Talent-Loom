import { NextResponse, type NextRequest } from "next/server";
import { requireCompany } from "@/lib/company/context";
import { createAdminClient } from "@/lib/supabase/admin";

/** Media kit for a company viewer — only returned when the creator's privacy settings allow this company to see it. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { supabase, company } = await requireCompany();
  const { data } = await supabase.rpc("get_creator_for_company", { p_company_id: company.id, p_creator_id: id });
  const path = (data as { media_kit_path?: string | null } | null)?.media_kit_path;
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: signed } = await createAdminClient().storage.from("media-kits").createSignedUrl(path, 300);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
