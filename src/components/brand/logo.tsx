import Link from "next/link";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/cn";

/** Linked Loops mark: two interlocking rings (creator + company). Same artwork as the favicon and app icon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-14 -14 148 148" className={cn("size-8", className)} aria-hidden>
      <rect x="-14" y="-14" width="148" height="148" rx="34" fill="#FAF7F2"/><circle cx="41.40" cy="60" r="30" fill="none" stroke="#5B3DF5" strokeWidth="12"/><circle cx="78.60" cy="60" r="30" fill="none" stroke="#FAF7F2" strokeWidth="19"/><circle cx="78.60" cy="60" r="30" fill="none" stroke="#FF6B57" strokeWidth="12"/><path d="M48.79,30.92 A30,30 0 0 1 67.98,46.09" fill="none" stroke="#FAF7F2" strokeWidth="19"/><path d="M45.25,30.25 A30,30 0 0 1 69.46,49.37" fill="none" stroke="#5B3DF5" strokeWidth="12"/>
    </svg>
  );
}

export function Logo({ href = "/", showDescriptor = true }: { href?: string; showDescriptor?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5" aria-label={`${brand.name} home`}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-bold tracking-tight text-ink">{brand.name}</span>
        {showDescriptor && (
          <span className="mt-0.5 hidden text-[11px] font-medium tracking-wide text-muted sm:block">
            {brand.descriptor}
          </span>
        )}
      </span>
    </Link>
  );
}
