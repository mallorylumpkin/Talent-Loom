import Link from "next/link";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/cn";

/** Woven-thread mark: three interlaced threads forming a play button. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#5B3DF5" />
      <path d="M11 8.5 L24 16 L11 23.5 Z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M8 13 C13 11, 19 21, 26 18" fill="none" stroke="#FF6B57" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 19 C13 21, 18 12, 25 13.5" fill="none" stroke="#FFE9E5" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
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
