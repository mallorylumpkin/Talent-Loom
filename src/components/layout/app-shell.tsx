"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AtSign, BadgeCheck, Bell, Bookmark, Building2, ChartNoAxesColumn, Columns3, CreditCard, Download,
  Eye, FileText, Flag, Handshake, Images, Inbox, LayoutDashboard, LifeBuoy, LogOut, Menu, MessageCircle,
  Percent, Scale, ScrollText, Search, Send, Settings, Shapes, Sparkles, Tags, Ticket, UserRound, Users,
  UsersRound, X, type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import type { NavSection } from "./nav-config";

const icons: Record<string, LucideIcon> = {
  AtSign, BadgeCheck, Bell, Bookmark, Building2, ChartNoAxesColumn, Columns3, CreditCard, Download, Eye,
  FileText, Flag, Handshake, Images, Inbox, LayoutDashboard, LifeBuoy, MessageCircle, Percent, Scale,
  ScrollText, Search, Send, Settings, Shapes, Sparkles, Tags, Ticket, UserRound, Users, UsersRound,
};

interface ShellProps {
  nav: NavSection[];
  homeHref: string;
  user: { name: string; email: string; roleLabel: string };
  tone?: "light" | "admin";
  banner?: React.ReactNode;
  /** Unread counts keyed by nav href, shown as small pills. */
  badges?: Record<string, number>;
  children: React.ReactNode;
}

function NavList({ nav, pathname, homeHref, onNavigate, dark, badges }: {
  nav: NavSection[]; pathname: string; homeHref: string; onNavigate?: () => void; dark: boolean; badges?: Record<string, number>;
}) {
  return (
    <nav aria-label="Main" className="space-y-6">
      {nav.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && (
            <p className={cn("mb-2 px-3 text-xs font-semibold tracking-wide uppercase", dark ? "text-white/45" : "text-muted")}>
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = icons[item.icon] ?? LayoutDashboard;
              const active = item.href === homeHref ? pathname === item.href : pathname.startsWith(item.href);
              const itemClass = cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                dark
                  ? active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  : active ? "bg-primary-soft text-primary-strong" : "text-ink/75 hover:bg-ink/5 hover:text-ink",
              );
              if (item.phase) {
                return (
                  <li key={item.href}>
                    <span className={cn(itemClass, "cursor-not-allowed opacity-50 hover:bg-transparent")} aria-disabled="true"
                      title={`Arrives in build phase ${item.phase}`}>
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", dark ? "bg-white/10" : "bg-ink/5")}>Soon</span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link href={item.href} className={itemClass} aria-current={active ? "page" : undefined} onClick={onNavigate}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {!!badges?.[item.href] && (
                      <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white"
                        aria-label={`${badges[item.href]} new`}>
                        {badges[item.href] > 99 ? "99+" : badges[item.href]}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserBlock({ user, dark }: { user: ShellProps["user"]; dark: boolean }) {
  const initials = user.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div className={cn("flex items-center gap-3 border-t pt-4", dark ? "border-white/10" : "border-line")}>
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        dark ? "bg-white/10 text-white" : "bg-accent-soft text-accent-strong")}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", dark ? "text-white" : "text-ink")}>{user.name}</p>
        <p className={cn("truncate text-xs", dark ? "text-white/50" : "text-muted")}>{user.roleLabel}</p>
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" aria-label="Sign out" title="Sign out"
          className={cn("rounded-lg p-2", dark ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-ink/5 hover:text-ink")}>
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export function AppShell({ nav, homeHref, user, tone = "light", banner, badges, children }: ShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dark = tone === "admin";

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="px-2">
        <Logo href={homeHref} showDescriptor={false} />
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavList nav={nav} pathname={pathname} homeHref={homeHref} dark={dark} badges={badges} onNavigate={() => setOpen(false)} />
      </div>
      <UserBlock user={user} dark={dark} />
    </div>
  );

  return (
    <div className="min-h-dvh">
      {banner}
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block",
        dark ? "border-white/10 bg-ink [&_.font-display]:text-white" : "border-line bg-surface", banner && "top-10")}>
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Logo href={homeHref} showDescriptor={false} />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
          className="rounded-lg p-2 text-ink hover:bg-ink/5">
          <Menu className="size-5" aria-hidden />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className={cn("absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-[var(--shadow-pop)]",
            dark ? "bg-ink [&_.font-display]:text-white" : "bg-surface")}>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"
              className={cn("absolute top-4 right-3 rounded-lg p-2", dark ? "text-white/70 hover:bg-white/10" : "text-muted hover:bg-ink/5")}>
              <X className="size-5" aria-hidden />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
