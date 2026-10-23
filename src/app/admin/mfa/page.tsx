import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { requireAdmin } from "@/lib/auth/session";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function AdminMfaPage() {
  await requireAdmin({ allowWithoutMfa: true });
  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-10">
      <Logo href="/" />
      <div className="mt-12 w-full max-w-md">
        <h1 className="text-3xl font-bold text-ink">Secure the admin console</h1>
        <p className="mt-2 text-muted">
          Admin access requires a second factor. Use an authenticator app such as 1Password, Google Authenticator or Authy.
        </p>
        <div className="mt-8">
          <MfaForm />
        </div>
      </div>
    </div>
  );
}
