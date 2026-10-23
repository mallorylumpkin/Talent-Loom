import { AppShell } from "@/components/layout/app-shell";
import { creatorNav } from "@/components/layout/nav-config";
import { requireRole } from "@/lib/auth/session";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("creator", "/creator");
  return (
    <AppShell
      nav={creatorNav}
      homeHref="/creator"
      user={{ name: viewer.displayName ?? viewer.email, email: viewer.email, roleLabel: "Creator" }}
    >
      {children}
    </AppShell>
  );
}
