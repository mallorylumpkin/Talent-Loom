import { AppShell } from "@/components/layout/app-shell";
import { companyNav } from "@/components/layout/nav-config";
import { LiveRefresh } from "@/components/messaging/live-refresh";
import { getCompanyContext } from "@/lib/company/context";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { viewer, supabase, company } = await getCompanyContext();
  const { data } = await supabase.rpc("my_badges", { p_company_id: company?.id ?? null });
  const b = (data ?? {}) as { messages?: number; notifications?: number };
  return (
    <AppShell
      nav={companyNav}
      homeHref="/company"
      user={{ name: viewer.displayName ?? viewer.email, email: viewer.email, roleLabel: "Management company" }}
      badges={{ "/company/messages": b.messages ?? 0, "/company/notifications": b.notifications ?? 0 }}
    >
      <LiveRefresh table="notifications" filter={`user_id=eq.${viewer.id}`} channel={`notifications:${viewer.id}`} />
      {children}
    </AppShell>
  );
}
