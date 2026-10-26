import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { BasicsForm, GoalsForm, ImageUploader, InterestsForm } from "@/components/creator/profile-forms";
import { AddAccountForm } from "@/components/creator/account-forms";
import { FinishOnboardingForm } from "@/components/creator/privacy-forms";
import { skipOnboardingAction } from "@/app/creator/_actions/privacy";
import { getCreatorContext, getLookups, hasConsent } from "@/lib/creator/context";
import { compactNumber } from "@/lib/format";
import { publicStorageUrl } from "@/lib/uploads";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Set up your profile" };

const STEPS = [
  { title: "About you", blurb: "The basics companies see first." },
  { title: "Your content", blurb: "Your niches help the right companies find you." },
  { title: "Your platforms", blurb: "Add where you create and roughly how big your audience is." },
  { title: "Your goals", blurb: "Tell companies what kind of support you're looking for." },
  { title: "Go live", blurb: "Choose whether companies can discover you now." },
];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { viewer, supabase, creator } = await getCreatorContext();
  const step = Math.min(Math.max(Number((await searchParams).step) || 1, 1), STEPS.length);
  const nextHref = `/creator/onboarding?step=${step + 1}`;
  const lookups = await getLookups(supabase);

  let body: React.ReactNode = null;
  if (step === 1) {
    body = (
      <div className="space-y-8">
        <ImageUploader kind="avatar" userId={viewer.id} currentUrl={publicStorageUrl("avatars", creator.avatar_path)} />
        <BasicsForm creator={creator} next={nextHref} submitLabel="Save and continue" />
      </div>
    );
  } else if (step === 2) {
    const sel = async (table: string, column: string) =>
      ((await supabase.from(table).select(column).eq("creator_id", creator.id)).data as unknown as Record<string, string>[] ?? [])
        .map((r) => r[column]);
    const [niches, categories, industries] = await Promise.all([
      sel("creator_niches", "niche_id"), sel("creator_categories", "category_id"), sel("creator_industries", "industry_id"),
    ]);
    body = <InterestsForm niches={lookups.niches} categories={lookups.categories} industries={lookups.industries}
      selected={{ niches, categories, industries }} next={nextHref} submitLabel="Save and continue" />;
  } else if (step === 3) {
    const [{ data: accounts }, consent] = await Promise.all([
      supabase.from("social_accounts")
        .select("id, handle, platforms(label), analytics_snapshots(followers, captured_at)")
        .eq("creator_id", creator.id).is("deleted_at", null).order("created_at")
        .order("captured_at", { referencedTable: "analytics_snapshots", ascending: false })
        .limit(1, { referencedTable: "analytics_snapshots" }),
      hasConsent(supabase, viewer.id, "creator_data_consent"),
    ]);
    const list = (accounts ?? []) as unknown as {
      id: string; handle: string; platforms: { label: string }; analytics_snapshots: { followers: number | null }[];
    }[];
    body = (
      <div className="space-y-6">
        {list.length > 0 && (
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">
                <span><span className="font-medium text-ink">{a.platforms.label}</span> <span className="text-muted">@{a.handle}</span></span>
                <span className="tabular font-medium text-ink">{compactNumber(a.analytics_snapshots[0]?.followers)} followers</span>
              </li>
            ))}
          </ul>
        )}
        <AddAccountForm platforms={lookups.platforms} needsConsent={!consent} />
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <ButtonLink href={nextHref}>{list.length ? "Continue" : "Skip for now"}</ButtonLink>
          <span className="text-sm text-muted">You can add more detailed analytics later.</span>
        </div>
      </div>
    );
  } else if (step === 4) {
    const { data } = await supabase.from("creator_support_types").select("support_type_id").eq("creator_id", creator.id);
    body = <GoalsForm supportTypes={lookups.supportTypes}
      selected={(data ?? []).map((r: { support_type_id: string }) => r.support_type_id)}
      seeking={creator.seeking_management} representation={creator.representation_status}
      next={nextHref} submitLabel="Save and continue" />;
  } else {
    const consent = await hasConsent(supabase, viewer.id, "discoverability");
    body = (
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted">
          When your profile is discoverable, it gets a public page and approved management companies can find you. Detailed
          numbers like engagement and audience demographics stay visible to <strong>approved companies only</strong> unless you
          change that in Privacy & discoverability.
        </p>
        <FinishOnboardingForm isDiscoverable={creator.is_discoverable} hasConsent={consent} hasHandle={!!creator.handle} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Badge tone="accent">Step {step} of {STEPS.length}</Badge>
          <h1 className="mt-3 text-3xl font-bold text-ink">{STEPS[step - 1].title}</h1>
          <p className="mt-1.5 text-muted">{STEPS[step - 1].blurb}</p>
        </div>
        <form action={skipOnboardingAction}>
          <button type="submit" className="text-sm font-medium text-muted hover:text-ink">Finish later</button>
        </form>
      </div>

      <ol className="mb-8 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li key={s.title}>
              <Link href={`/creator/onboarding?step=${n}`} aria-current={state === "current" ? "step" : undefined} className="group block">
                <span className={cn("block h-1.5 rounded-full transition-colors",
                  state === "todo" ? "bg-line" : "bg-gradient-to-r from-primary to-accent")} />
                <span className={cn("mt-2 hidden items-center gap-1 text-xs font-medium sm:flex",
                  state === "todo" ? "text-muted" : "text-ink")}>
                  {state === "done" && <Check className="size-3 text-success" aria-hidden />}
                  {s.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <Card className="p-5 sm:p-8">{body}</Card>

      {step > 1 && (
        <p className="mt-6 text-sm">
          <Link href={`/creator/onboarding?step=${step - 1}`} className="font-medium text-muted hover:text-ink">← Back</Link>
        </p>
      )}
    </div>
  );
}
