import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BadgeCheck, Globe, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { CompanyLogo } from "@/components/messaging/avatar";
import { getViewer } from "@/lib/auth/session";
import { countryName } from "@/lib/countries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company", robots: { index: false } };

interface CompanyProfile {
  id: string; name: string; slug: string; logo_path: string | null; description: string | null;
  services_description: string | null; website: string | null; city: string | null; region: string | null;
  country: string | null; size_band: string | null; specialties: string[]; is_verified_badge: boolean;
  approved_at: string | null; categories: string[]; roster_size: number;
}

/** Approved companies' profiles — visible to signed-in members (and to everyone when the public directory is on). */
export default async function CompanyProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_company_profile", { p_slug: slug });
  const c = data as CompanyProfile | null;
  // Signed-in members can always see approved companies; visitors only when the public directory is on.
  if (!c && !viewer) redirect(`/login?next=${encodeURIComponent(`/companies/${slug}`)}`);
  if (!c) notFound();
  const location = [c.city, c.region, countryName(c.country)].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <CompanyLogo path={c.logo_path} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-ink">
            {c.name}
            {c.is_verified_badge && <BadgeCheck className="size-6 text-primary" aria-label="Verified company" />}
          </h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{location}</span>}
            {c.size_band && <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{c.size_band} people</span>}
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Globe className="size-3.5" aria-hidden />{c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone="success">Approved by TalentLoom</Badge>
        {c.roster_size > 0 && <Badge>{c.roster_size} signed creator{c.roster_size === 1 ? "" : "s"} on TalentLoom</Badge>}
        {c.categories.map((x) => <Badge key={x} tone="primary">{x}</Badge>)}
      </div>

      {(c.description || c.services_description) && (
        <Card>
          <CardBody className="space-y-5">
            {c.description && <section><h2 className="mb-1 font-semibold text-ink">About</h2><p className="leading-7 whitespace-pre-line text-ink/85">{c.description}</p></section>}
            {c.services_description && <section><h2 className="mb-1 font-semibold text-ink">Services for creators</h2><p className="leading-7 whitespace-pre-line text-ink/85">{c.services_description}</p></section>}
          </CardBody>
        </Card>
      )}
      {c.specialties.length > 0 && (
        <Card><CardBody><h2 className="mb-2 font-semibold text-ink">Specialties</h2>
          <div className="flex flex-wrap gap-1.5">{c.specialties.map((s) => <Badge key={s}>{s}</Badge>)}</div></CardBody></Card>
      )}
      <p className="text-xs text-muted">
        TalentLoom reviews every company before it can contact creators. Never pay a fee to be represented, and keep
        conversations on TalentLoom until you&apos;re ready. Something feel off? Use “Report” on the inquiry or conversation.
      </p>
    </div>
  );
}
