import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Section } from "@/components/creator/section";
import { MediaKitUpload } from "@/components/creator/work-forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { deleteMediaKitAction } from "@/app/creator/_actions/work";
import { getCreatorContext } from "@/lib/creator/context";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Media kit" };

const visibilityText: Record<string, string> = {
  public: "anyone who views your public profile",
  approved_companies: "approved management companies only",
  private: "only you",
};

export default async function MediaKitPage() {
  const { viewer, supabase, creator } = await getCreatorContext();
  const [{ data: kit }, { data: privacy }] = await Promise.all([
    supabase.from("media_kits").select("id, storage_path, file_name, version, created_at")
      .eq("creator_id", creator.id).eq("is_current", true).maybeSingle(),
    supabase.from("creator_privacy_settings").select("media_kit").eq("creator_id", creator.id).single(),
  ]);

  let viewUrl: string | null = null;
  if (kit?.storage_path) {
    const { data } = await supabase.storage.from("media-kits").createSignedUrl(kit.storage_path, 600);
    viewUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <PageHeader title="Media kit" description="Your one-page pitch: audience, rates, results and past partners." />
      <div className="space-y-6">
        <Alert tone="info">
          Your media kit is visible to <strong>{visibilityText[privacy?.media_kit ?? "approved_companies"]}</strong>.{" "}
          <Link href="/creator/privacy" className="font-medium underline">Change this</Link>.
        </Alert>

        <Section title={kit ? "Current media kit" : "Upload your media kit"}>
          {kit && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
              <FileText className="size-6 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{kit.file_name ?? "Media kit"}</p>
                <p className="text-sm text-muted">Version {kit.version} · uploaded {shortDate(kit.created_at)}</p>
              </div>
              {viewUrl && (
                <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary-soft">
                  View
                </a>
              )}
              <ActionButton action={deleteMediaKitAction} tone="danger" confirm="Click again to delete">Delete</ActionButton>
            </div>
          )}
          <MediaKitUpload userId={viewer.id} replacing={!!kit} />
        </Section>

        <div className="flex gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong p-5 text-sm text-muted">
          <Sparkles className="size-5 shrink-0 text-accent" aria-hidden />
          <p>A custom, designed media-kit page built from your TalentLoom profile is coming to Creator Pro.</p>
        </div>
      </div>
    </>
  );
}
