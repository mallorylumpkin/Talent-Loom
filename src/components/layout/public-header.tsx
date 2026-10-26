"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const links = [
  { href: "/creators", label: "Creators" },
  { href: "/for-companies", label: "For companies" },
  { href: "/pricing", label: "Pricing" },
];

export function PublicHeader({ signedInHref }: { signedInHref?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={cn("rounded-lg px-3 py-2 text-[15px] font-medium transition-colors",
                pathname === l.href ? "text-ink" : "text-ink/70 hover:text-ink")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedInHref ? (
            <ButtonLink href={signedInHref} size="sm">Go to dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
              <ButtonLink href="/signup" size="sm">Join free</ButtonLink>
            </>
          )}
        </div>
        <button type="button" className="rounded-lg p-2 text-ink hover:bg-ink/5 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-canvas px-5 pt-3 pb-5 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-2 py-3 text-base font-medium text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {signedInHref ? (
              <ButtonLink href={signedInHref} className="col-span-2">Go to dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary">Sign in</ButtonLink>
                <ButtonLink href="/signup">Join free</ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
