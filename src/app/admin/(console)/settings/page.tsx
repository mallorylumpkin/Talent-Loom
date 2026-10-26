import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingForm, TemplateForm } from "@/components/admin/platform-forms";
import { getAdminContext } from "@/lib/admin/context";

export const metadata: Metadata = { title: "Platform settings" };

const PLACEHOLDERS: Record<string, string[]> = {
  "inquiry.new": ["company", "creator"], "inquiry.accepted": ["creator", "company"], "inquiry.declined": ["creator", "company"],
  "message.new": ["sender", "company", "creator"], "verification.approved": ["platform"], "verification.rejected": ["platform"],
  "support.reply": ["subject"], "support.new": ["subject"], "subscription.updated": ["plan"], "trial.ending": ["date"],
  "analytics.connected": ["platform"],
};

export default async function SettingsPage() {
  const { supabase } = await getAdminContext();
  const [{ data: settings }, { data: templates }] = await Promise.all([
    supabase.from("platform_settings").select("key, value, description").order("key"),
    supabase.from("notification_templates").select("key, channel, body, enabled").eq("channel", "in_app").order("key"),
  ]);
  return (
    <>
      <PageHeader title="Platform settings" description="Changes take effect immediately and are recorded in the audit log." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Settings" description="Numbers, on/off switches (true / false) and text." />
          <CardBody className="space-y-5">
            {(settings ?? []).map((s: { key: string; value: unknown; description: string | null }) => (
              <SettingForm key={s.key} settingKey={s.key} value={s.value} description={s.description} />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Notification wording" description="What users see in their notifications. Untick to stop sending one." />
          <CardBody className="space-y-5">
            {(templates ?? []).map((t: { key: string; channel: string; body: string; enabled: boolean }) => (
              <TemplateForm key={t.key} tkey={t.key} channel={t.channel} body={t.body} enabled={t.enabled} placeholders={PLACEHOLDERS[t.key] ?? []} />
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
