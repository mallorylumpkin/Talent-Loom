import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { creatorNav } from "@/components/layout/nav-config";
import { LiveRefresh } from "@/components/messaging/live-refresh";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { getImpersonation } from "@/lib/admin/impersonation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("creator", "/creator");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_badges");
  const b = (data ?? {}) as { messages?: number; notifications?: number; inquiries?: number };
  const viewingAs = await getImpersonation();
  if (viewingAs && Date.now() > viewingAs.expiresAt) redirect("/impersonation/exit");
  return (
    <AppShell
      banner={viewingAs ? <ImpersonationBanner /> : undefined}
      nav={creatorNav}
      homeHref="/creator"
      user={{ name: viewer.displayName ?? viewer.email, email: viewer.email, roleLabel: "Creator" }}
      badges={{ "/creator/inquiries": b.inquiries ?? 0, "/creator/messages": b.messages ?? 0, "/creator/notifications": b.notifications ?? 0 }}
    >
      <LiveRefresh table="notifications" filter={`user_id=eq.${viewer.id}`} channel={`notifications:${viewer.id}`} />
      {children}
    </AppShell>
  );
}
