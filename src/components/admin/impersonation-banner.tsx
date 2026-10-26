import { Eye } from "lucide-react";
import { getImpersonation } from "@/lib/admin/impersonation";

/** Shown on every page while an admin is viewing as a user. */
export async function ImpersonationBanner() {
  const imp = await getImpersonation();
  if (!imp) return null;
  const expired = Date.now() > imp.expiresAt;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-center gap-3 bg-warning px-4 text-sm font-medium text-ink">
      <Eye className="size-4 shrink-0" aria-hidden />
      <span className="truncate">
        {expired ? "Your view-as session has expired." : <>Viewing as <strong>{imp.targetName}</strong> · read-only · logged</>}
      </span>
      <a href="/impersonation/exit" className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink/85">
        Exit
      </a>
    </div>
  );
}
