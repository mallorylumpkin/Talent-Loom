import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EyeOff, FileText, Handshake, MapPin, PenLine, Sparkles, Star } from "lucide-react";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countryName } from "@/lib/countries";
import { compactNumber, percent, representationLabels, shortDate } from "@/lib/format";
import { GENDER_LABELS } from "@/lib/creator/demographics";
import { formatLocation, type PublicProfile } from "@/lib/creator/public";
import { publicStorageUrl } from "@/lib/uploads";

const getProfile = cache(async (handle: string): Promise<PublicProfile | null> => {
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(handle)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_creator_profile", { p_handle: handle });
  return (data as PublicProfile | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const p = await getProfile((await params).handle);
  if (!p) return { title: "Creator not found" };
  return {
    title: `${p.display_name ?? p.handle} (@${p.handle})`,
    description: p.headline ?? undefined,
    robots: p.is_discoverable ? undefined : { index: false, follow: false },
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular font-display text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default async function PublicCreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await getProfile(handle);
  if (!p) notFound();

  const supabase = await createClient();
  if (!p.is_owner_preview) await supabase.rpc("record_creator_profile_view", { p_creator_id: p.id });

  // Portfolio files live in a private bucket: issue short-lived links for the public items only.
  const filePaths = p.portfolio.map((i) => i.storage_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (filePaths.length) {
    const { data } = await createAdminClient().storage.from("portfolio-private").createSignedUrls(filePaths, 3600);
    for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const avatar = publicStorageUrl("avatars", p.avatar_path);
  const cover = publicStorageUrl("covers", p.cover_path);
  const location = formatLocation(p.location, countryName);
  const anyNumbers = p.social_accounts.some((a) => a.followers !== null || a.engagement_rate !== null);
  const initials = (p.display_name ?? p.handle).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="pb-20">
      {p.is_owner_preview && (
        <div className="border-b border-warning/30 bg-warning-soft">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-warning-strong">
            <span className="flex items-center gap-2">
              <EyeOff className="size-4" aria-hidden />
              {p.is_discoverable
                ? "This is your public page, exactly as visitors see it."
                : "Preview only — your profile is hidden, so nobody else can see this page."}
            </span>
            <span className="flex gap-2">
              <ButtonLink href="/creator/profile" size="sm" variant="secondary">Edit profile</ButtonLink>
              <ButtonLink href="/creator/privacy" size="sm" variant="secondary">Privacy</ButtonLink>
            </span>
          </div>
        </div>
      )}

      <div className="relative h-44 bg-gradient-to-br from-primary/80 via-primary to-accent sm:h-60">
        {cover && <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />}
      </div>

      <div className="mx-auto max-w-5xl px-5">
        <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end">
          <div className="size-28 shrink-0 overflow-hidden rounded-full border-4 border-canvas bg-accent-soft sm:size-32">
            {avatar ? (
              <img src={avatar} alt={p.display_name ?? p.handle} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center font-display text-3xl font-bold text-accent-strong">{initials}</span>
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              {p.is_featured && <Badge tone="accent"><Star className="size-3" aria-hidden /> Featured</Badge>}
              {p.seeking_management && <Badge tone="accent">Seeking management</Badge>}
              <Badge>{representationLabels[p.representation_status]}</Badge>
            </div>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{p.display_name ?? p.handle}</h1>
            <p className="text-muted">
              @{p.handle}
              {location && <span className="ml-3 inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{location}</span>}
            </p>
          </div>
        </div>

        {p.headline && <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/85">{p.headline}</p>}

        <div className="mt-6 flex flex-wrap gap-1.5">
          {p.niches.map((n) => <Badge key={n} tone="primary">{n}</Badge>)}
          {p.categories.map((c) => <Badge key={c}>{c}</Badge>)}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-10">
            {p.bio && (
              <section>
                <h2 className="text-xl font-semibold text-ink">About</h2>
                <p className="mt-3 leading-7 whitespace-pre-line text-ink/85">{p.bio}</p>
              </section>
            )}

            {p.portfolio.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-ink">Work</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {p.portfolio.map((i) => {
                    const href = i.url ?? (i.storage_path ? signed.get(i.storage_path) : undefined);
                    return (
                      <li key={i.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                        {i.item_type === "image" && href ? (
                          <img src={href} alt="" className="aspect-video w-full object-cover" />
                        ) : (
                          <div className="flex aspect-video items-center justify-center bg-canvas text-muted">
                            <FileText className="size-8" aria-hidden />
                          </div>
                        )}
                        <div className="p-4">
                          <p className="font-medium text-ink">
                            {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{i.title}</a> : i.title}
                          </p>
                          {i.platform && <p className="text-xs text-muted">{i.platform}</p>}
                          {i.description && <p className="mt-1 text-sm text-muted">{i.description}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {p.partnerships.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-ink">Brand partnerships</h2>
                <ul className="mt-4 space-y-3">
                  {p.partnerships.map((b, idx) => (
                    <li key={`${b.brand_name}-${idx}`} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
                      <Handshake className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                      <div>
                        <p className="font-medium text-ink">
                          {b.link ? <a href={b.link} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{b.brand_name}</a> : b.brand_name}
                          {b.year && <span className="font-normal text-muted"> · {b.year}</span>}
                        </p>
                        {b.category && <p className="text-xs text-muted">{b.category}</p>}
                        {b.description && <p className="mt-1 text-sm text-muted">{b.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <h2 className="text-lg font-semibold text-ink">Platforms</h2>
              <ul className="mt-4 space-y-5">
                {p.social_accounts.map((a, idx) => (
                  <li key={`${a.platform_key}-${idx}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">
                        {a.platform}
                        {a.handle && (
                          a.url
                            ? <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="ml-2 text-sm font-normal text-primary hover:underline">@{a.handle}</a>
                            : <span className="ml-2 text-sm font-normal text-muted">@{a.handle}</span>
                        )}
                      </p>
                      {a.source && (a.followers !== null || a.engagement_rate !== null) && <ProvenanceBadge source={a.source} />}
                    </div>
                    {(a.followers !== null || a.engagement_rate !== null || a.growth_30d_pct !== null) && (
                      <dl className="mt-2 grid grid-cols-3 gap-2">
                        {a.followers !== null && <Stat label="Followers" value={compactNumber(a.followers)} />}
                        {a.engagement_rate !== null && <Stat label="Engagement" value={percent(a.engagement_rate)} />}
                        {a.growth_30d_pct !== null && <Stat label="30-day growth" value={percent(a.growth_30d_pct, true)} />}
                      </dl>
                    )}
                    {a.demographics && a.demographics.length > 0 && (
                      <p className="mt-2 text-xs text-muted">
                        Audience: {a.demographics.filter((d) => d.dimension !== "country").slice(0, 4)
                          .map((d) => `${d.dimension === "gender" ? GENDER_LABELS[d.bucket] ?? d.bucket : d.bucket} ${percent(d.pct)}`).join(" · ")}
                      </p>
                    )}
                    {a.captured_at && a.followers !== null && (
                      <p className="mt-1 text-xs text-muted">As of {shortDate(a.captured_at)}</p>
                    )}
                  </li>
                ))}
              </ul>
              {anyNumbers && (
                <p className="mt-5 flex gap-2 border-t border-line pt-4 text-xs text-muted">
                  <PenLine className="size-3.5 shrink-0" aria-hidden />
                  Self-reported numbers are provided by the creator and haven't been independently checked.
                </p>
              )}
            </section>

            {p.media_kit_path && (
              <a href={`/creators/${p.handle}/media-kit`} target="_blank" rel="noopener"
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-primary">
                <FileText className="size-6 text-primary" aria-hidden />
                <span className="font-medium text-ink">View media kit</span>
              </a>
            )}

            {(p.support_types.length > 0 || p.industries.length > 0) && (
              <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                <h2 className="text-lg font-semibold text-ink">Looking for</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.support_types.map((s) => <Badge key={s} tone="accent">{s}</Badge>)}
                </div>
                {p.industries.length > 0 && (
                  <>
                    <p className="mt-4 text-sm font-medium text-ink">Industries of interest</p>
                    <p className="mt-1 text-sm text-muted">{p.industries.join(", ")}</p>
                  </>
                )}
              </section>
            )}

            <section className="rounded-[var(--radius-card)] bg-ink p-5 text-white">
              <Sparkles className="size-5 text-accent" aria-hidden />
              <p className="mt-3 font-semibold">Represent creators?</p>
              <p className="mt-1 text-sm text-white/70">Approved management companies can see more detail and send representation inquiries.</p>
              <Link href="/for-companies#contact" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
                Request company access →
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
