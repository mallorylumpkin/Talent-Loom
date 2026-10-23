import type { Metadata } from "next";
import { AtSign, BadgeCheck, Eye, Inbox, Sparkles, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CreatorDashboard() {
  const viewer = await requireRole("creator", "/creator");
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("id, handle, display_name, headline, bio, is_discoverable, seeking_management, profile_views_count")
    .eq("user_id", viewer.id)
    .single();

  const [{ count: accountCount }, { count: inquiryCount }, { data: plan }] = await Promise.all([
    supabase.from("social_accounts").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("representation_inquiries").select("id", { count: "exact", head: true }).in("status", ["sent", "viewed"]),
    supabase.from("subscriptions").select("status, plans(name)").eq("owner_type", "user").eq("owner_id", viewer.id)
      .in("status", ["active", "trialing", "complimentary"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const firstName = (creator?.display_name ?? viewer.displayName ?? "there").split(" ")[0];
  const planName = (plan?.plans as { name?: string } | null)?.name ?? "Creator Free";

  const steps = [
    { done: !!creator?.handle && !!creator?.headline, label: "Add your handle, headline and photo", icon: UserRound },
    { done: (accountCount ?? 0) > 0, label: "Add your social accounts and numbers", icon: AtSign },
    { done: !!creator?.is_discoverable, label: "Turn on discoverability so companies can find you", icon: Eye },
  ];
  const completed = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHeader
        title={<>Hi {firstName} <span className="font-serif font-normal italic text-accent">— welcome in.</span></>}
        description="Your talent profile is your pitch to management companies. Here's where it stands."
        action={<Badge tone="primary">{planName}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Profile views" value={creator?.profile_views_count ?? 0} hint="Views from approved companies" />
        <StatTile label="Open inquiries" value={inquiryCount ?? 0} hint="Representation requests waiting on you" />
        <StatTile
          label="Discoverability"
          value={creator?.is_discoverable ? "On" : "Off"}
          hint={creator?.is_discoverable ? "Approved companies can find you" : "Hidden from company search"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Get discovered"
            description={`${completed} of ${steps.length} steps complete`}
            action={<Sparkles className="size-5 text-accent" aria-hidden />}
          />
          <CardBody>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${(completed / steps.length) * 100}%` }} />
            </div>
            <ol className="space-y-3">
              {steps.map(({ done, label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                  <span className={done ? "text-success" : "text-muted"}>
                    {done ? <BadgeCheck className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
                  </span>
                  <span className={done ? "text-muted line-through" : "text-ink"}>{label}</span>
                  <span className="sr-only">{done ? "(done)" : "(to do)"}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-muted">
              Profile editing, social accounts and privacy controls arrive in the next build phase.
            </p>
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
