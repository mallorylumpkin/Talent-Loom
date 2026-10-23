import { BadgeCheck, Link2, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "sponsored";

const tones: Record<Tone, string> = {
  neutral: "border border-line text-muted bg-surface",
  primary: "bg-primary-soft text-primary-strong",
  accent: "bg-accent-soft text-accent-strong",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  sponsored: "bg-sponsored-soft text-sponsored",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/**
 * Analytics provenance. Use this EVERYWHERE numbers are shown so creators and
 * companies always know where a number came from. Never call manual numbers "verified".
 */
export function ProvenanceBadge({ source }: { source: "self_reported" | "admin_verified" | "api_verified" }) {
  if (source === "admin_verified") {
    return (
      <Badge tone="success">
        <BadgeCheck className="size-3.5" aria-hidden /> Admin-verified
      </Badge>
    );
  }
  if (source === "api_verified") {
    return (
      <Badge tone="primary">
        <Link2 className="size-3.5" aria-hidden /> API-verified
      </Badge>
    );
  }
  return (
    <Badge tone="neutral">
      <PenLine className="size-3.5" aria-hidden /> Self-reported
    </Badge>
  );
}

/** Paid visibility must always be labelled. */
export function SponsoredBadge() {
  return <Badge tone="sponsored">Sponsored</Badge>;
}
