import Link from "next/link";
import { Bookmark, BookmarkCheck, MapPin, Star } from "lucide-react";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/confirm-action";
import { saveCreatorAction, unsaveCreatorAction } from "@/app/company/_actions/talent";
import { countryName } from "@/lib/countries";
import { compactNumber, percent, representationLabels } from "@/lib/format";
import { formatLocation } from "@/lib/creator/public";
import { publicStorageUrl } from "@/lib/uploads";

export interface SearchItem {
  id: string;
  handle: string;
  display_name: string | null;
  headline: string | null;
  avatar_path: string | null;
  location: { city: string | null; region: string | null; country: string | null } | null;
  seeking_management: boolean;
  representation_status: string;
  is_featured: boolean;
  niches: string[];
  platforms: string[];
  top_platform: string | null;
  followers: number | null;
  total_followers: number | null;
  engagement_rate: number | null;
  growth_30d_pct: number | null;
  source: "self_reported" | "admin_verified" | "api_verified" | null;
  saved: boolean;
}

export interface SearchResult {
  total: number;
  view_level: number;
  advanced_filters: boolean;
  items: SearchItem[];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="tabular text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function CreatorCard({
  c, canSave, compare = false, extraAction,
}: {
  c: SearchItem; canSave: boolean; compare?: boolean; extraAction?: React.ReactNode;
}) {
  const avatar = publicStorageUrl("avatars", c.avatar_path);
  const loc = formatLocation(c.location, countryName);
  const initials = (c.display_name ?? c.handle).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-full bg-accent-soft">
          {avatar ? <img src={avatar} alt="" className="size-full object-cover" />
            : <span className="flex size-full items-center justify-center font-display font-bold text-accent-strong">{initials}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/company/creators/${c.id}`} className="block truncate font-display font-semibold text-ink hover:underline">
            {c.display_name ?? c.handle}
          </Link>
          <p className="truncate text-xs text-muted">
            @{c.handle}{loc && <span className="ml-1.5 inline-flex items-center gap-0.5"><MapPin className="size-3" aria-hidden />{loc}</span>}
          </p>
        </div>
        {compare && (
          <label className="flex items-center gap-1 text-xs text-muted" title="Select to compare">
            <input type="checkbox" name="ids" value={c.id} className="size-4 accent-primary" />
            <span className="sr-only">Compare {c.display_name}</span>
          </label>
        )}
      </div>

      {c.headline && <p className="mt-3 line-clamp-2 text-sm text-ink/80">{c.headline}</p>}

      <div className="mt-3 flex flex-wrap gap-1">
        {c.is_featured && <Badge tone="accent"><Star className="size-3" aria-hidden /> Featured</Badge>}
        {c.seeking_management && <Badge tone="accent">Seeking</Badge>}
        {c.representation_status !== "unrepresented" && <Badge>{representationLabels[c.representation_status]}</Badge>}
        {c.niches.map((n) => <Badge key={n} tone="primary">{n}</Badge>)}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-canvas px-3 py-2.5">
        <Metric label={c.top_platform ? `${c.top_platform} followers` : "Followers"} value={compactNumber(c.followers)} />
        <Metric label="Engagement" value={percent(c.engagement_rate)} />
        <Metric label="30-day growth" value={percent(c.growth_30d_pct, true)} />
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <span>{c.source && c.followers !== null && <ProvenanceBadge source={c.source} />}</span>
        <span className="flex items-center gap-1">
          {extraAction}
          {canSave && (c.saved ? (
            <ActionButton action={unsaveCreatorAction.bind(null, c.id)} tone="primary">
              <BookmarkCheck className="size-4" aria-hidden /> Saved
            </ActionButton>
          ) : (
            <ActionButton action={saveCreatorAction.bind(null, c.id)}>
              <Bookmark className="size-4" aria-hidden /> Save
            </ActionButton>
          ))}
        </span>
      </div>
    </div>
  );
}
