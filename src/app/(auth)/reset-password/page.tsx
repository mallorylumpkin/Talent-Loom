import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const welcome = (await searchParams).welcome === "1";
  return (
    <div>
      <h1 className="text-3xl font-bold text-ink">{welcome ? "Welcome to TalentLoom" : "Choose a new password"}</h1>
      <p className="mt-2 text-muted">
        {welcome
          ? "Your account is ready. Choose a password to finish setting it up."
          : "Use at least 10 characters, with a letter and a number."}
      </p>
      <ResetPasswordForm welcome={welcome} />
    </div>
  );
}
