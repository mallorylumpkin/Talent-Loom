import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/creator/section";
import { BasicsForm, GoalsForm, ImageUploader, InterestsForm } from "@/components/creator/profile-forms";
import { getCreatorContext, getLookups } from "@/lib/creator/context";
import { publicStorageUrl } from "@/lib/uploads";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const { viewer, supabase, creator } = await getCreatorContext();
  const lookups = await getLookups(supabase);
  const ids = (table: string, column: string) =>
    supabase.from(table).select(column).eq("creator_id", creator.id)
      .then((r) => ((r.data ?? []) as unknown as Record<string, string>[]).map((row) => row[column]));
  const [niches, categories, industries, supportTypes] = await Promise.all([
    ids("creator_niches", "niche_id"),
    ids("creator_categories", "category_id"),
    ids("creator_industries", "industry_id"),
    ids("creator_support_types", "support_type_id"),
  ]);

  return (
    <>
      <PageHeader
        title="Edit profile"
        description="This is what management companies see first. Control who sees each part in Privacy & discoverability."
        action={creator.handle ? (
          <ButtonLink href={`/creators/${creator.handle}`} variant="secondary" size="sm" target="_blank">
            View public profile <ExternalLink className="size-3.5" aria-hidden />
          </ButtonLink>
        ) : undefined}
      />
      <div className="space-y-6">
        <Section title="Photos" description="A clear, friendly photo of your face works best.">
          <div className="space-y-6">
            <ImageUploader kind="avatar" userId={viewer.id} currentUrl={publicStorageUrl("avatars", creator.avatar_path)} />
            <ImageUploader kind="cover" userId={viewer.id} currentUrl={publicStorageUrl("covers", creator.cover_path)} />
          </div>
        </Section>
        <Section title="About you">
          <BasicsForm creator={creator} />
        </Section>
        <Section id="interests" title="Niches and content">
          <InterestsForm niches={lookups.niches} categories={lookups.categories} industries={lookups.industries}
            selected={{ niches, categories, industries }} />
        </Section>
        <Section id="goals" title="Management goals">
          <GoalsForm supportTypes={lookups.supportTypes} selected={supportTypes}
            seeking={creator.seeking_management} representation={creator.representation_status} />
        </Section>
      </div>
    </>
  );
}
