import type { Metadata } from "next";
import { Download, Link2Off } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Section } from "@/components/creator/section";
import { ChangePasswordForm, DeleteAccountForm } from "@/components/creator/settings-forms";
import { getCreatorContext } from "@/lib/creator/context";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const { viewer } = await getCreatorContext();
  return (
    <>
      <PageHeader title="Account settings" />
      <div className="space-y-6">
        <Section title="Sign-in">
          <p className="mb-5 text-sm text-muted">
            Signed in as <span className="font-medium text-ink">{viewer.email}</span>. To change your email address, contact support.
          </p>
          <ChangePasswordForm />
        </Section>

        <Section title="Connected platforms">
          <div className="flex gap-3 text-sm text-muted">
            <Link2Off className="size-5 shrink-0" aria-hidden />
            <p>You haven't connected any platform accounts. When official Instagram, TikTok and YouTube connections launch, you'll be
              able to connect and disconnect them here at any time.</p>
          </div>
        </Section>

        <Section title="Your data" description="Download a copy of everything TalentLoom stores about you.">
          {/* A plain link: the browser downloads the JSON file. */}
          <a href="/creator/settings/export" className={buttonClasses("secondary", "md")}>
            <Download className="size-4" aria-hidden /> Download my data
          </a>
        </Section>

        <Section title="Delete account">
          <Alert tone="danger" className="mb-5" title="This can't be undone">
            Your profile, accounts, analytics, files, messages and history will be permanently deleted. Management companies will no
            longer be able to see or contact you.
          </Alert>
          <DeleteAccountForm />
        </Section>
      </div>
    </>
  );
}
