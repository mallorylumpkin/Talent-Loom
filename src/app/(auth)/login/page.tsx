import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { getViewer, homeFor, safeNext } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const viewer = await getViewer();
  if (viewer) redirect(safeNext(params.next, homeFor(viewer)));

  return (
    <div>
      <h1 className="text-3xl font-bold text-ink">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to your TalentLoom account.</p>

      <div className="mt-6 space-y-3">
        {params.reset && <Alert tone="success">Password updated. Sign in with your new password.</Alert>}
        {params.signed_out && <Alert tone="info">You've been signed out.</Alert>}
        {params.link_error && (
          <Alert tone="warning" title="That link didn't work">
            It may have expired or already been used. Sign in, or request a new link.
          </Alert>
        )}
      </div>

      <div className="mt-6">
        <LoginForm next={params.next ? safeNext(params.next) : undefined} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        New creator?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
