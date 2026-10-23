import type { Metadata } from "next";
import { BadgeCheck, Columns3, Filter, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LeadForm } from "./lead-form";

export const metadata: Metadata = {
  title: "For management companies",
  description: "Scout creators who are actively seeking representation. Request access to TalentLoom.",
};

const benefits = [
  { icon: Filter, title: "Search with real signal", body: "Filter by niche, platform, location, follower range, engagement, growth and whether creators are actively seeking management." },
  { icon: BadgeCheck, title: "Know where numbers come from", body: "Every metric is clearly labelled self-reported, admin-verified or API-verified." },
  { icon: Columns3, title: "A recruiting pipeline", body: "Move prospects from Discovered to Signed, with shared notes and team assignments." },
  { icon: MessageCircle, title: "Respectful outreach", body: "Send representation inquiries and message creators who accept — no cold-DM chaos." },
  { icon: Users, title: "Built for teams", body: "Seats, roles and permissions so the right people see the right things." },
  { icon: ShieldCheck, title: "A trusted network", body: "Companies are reviewed before activation, which is why creators trust the inquiries they receive." },
];

export default async function ForCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-12">
        <p className="text-sm font-semibold text-primary-strong">For management companies and talent agencies</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-bold text-ink sm:text-5xl">
          Find your next signing <span className="font-serif font-normal italic text-primary">before</span> everyone else does
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
          TalentLoom is where growing creators go when they're ready for representation. Request access and our team will
          set up your workspace.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <Icon className="size-6 text-primary" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section id="contact" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-3xl font-bold text-ink">Request access</h2>
            <p className="mt-3 leading-7 text-muted">
              Tell us a little about your company. We'll review it, set up your workspace and plan, and send your team
              their invitations.
            </p>
            <ol className="mt-8 space-y-4 text-sm">
              {["We review your company (usually within 2 business days)", "We set up your workspace and plan",
                "You invite your team and start scouting"].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong">{i + 1}</span>
                  <span className="text-ink/85">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <Card className="relative p-6 sm:p-8">
            <LeadForm defaultPlan={plan} />
          </Card>
        </div>
      </section>
    </>
  );
}
