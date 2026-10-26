import { Building2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { publicStorageUrl } from "@/lib/uploads";

export function PersonAvatar({ name, path, size = "md" }: { name: string; path: string | null; size?: "sm" | "md" | "lg" }) {
  const url = publicStorageUrl("avatars", path);
  const initials = name.replace(/\(.*?\)/g, "").split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent-strong",
      size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm")}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

export function CompanyLogo({ path, size = "md" }: { path: string | null; size?: "sm" | "md" | "lg" }) {
  const url = publicStorageUrl("company-logos", path);
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface text-muted",
      size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-10")}>
      {url ? <img src={url} alt="" className="size-full object-contain p-1" /> : <Building2 className="size-1/2" aria-hidden />}
    </span>
  );
}
