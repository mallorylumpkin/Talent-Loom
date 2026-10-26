import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { CompanyLogo } from "@/components/messaging/avatar";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/countries";

export const metadata: Metadata = { title: "Management companies", description: "Management companies and talent agencies approved by TalentLoom." };

/** Public directory of approved companies — only when switched on in Admin → Settings (features.company_directory). */
export default async function CompanyDirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: setting } = await supabase.from("platform_settings").select("value").eq("key", "features.company_directory").maybeSingle();
  const { data: { user } } = await supabase.auth.getUser();
  if (setting?.value !== true && !user) notFound();
  const { data } = await supabase.rpc("list_companies", { p_query: q?.trim() || null, p_limit: 60 });
  const rows = (data ?? []) as { name: string; slug: string; logo_path: string | null; city: string | null; region: string | null; country: string | null;
    specialties: string[]; is_verified_badge: boolean }[];
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink">Management companies</h1>
      <p className="mt-2 max-w-2xl text-muted">Every company here has been reviewed and approved by TalentLoom before it can contact creators.</p>
      <form method="get" className="mt-6"><input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search companies"
        className="h-10 w-full max-w-sm rounded-xl border border-line bg-surface px-3" /></form>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <li key={c.slug}>
            <Link href={`/companies/${c.slug}`} className="block h-full">
              <Card className="h-full transition-shadow hover:shadow-[var(--shadow-pop)]">
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-3">
                    <CompanyLogo path={c.logo_path} />
                    <p className="flex items-center gap-1 font-medium text-ink">{c.name}{c.is_verified_badge && <BadgeCheck className="size-4 text-primary" aria-label="Verified" />}</p>
                  </div>
                  {(c.city || c.country) && <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" aria-hidden />{[c.city, c.region, countryName(c.country)].filter(Boolean).join(", ")}</p>}
                  {c.specialties.length > 0 && <p className="text-sm text-muted">{c.specialties.slice(0, 3).join(" · ")}</p>}
                </CardBody>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="mt-8 text-muted">No companies to show yet.</p>}
    </div>
  );
}
