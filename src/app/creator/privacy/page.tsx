import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/creator/section";
import { DiscoverabilityForm, VisibilityForm } from "@/components/creator/privacy-forms";
import { ActionButton } from "@/components/forms/confirm-action";
import { revokeConsentAction } from "@/app/creator/_actions/privacy";
import { getCreatorContext, hasConsent } from "@/lib/creator/context";
import type { VisibilityLevel } from "@/lib/creator/privacy";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Privacy & discoverability" };

const consentLabels: Record<string, string> = {
  age_18_plus: "Confirmed 18 or older",
  terms_of_service: "Terms of Service",
  privacy_policy: "Privacy Policy",
  creator_data_consent: "Storing and sharing my analytics",
  discoverability: "Being discoverable by approved companies",
  platform_connection: "Reading my numbers from connected platforms",
};
const revocable = new Set(["creator_data_consent", "discoverability", "platform_connection"]);

export default async function PrivacyPage() {
  const { viewer, supabase, creator } = await getCreatorContext();
  const [{ data: settings }, discoverConsent, { data: consents }] = await Promise.all([
    supabase.from("creator_privacy_settings").select("*").eq("creator_id", creator.id).single(),
    hasConsent(supabase, viewer.id, "discoverability"),
    supabase.from("consents").select("id, consent_type, document_version, granted_at, revoked_at")
      .eq("user_id", viewer.id).order("granted_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader title="Privacy & discoverability"
        description="You decide who sees what. Changes take effect immediately." />
      <div className="space-y-6">
        <Section title="Discoverability"
          action={<Badge tone={creator.is_discoverable ? "success" : "neutral"}>{creator.is_discoverable ? "Discoverable" : "Hidden"}</Badge>}>
          <DiscoverabilityForm isDiscoverable={creator.is_discoverable} hasConsent={discoverConsent} hasHandle={!!creator.handle} />
        </Section>

        <Section title="Who can see each part of your profile"
          description="Your name, photo, headline, niches and platforms are always visible on a discoverable profile. “Approved companies” means management companies TalentLoom has reviewed.">
          <VisibilityForm settings={(settings ?? {}) as Record<string, VisibilityLevel>} />
        </Section>

        <Section title="Your consents" description="A record of what you've agreed to. Withdrawing a consent takes effect right away.">
          <ul className="divide-y divide-line">
            {(consents ?? []).map((c: { id: string; consent_type: string; document_version: string; granted_at: string; revoked_at: string | null }) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{consentLabels[c.consent_type] ?? c.consent_type}</p>
                  <p className="text-muted">
                    Given {shortDate(c.granted_at)}{c.revoked_at && ` · withdrawn ${shortDate(c.revoked_at)}`}
                  </p>
                </div>
                {c.revoked_at ? (
                  <Badge>Withdrawn</Badge>
                ) : revocable.has(c.consent_type) ? (
                  <ActionButton action={revokeConsentAction.bind(null, c.id)} tone="danger" confirm="Click again to withdraw">
                    Withdraw
                  </ActionButton>
                ) : (
                  <Badge tone="success">Active</Badge>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Withdrawing either sharing consent hides your profile from search right away. Your data stays in your account until you
            delete it in Settings.
          </p>
        </Section>
      </div>
    </>
  );
}
