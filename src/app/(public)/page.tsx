import { ArrowRight, BadgeCheck, Eye, Lock, MessageCircle, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { brand } from "@/lib/brand";

const platforms = ["Instagram", "TikTok", "YouTube", "Pinterest", "Facebook", "Twitch"];

function SampleCreatorCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-accent/10 to-transparent blur-2xl" />
      <div className="rounded-[18px] border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft font-display text-lg font-bold text-accent-strong">MR</div>
          <div>
            <p className="font-display text-base font-semibold text-ink">
              Mia Rivera <span className="font-sans text-xs font-normal text-muted">(sample profile)</span>
            </p>
            <p className="text-sm text-muted">Wellness · Austin, TX</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge tone="accent">Seeking management</Badge>
          <ProvenanceBadge source="admin_verified" />
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[["84.2K", "Followers"], ["5.8%", "Engagement"], ["+12%", "30-day growth"]].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-canvas py-3">
              <dd className="tabular font-display text-lg font-semibold text-ink">{v}</dd>
              <dt className="text-xs text-muted">{l}</dt>
            </div>
          ))}
        </dl>
        <div className="mt-5 rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-white">Send inquiry</div>
      </div>
      <div className="absolute -bottom-5 -left-6 hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-card)] sm:flex">
        <MessageCircle className="size-4 text-primary" aria-hidden />
        <span className="text-ink">New inquiry from a vetted agency</span>
      </div>
    </div>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ account_deleted?: string }> }) {
  const { account_deleted } = await searchParams;
  return (
    <>
      {account_deleted && (
        <div className="mx-auto max-w-6xl px-5 pt-6">
          <Alert tone="success">Your account and data have been deleted.</Alert>
        </div>
      )}
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-14 pb-20 md:grid-cols-[1.15fr_1fr] md:pt-20">
        <div>
          <Badge tone="primary" className="mb-5">{brand.descriptor}</Badge>
          <h1 className="text-[2.6rem] leading-[1.05] font-bold text-ink sm:text-6xl">
            Get <span className="font-serif font-normal italic text-primary">discovered</span> by the right management team
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Build a professional talent profile, share your numbers on your terms, and hear from vetted
            management companies and talent agencies looking for creators like you.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup" size="lg">
              Create your free profile <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/for-companies" size="lg" variant="secondary">I represent creators</ButtonLink>
          </div>
          <div className="mt-10">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">For creators on</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {platforms.map((p) => (
                <li key={p} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink/80">{p}</li>
              ))}
            </ul>
          </div>
        </div>
        <SampleCreatorCard />
      </section>

      {/* Two sides */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-20 md:grid-cols-2">
          <div className="rounded-[var(--radius-card)] bg-accent-soft/60 p-8">
            <p className="text-sm font-semibold text-accent-strong">For creators</p>
            <h2 className="mt-2 text-3xl font-bold text-ink">Your career, represented well</h2>
            <ul className="mt-6 space-y-4 text-[15px] text-ink/85">
              <li className="flex gap-3"><Sparkles className="size-5 shrink-0 text-accent" aria-hidden />A polished talent profile with your niches, numbers, media kit and best work.</li>
              <li className="flex gap-3"><Eye className="size-5 shrink-0 text-accent" aria-hidden />Field-by-field privacy: public, approved companies only, or private.</li>
              <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-accent" aria-hidden />Only companies TalentLoom has reviewed can contact you — and it's always free to respond.</li>
            </ul>
            <ButtonLink href="/signup" className="mt-8">Join free</ButtonLink>
          </div>
          <div className="rounded-[var(--radius-card)] bg-primary-soft/70 p-8">
            <p className="text-sm font-semibold text-primary-strong">For management companies</p>
            <h2 className="mt-2 text-3xl font-bold text-ink">Scout talent with real signal</h2>
            <ul className="mt-6 space-y-4 text-[15px] text-ink/85">
              <li className="flex gap-3"><Search className="size-5 shrink-0 text-primary" aria-hidden />Search creators who are actively looking for representation, filtered by niche, platform and growth.</li>
              <li className="flex gap-3"><BadgeCheck className="size-5 shrink-0 text-primary" aria-hidden />Every number is labelled: verified from a connected account, verified by our team, or self-reported.</li>
              <li className="flex gap-3"><Users className="size-5 shrink-0 text-primary" aria-hidden />Lists, notes, a recruiting pipeline and your signed roster in one place.</li>
            </ul>
            <ButtonLink href="/for-companies#contact" className="mt-8" variant="secondary">Talk to our team</ButtonLink>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold text-ink sm:text-4xl">How it works</h2>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: "1", t: "Build your profile", d: "Add your platforms, numbers, niches and media kit. Upload proof to get admin-verified." },
            { n: "2", t: "Get discovered", d: "Turn on discoverability. Vetted companies find you by niche, audience and momentum." },
            { n: "3", t: "Choose your team", d: "Review inquiries, message the companies you like, and sign with the right fit." },
          ].map((s) => (
            <li key={s.n} className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink font-display font-bold text-white">{s.n}</span>
              <h3 className="mt-4 text-xl font-semibold text-ink">{s.t}</h3>
              <p className="mt-2 leading-7 text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust band */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[22px] bg-ink px-8 py-12 text-white sm:px-12">
          <div aria-hidden className="absolute -top-20 -right-10 size-72 rounded-full bg-primary/40 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <Lock className="size-6 text-accent" aria-hidden />
              <h2 className="mt-4 text-3xl font-bold">Built for trust from day one</h2>
              <p className="mt-3 max-w-xl leading-7 text-white/75">
                Companies are reviewed before they can reach you. Outreach is limited to stop spam. You can block or
                report anyone, and you can delete your data whenever you want. TalentLoom is for adults 18 and over.
              </p>
            </div>
            <div className="md:text-right">
              <ButtonLink href="/signup" size="lg" variant="accent">Create your free profile</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
