import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";

const socials = [
  {
    href: "https://www.instagram.com/talentloomhq",
    label: "TalentLoom on Instagram",
    path: "M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.9-7.8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM12 3.6c2.7 0 3 0 4.1.1 1 0 1.5.2 1.9.4.5.2.8.4 1.2.8.4.3.6.7.8 1.2.1.4.3.9.4 1.9 0 1 .1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.5-.4 1.9-.2.5-.4.8-.8 1.2-.3.4-.7.6-1.2.8-.4.1-.9.3-1.9.4-1 0-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.5-.2-1.9-.4a3.2 3.2 0 0 1-1.2-.8 3.2 3.2 0 0 1-.8-1.2c-.1-.4-.3-.9-.4-1.9 0-1-.1-1.4-.1-4.1s0-3 .1-4.1c0-1 .2-1.5.4-1.9.2-.5.4-.8.8-1.2.3-.4.7-.6 1.2-.8.4-.1.9-.3 1.9-.4 1 0 1.4-.1 4.1-.1Zm0-1.6c-2.7 0-3.1 0-4.1.1-1.1 0-1.8.2-2.4.5-.7.3-1.2.6-1.8 1.2-.6.6-.9 1.1-1.2 1.8-.2.6-.4 1.3-.5 2.4C2 9 2 9.3 2 12s0 3.1.1 4.1c0 1.1.2 1.8.5 2.4.3.7.6 1.2 1.2 1.8.6.6 1.1.9 1.8 1.2.6.2 1.3.4 2.4.5 1 0 1.4.1 4.1.1s3.1 0 4.1-.1c1.1 0 1.8-.2 2.4-.5.7-.3 1.2-.6 1.8-1.2.6-.6.9-1.1 1.2-1.8.2-.6.4-1.3.5-2.4 0-1 .1-1.4.1-4.1s0-3.1-.1-4.1c0-1.1-.2-1.8-.5-2.4-.3-.7-.6-1.2-1.2-1.8-.6-.6-1.1-.9-1.8-1.2-.6-.2-1.3-.4-2.4-.5-1 0-1.4-.1-4.1-.1Z",
  },
  {
    href: "https://www.tiktok.com/@talentloomhq",
    label: "TalentLoom on TikTok",
    path: "M16.6 2h-3.3v13.1a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .8.1V9a6.1 6.1 0 1 0 5.3 6.1V8.5a7.8 7.8 0 0 0 4.4 1.4V6.6a4.5 4.5 0 0 1-4.4-4.6Z",
  },
];

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/signup", label: "Join as a creator" },
      { href: "/for-companies", label: "For management companies" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/legal/community-guidelines", label: "Community guidelines" },
      { href: "/legal/company-standards", label: "Management company standards" },
      { href: "/legal/creator-data-consent", label: "Creator data consent" },
      { href: "/legal/reporting-appeals", label: "Reporting and appeals" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/acceptable-use", label: "Acceptable use" },
      { href: "/legal/data-deletion", label: "Data deletion requests" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">{brand.description}</p>
          <div className="mt-5 flex items-center gap-3">
            {socials.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}
                className="flex size-10 items-center justify-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink">
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d={s.path} /></svg>
              </a>
            ))}
            <span className="text-sm text-muted">@talentloomhq</span>
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-ink">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted hover:text-ink">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted">
          © {new Date().getFullYear()} {brand.name}. You must be 18 or older to use {brand.name}.
        </p>
      </div>
    </footer>
  );
}
