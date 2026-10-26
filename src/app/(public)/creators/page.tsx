import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Search, Star, Users } from "lucide-react";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/countries";
import { compactNumber } from "@/lib/format";
import { formatLocation, type DirectoryItem } from "@/lib/creator/public";
import { publicStorageUrl } from "@/lib/uploads";

export const metadata: Metadata = {
  title: "Creator directory",
  description: "Discover social media creators on TalentLoom.",
};

const PAGE_SIZE = 24;
const selectClass =
  "h-11 rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none";

type Params = { q?: string; niche?: string; platform?: string; seeking?: string; page?: string };

function hrefWith(params: Params, patch: Partial<Params>) {
  const merged = { ...params, ...patch };
  const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]);
  const s = qs.toString();
  return s ? `/creators?${s}` : "/creators";
}

export default async function CreatorDirectoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(Number(params.page) || 1, 80));
  const supabase = await createClient();

  const [{ data }, { data: niches }, { data: platforms }] = await Promise.all([
    supabase.rpc("list_public_creators", {
      p_q: params.q?.slice(0, 80) || null,
      p_niche: params.niche || null,
      p_platform: params.platform || null,
      p_seeking: params.seeking === "1" ? true : null,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.from("niches").select("key, label").order("sort"),
    supabase.from("platforms").select("key, label").order("sort"),
  ]);

  const result = (data as { total: number; items: DirectoryItem[] } | null) ?? { total: 0, items: [] };
  const pages = Math.ceil(result.total / PAGE_SIZE);
  const filtered = !!(params.q || params.niche || params.platform || params.seeking);

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold text-ink">Discover creators</h1>
        <p className="mt-3 text-lg text-muted">
          Creators building their careers on TalentLoom. Management companies see more detail after approval.
        </p>
      </div>

      <form method="get" className="mt-8 grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={params.q} placeholder="Search by name, handle or headline"
            className="h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-[15px] focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none" />
        </label>
        <select name="niche" defaultValue={params.niche ?? ""} className={selectClass} aria-label="Niche">
          <option value="">All niches</option>
          {(niches ?? []).map((n: { key: string; label: string }) => <option key={n.key} value={n.key}>{n.label}</option>)}
        </select>
        <select name="platform" defaultValue={params.platform ?? ""} className={selectClass} aria-label="Platform">
          <option value="">All platforms</option>
          {(platforms ?? []).map((p: { key: string; label: string }) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm whitespace-nowrap text-ink">
          <input type="checkbox" name="seeking" value="1" defaultChecked={params.seeking === "1"} className="size-4 accent-primary" />
          Seeking management
        </label>
        <button type="submit" className={buttonClasses("primary", "md")}>Search</button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {result.total} creator{result.total === 1 ? "" : "s"}
        {filtered && <> · <Link href="/creators" className="font-medium text-primary hover:underline">Clear filters</Link></>}
      </p>

      {result.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Users} title={filtered ? "No creators match those filters" : "Creators are joining now"}
            description={filtered ? "Try a broader search or a different niche." : "Be one of the first creators companies discover."}
            action={<ButtonLink href={filtered ? "/creators" : "/signup"}>{filtered ? "Clear filters" : "Create your profile"}</ButtonLink>} />
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((c) => {
            const avatar = publicStorageUrl("avatars", c.avatar_path);
            const loc = formatLocation(c.location, countryName);
            const initials = (c.display_name ?? c.handle).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <li key={c.handle}>
                <Link href={`/creators/${c.handle}`}
                  className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-shadow hover:shadow-[var(--shadow-pop)]">
                  <div className="flex items-center gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-full bg-accent-soft">
                      {avatar ? <img src={avatar} alt="" className="size-full object-cover" />
                        : <span className="flex size-full items-center justify-center font-display font-bold text-accent-strong">{initials}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display font-semibold text-ink">{c.display_name ?? c.handle}</p>
                      <p className="truncate text-sm text-muted">
                        @{c.handle}{loc && <span className="ml-2 inline-flex items-center gap-0.5"><MapPin className="size-3" aria-hidden />{loc}</span>}
                      </p>
                    </div>
                  </div>
                  {c.headline && <p className="mt-3 line-clamp-2 text-sm text-ink/80">{c.headline}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.is_featured && <Badge tone="accent"><Star className="size-3" aria-hidden /> Featured</Badge>}
                    {c.seeking_management && <Badge tone="accent">Seeking management</Badge>}
                    {c.niches.map((n) => <Badge key={n} tone="primary">{n}</Badge>)}
                  </div>
                  {c.top_account && (
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
                      <span className="text-sm text-muted">{c.top_account.platform}</span>
                      <span className="flex items-center gap-2">
                        {c.top_account.followers !== null && (
                          <span className="tabular font-display font-semibold text-ink">{compactNumber(c.top_account.followers)}</span>
                        )}
                        {c.top_account.followers !== null && c.top_account.source && <ProvenanceBadge source={c.top_account.source} />}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
          {page > 1 && <ButtonLink href={hrefWith(params, { page: String(page - 1) })} variant="secondary" size="sm">Previous</ButtonLink>}
          <span className="text-sm text-muted">Page {page} of {pages}</span>
          {page < pages && <ButtonLink href={hrefWith(params, { page: String(page + 1) })} variant="secondary" size="sm">Next</ButtonLink>}
        </nav>
      )}
    </div>
  );
}
