import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Search, SlidersHorizontal, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatorCard, type SearchResult } from "@/components/company/creator-card";
import { feature, requireCompany } from "@/lib/company/context";
import { countryOptions } from "@/lib/countries";
import { AGE_BUCKETS, GENDER_BUCKETS, GENDER_LABELS } from "@/lib/creator/demographics";

export const metadata: Metadata = { title: "Creator search" };

const PAGE_SIZE = 24;
const sel = "h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus:border-primary focus:outline-none disabled:bg-canvas disabled:text-muted";
const inp = "h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus:border-primary focus:outline-none disabled:bg-canvas";

type P = Record<string, string | undefined>;

function num(v?: string) {
  return v && /^\d+(\.\d+)?$/.test(v) ? v : undefined;
}
function int(v?: string) {
  const clean = v?.replace(/[,\s]/g, "");
  return clean && /^\d{1,12}$/.test(clean) ? clean : undefined;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-muted">{children}</span>;
}

export default async function CompanySearchPage({ searchParams }: { searchParams: Promise<P> }) {
  const p = await searchParams;
  const { supabase, company, permissions, entitlements } = await requireCompany();
  const canSearch = permissions.has("talent.search");
  const canSave = permissions.has("talent.manage");
  const compare = feature(entitlements, "creator_comparison").enabled;

  if (!canSearch) {
    return (
      <>
        <PageHeader title="Creator search" />
        <EmptyState icon={Lock} title="Search isn't part of your role" description="Ask your company owner to change your role." />
      </>
    );
  }

  const page = Math.max(1, Math.min(Number(p.page) || 1, 40));
  const [demoDim, demoBucket] = (p.demo ?? "").split(":");
  const filters: Record<string, unknown> = {
    q: p.q?.slice(0, 80),
    niches: p.niche ? [p.niche] : undefined,
    platforms: p.platform ? [p.platform] : undefined,
    country: p.country || undefined,
    region: p.region?.slice(0, 80) || undefined,
    followers_min: int(p.fmin),
    followers_max: int(p.fmax),
    seeking: p.seeking === "1" ? "true" : undefined,
    representation: p.rep ? [p.rep] : undefined,
    engagement_min: num(p.emin),
    engagement_max: num(p.emax),
    growth_min: num(p.gmin),
    categories: p.cat ? [p.cat] : undefined,
    verified_only: p.verified === "1" ? "true" : undefined,
    active_days: int(p.active),
    demo_dimension: demoDim || undefined,
    demo_bucket: demoBucket || undefined,
    demo_min: num(p.demomin),
  };

  const [{ data, error }, { data: niches }, { data: platforms }, { data: cats }] = await Promise.all([
    supabase.rpc("search_creators", {
      p_company_id: company.id,
      p_filters: filters,
      p_sort: ["followers", "engagement", "growth", "recent"].includes(p.sort ?? "") ? p.sort : "relevance",
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.from("niches").select("key, label").order("sort"),
    supabase.from("platforms").select("key, label").order("sort"),
    supabase.from("content_categories").select("key, label").order("sort"),
  ]);
  const result = (data as SearchResult | null) ?? { total: 0, view_level: 0, advanced_filters: false, items: [] };
  const adv = result.advanced_filters;
  const pages = Math.ceil(result.total / PAGE_SIZE);
  const qs = (patch: P) => {
    const merged = { ...p, ...patch };
    const s = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return `/company/search${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Creator search" description="Only creators who've chosen to be discoverable appear here." />

      {result.view_level === 0 && (
        <Alert tone="warning" className="mb-6" title="Limited view until your company is approved">
          You're seeing public information only. Once TalentLoom approves your company you'll see more detail and can contact creators.
        </Alert>
      )}
      {error && <Alert tone="danger" className="mb-6">{error.code === "P0001" ? error.message : "Search failed. Please try again."}</Alert>}

      <form method="get" className="mb-6 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Keywords</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={p.q} placeholder="Name, handle or headline" className={`${inp} h-11 pl-9`} />
          </label>
          <select name="niche" defaultValue={p.niche ?? ""} className={`${sel} h-11`} aria-label="Niche">
            <option value="">All niches</option>
            {(niches ?? []).map((n: { key: string; label: string }) => <option key={n.key} value={n.key}>{n.label}</option>)}
          </select>
          <select name="platform" defaultValue={p.platform ?? ""} className={`${sel} h-11`} aria-label="Platform">
            <option value="">All platforms</option>
            {(platforms ?? []).map((x: { key: string; label: string }) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <button type="submit" className={buttonClasses("primary", "md", "h-11")}>Search</button>
        </div>

        <details className="group" open={!!(p.fmin || p.fmax || p.country || p.region || p.rep || p.seeking || p.emin || p.gmin || p.cat || p.verified || p.active || p.demo)}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-primary">
            <SlidersHorizontal className="size-4" aria-hidden /> More filters
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label><Label>Followers from</Label><input name="fmin" defaultValue={p.fmin} inputMode="numeric" placeholder="10000" className={inp} /></label>
            <label><Label>Followers up to</Label><input name="fmax" defaultValue={p.fmax} inputMode="numeric" placeholder="500000" className={inp} /></label>
            <label><Label>Country</Label>
              <select name="country" defaultValue={p.country ?? ""} className={sel}>
                <option value="">Any</option>
                {countryOptions().map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label><Label>State / region</Label><input name="region" defaultValue={p.region} placeholder="TX" className={inp} /></label>
            <label><Label>Representation</Label>
              <select name="rep" defaultValue={p.rep ?? ""} className={sel}>
                <option value="">Any</option>
                <option value="unrepresented">Not represented</option>
                <option value="open_to_switch">Open to switching</option>
                <option value="represented">Represented</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-ink">
              <input type="checkbox" name="seeking" value="1" defaultChecked={p.seeking === "1"} className="size-4 accent-primary" />
              Actively seeking management
            </label>
            <label><Label>Sort by</Label>
              <select name="sort" defaultValue={p.sort ?? "relevance"} className={sel}>
                <option value="relevance">Best match</option>
                <option value="followers">Most followers</option>
                <option value="engagement">Highest engagement</option>
                <option value="growth">Fastest growing</option>
                <option value="recent">Recently active</option>
              </select>
            </label>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Advanced filters {!adv && <span className="inline-flex items-center gap-1 normal-case"><Lock className="size-3" aria-hidden /> Management Agency plan and above</span>}
            </p>
            <fieldset disabled={!adv} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label><Label>Engagement from (%)</Label><input name="emin" defaultValue={p.emin} inputMode="decimal" className={inp} /></label>
              <label><Label>Engagement up to (%)</Label><input name="emax" defaultValue={p.emax} inputMode="decimal" className={inp} /></label>
              <label><Label>30-day growth at least (%)</Label><input name="gmin" defaultValue={p.gmin} inputMode="decimal" className={inp} /></label>
              <label><Label>Content type</Label>
                <select name="cat" defaultValue={p.cat ?? ""} className={sel}>
                  <option value="">Any</option>
                  {(cats ?? []).map((c: { key: string; label: string }) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              <label><Label>Audience</Label>
                <select name="demo" defaultValue={p.demo ?? ""} className={sel}>
                  <option value="">Any</option>
                  <optgroup label="Age">{AGE_BUCKETS.map((b) => <option key={b} value={`age:${b}`}>Age {b}</option>)}</optgroup>
                  <optgroup label="Gender">{GENDER_BUCKETS.map((b) => <option key={b} value={`gender:${b}`}>{GENDER_LABELS[b]}</option>)}</optgroup>
                  <optgroup label="Country">{countryOptions().slice(0, 12).map((c) => <option key={c.code} value={`country:${c.code}`}>{c.name}</option>)}</optgroup>
                </select>
              </label>
              <label><Label>…making up at least (%)</Label><input name="demomin" defaultValue={p.demomin ?? "20"} inputMode="numeric" className={inp} /></label>
              <label><Label>Active within</Label>
                <select name="active" defaultValue={p.active ?? ""} className={sel}>
                  <option value="">Any time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                <input type="checkbox" name="verified" value="1" defaultChecked={p.verified === "1"} className="size-4 accent-primary" />
                Verified analytics only
              </label>
            </fieldset>
          </div>
        </details>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {result.total} creator{result.total === 1 ? "" : "s"}
          {Object.keys(p).some((k) => k !== "page" && k !== "sort" && p[k]) && (
            <> · <Link href="/company/search" className="font-medium text-primary hover:underline">Clear filters</Link></>
          )}
        </p>
      </div>

      {result.items.length === 0 ? (
        <EmptyState icon={Users} title="No creators match yet" description="Try fewer filters or a different niche. New creators join every day." />
      ) : (
        <form action="/company/compare" method="get">
          {compare && (
            <div className="sticky top-14 z-10 mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-4 py-2 backdrop-blur lg:top-2">
              <span className="text-sm text-muted">Tick 2–4 creators to compare them side by side.</span>
              <button type="submit" className={buttonClasses("secondary", "sm")}>Compare selected</button>
            </div>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((c) => (
              <li key={c.id}><CreatorCard c={c} canSave={canSave} compare={compare} /></li>
            ))}
          </ul>
        </form>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
          {page > 1 && <ButtonLink href={qs({ page: String(page - 1) })} variant="secondary" size="sm">Previous</ButtonLink>}
          <span className="text-sm text-muted">Page {page} of {pages}</span>
          {page < pages && <ButtonLink href={qs({ page: String(page + 1) })} variant="secondary" size="sm">Next</ButtonLink>}
        </nav>
      )}
    </>
  );
}
