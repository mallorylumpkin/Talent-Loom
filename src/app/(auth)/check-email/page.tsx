import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <MailCheck className="size-7" aria-hidden />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-ink">Check your email</h1>
      <p className="mt-3 text-muted">
        We sent a confirmation link to{" "}
        <span className="font-medium text-ink">{email ?? "your inbox"}</span>. Open it to verify your
        account and start your profile.
      </p>
      <p className="mt-6 text-sm text-muted">
        Didn't get it? Check spam, or{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          try again
        </Link>
        .
      </p>
    </div>
  );
}
