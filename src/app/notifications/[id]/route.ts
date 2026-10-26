import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

/** Opening a notification marks it read, then follows its link (site-relative paths only). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  let target = "/";
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const { data } = await supabase.from("notifications").select("link").eq("id", id).maybeSingle();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    if (typeof data?.link === "string" && data.link.startsWith("/") && !data.link.startsWith("//")) target = data.link;
  }
  return NextResponse.redirect(new URL(target, publicEnv.siteUrl()), { status: 303 });
}
