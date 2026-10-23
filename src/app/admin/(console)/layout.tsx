import { AppShell } from "@/components/layout/app-shell";
import { adminNav } from "@/components/layout/nav-config";
import { requireAdmin } from "@/lib/auth/session";

// Every page in the admin console requires a super admin with an MFA session.
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <AppShell
      nav={adminNav}
      homeHref="/admin"
      tone="admin"
      user={{ name: viewer.displayName ?? viewer.email, email: viewer.email, roleLabel: "Super admin" }}
    >
      {children}
    </AppShell>
  );
}
