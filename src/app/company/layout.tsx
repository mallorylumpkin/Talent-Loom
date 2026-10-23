import { AppShell } from "@/components/layout/app-shell";
import { companyNav } from "@/components/layout/nav-config";
import { requireRole } from "@/lib/auth/session";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("company_member", "/company");
  return (
    <AppShell
      nav={companyNav}
      homeHref="/company"
      user={{ name: viewer.displayName ?? viewer.email, email: viewer.email, roleLabel: "Management company" }}
    >
      {children}
    </AppShell>
  );
}
