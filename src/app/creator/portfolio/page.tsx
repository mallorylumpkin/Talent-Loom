import type { Metadata } from "next";
import { ExternalLink, FileText, Handshake, Images, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/creator/section";
import { AddPortfolioItem, PartnershipForm, PortfolioItemSettings } from "@/components/creator/work-forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { deletePartnershipAction, deletePortfolioItemAction } from "@/app/creator/_actions/work";
import { getCreatorContext, getLookups } from "@/lib/creator/context";

export const metadata: Metadata = { title: "Portfolio" };

const visibilityLabel: Record<string, string> = {
  public: "Public",
  approved_companies: "Approved companies",
  private: "Only me",
};

interface Item {
  id: string; title: string; description: string | null; item_type: string; url: string | null; storage_path: string | null;
  visibility: string; is_featured: boolean; platforms: { label: string } | null;
}
interface Partnership {
  id: string; brand_name: string; year: number | null; description: string | null; link: string | null; visibility: string;
  content_categories: { label: string } | null;
}

export default async function PortfolioPage() {
  const { viewer, supabase, creator } = await getCreatorContext();
  const [lookups, { data: items }, { data: partnerships }, { data: limits }] = await Promise.all([
    getLookups(supabase),
    supabase.from("portfolio_items")
      .select("id, title, description, item_type, url, storage_path, visibility, is_featured, platforms(label)")
      .eq("creator_id", creator.id).is("deleted_at", null)
      .order("is_featured", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("brand_partnerships")
      .select("id, brand_name, year, description, link, visibility, content_categories(label)")
      .eq("creator_id", creator.id).is("deleted_at", null)
      .order("year", { ascending: false, nullsFirst: false }),
    supabase.rpc("my_entitlements"),
  ]);
  const portfolio = (items ?? []) as unknown as Item[];
  const deals = (partnerships ?? []) as unknown as Partnership[];
  const limit = (limits as { feature_key: string; limit_value: number | null }[] | null)
    ?.find((l) => l.feature_key === "portfolio_items.max")?.limit_value;

  const paths = portfolio.map((i) => i.storage_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("portfolio-private").createSignedUrls(paths, 600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  return (
    <>
      <PageHeader title="Portfolio" description="Show companies your best work and the brands you've partnered with." />
      <div className="space-y-6">
        <Section title="Your work" description={limit != null ? `${portfolio.length} of ${limit} items on your plan` : `${portfolio.length} items`}>
          {portfolio.length === 0 ? (
            <EmptyState icon={Images} title="Add your best work"
              description="Link to your top-performing posts or upload images and PDFs. Feature the ones you're proudest of." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {portfolio.map((i) => {
                const href = i.url ?? (i.storage_path ? signed.get(i.storage_path) : undefined);
                return (
                  <li key={i.id} className="flex flex-col overflow-hidden rounded-xl border border-line">
                    {i.item_type === "image" && href ? (
                      <img src={href} alt="" className="aspect-video w-full object-cover" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-canvas text-muted">
                        {i.item_type === "pdf" ? <FileText className="size-8" aria-hidden /> : <ExternalLink className="size-8" aria-hidden />}
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {i.is_featured && <Badge tone="accent"><Star className="size-3" aria-hidden /> Featured</Badge>}
                        <Badge>{visibilityLabel[i.visibility]}</Badge>
                        {i.platforms && <Badge>{i.platforms.label}</Badge>}
                      </div>
                      <p className="font-medium text-ink">
                        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{i.title}</a> : i.title}
                      </p>
                      {i.description && <p className="line-clamp-2 text-sm text-muted">{i.description}</p>}
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                        <PortfolioItemSettings id={i.id} visibility={i.visibility} featured={i.is_featured} />
                        <ActionButton action={deletePortfolioItemAction.bind(null, i.id)} tone="danger" confirm="Click again to delete">
                          Delete
                        </ActionButton>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Add to your portfolio">
          <AddPortfolioItem platforms={lookups.platforms} userId={viewer.id} />
        </Section>

        <Section title="Brand partnerships" description="Past collaborations help companies understand your experience.">
          {deals.length === 0 ? (
            <p className="mb-6 text-sm text-muted">No partnerships added yet.</p>
          ) : (
            <ul className="mb-6 divide-y divide-line">
              {deals.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start gap-3 py-3">
                  <Handshake className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {p.brand_name}{p.year && <span className="font-normal text-muted"> · {p.year}</span>}
                    </p>
                    {p.description && <p className="text-sm text-muted">{p.description}</p>}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{visibilityLabel[p.visibility]}</Badge>
                      {p.content_categories && <Badge>{p.content_categories.label}</Badge>}
                    </div>
                  </div>
                  <ActionButton action={deletePartnershipAction.bind(null, p.id)} tone="danger" confirm="Click again to delete">
                    Delete
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
          <PartnershipForm categories={lookups.categories} />
        </Section>
      </div>
    </>
  );
}
