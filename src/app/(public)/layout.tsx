import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { getViewer, homeFor } from "@/lib/auth/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <PublicHeader signedInHref={viewer ? homeFor(viewer) : undefined} />
      <main id="content" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
