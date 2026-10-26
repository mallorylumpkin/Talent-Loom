import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ConnectConsentForm } from "@/components/creator/connect-forms";
import { getCreatorContext } from "@/lib/creator/context";
import { tokenEncryptionConfigured } from "@/lib/social/crypto";
import { getProvider } from "@/lib/social/providers";

export const metadata: Metadata = { title: "Connect an account" };

export default async function ConnectPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider: key } = await params;
  const provider = getProvider(key);
  if (!provider) notFound();
  await getCreatorContext();
  const available = provider.configured() && tokenEncryptionConfigured();

  return (
    <>
      <Link href="/creator/social-accounts" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Social accounts
      </Link>
      <PageHeader
        title={`Connect ${provider.label}`}
        description={`Sign in with ${provider.label} so companies see your real numbers, labelled Verified.`}
      />
      <div className="max-w-2xl space-y-6">
        {!available ? (
          <Alert tone="warning" title="Not available yet">
            {provider.label} connections haven&apos;t been switched on for TalentLoom yet. You can still add this account manually
            and request verification with screenshots.
          </Alert>
        ) : (
          <>
            <Card className="space-y-4 p-6">
              <ul className="space-y-3 text-sm text-ink">
                <li className="flex gap-3"><Eye className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span><strong>What we read:</strong> your username, follower count, and likes, comments and views on your recent posts.</span></li>
                <li className="flex gap-3"><EyeOff className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span><strong>What we can&apos;t do:</strong> post, message, delete or change anything on your account. We never see your password.</span></li>
                <li className="flex gap-3"><RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span><strong>Updates:</strong> numbers refresh once a day. Disconnect any time from Social accounts.</span></li>
              </ul>
              <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">{provider.requirement}</p>
            </Card>
            <ConnectConsentForm provider={provider.key} label={provider.label} />
          </>
        )}
      </div>
    </>
  );
}
