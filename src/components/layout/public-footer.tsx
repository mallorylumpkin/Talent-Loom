import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";

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
