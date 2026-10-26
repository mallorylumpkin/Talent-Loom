import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, Circle, ExternalLink, Inbox, PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCreatorContext } from "@/lib/creator/context";
import { refreshCompleteness } from "@/lib/creator/completeness";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CreatorDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { viewer, supabase, creator } = await getCreatorContext();
  if (!viewer.onboardingCompletedAt) redirect("/creator/onboarding");
  const { welcome } = await searchParams;

  const [{ items, pct }, { count: inquiryCount }, { data: plan }] = await Promise.all([
    refreshCompleteness(supabase, creator.id),
    supabase.from("representation_inquiries").select("id", { count: "exact", head: true }).in("status", ["sent", "viewed"]),
    supabase.from("subscriptions").select("status, plans(name)").eq("owner_type", "user").eq("owner_id", viewer.id)
      .in("status", ["active", "trialing", "complimentary"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const firstName = (creator.display_name ?? viewer.displayName ?? "there").split(" ")[0];
  const planName = (plan?.plans as { name?: string } | null)?.name ?? "Creator Free";
  const todo = items.filter((i) => !i.done);

  return (
    <>
      <PageHeader
        title={<>Hi {firstName} <span className="font-serif font-normal italic text-accent">— welcome in.</span></>}
        description="Your talent profile is your pitch to management companies. Here's where it stands."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{planName}</Badge>
            {creator.handle && (
              <ButtonLink href={`/creators/${creator.handle}`} variant="secondary" size="sm" target="_blank">
                View my page <ExternalLink className="size-3.5" aria-hidden />
              </ButtonLink>
            )}
          </div>
        }
      />

      {welcome && (
        <Alert tone="success" className="mb-6" title="You're all set up">
          <span className="inline-flex items-center gap-1.5">
            <PartyPopper className="size-4" aria-hidden />
            {creator.is_discoverable
              ? "Your profile is live. Keep adding detail — complete profiles rank higher."
              : "Your profile is saved but hidden. Turn on discoverability whenever you're ready."}
          </span>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Profile views" value={creator.profile_views_count} hint="Visits to your public page" />
        <StatTile label="Open inquiries" value={inquiryCount ?? 0} hint="Representation requests waiting on you" />
        <StatTile
          label="Discoverability"
          value={creator.is_discoverable ? "On" : "Off"}
          hint={creator.is_discoverable ? "Approved companies can find you" : "Hidden from company search"}
        />
      </div>

      {!creator.is_discoverable && (
        <Alert tone="warning" className="mt-6" title="Your profile is hidden">
          Companies can't find you yet.{" "}
          <Link href="/creator/privacy" className="font-medium underline">Turn on discoverability</Link> when you're ready.
        </Alert>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Profile strength" description={`${pct}% complete`} />
          <CardBody>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
            </div>
            {todo.length === 0 ? (
              <p className="flex items-center gap-2 text-success-strong">
                <BadgeCheck className="size-5" aria-hidden /> Your profile is complete. Nice work.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((i) => (
                  <li key={i.key}>
                    {i.done ? (
                      <span className="flex items-center gap-3 rounded-xl px-3 py-2 text-muted">
                        <BadgeCheck className="size-5 text-success" aria-hidden />
                        <span className="line-through">{i.label}</span>
                        <span className="sr-only">(done)</span>
                      </span>
                    ) : (
                      <Link href={i.href} className="group flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-ink hover:border-primary">
                        <Circle className="size-5 text-muted" aria-hidden />
                        <span className="flex-1">{i.label}</span>
                        <ArrowRight className="size-4 text-muted group-hover:text-primary" aria-hidden />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <EmptyState
          icon={Inbox}
          title="Your inquiries will land here"
          description="When a vetted management company wants to represent you, you'll see their request here. Responding is always free."
        />
      </div>
    </>
  );
}
