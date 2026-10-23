import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth/session";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Join as a creator" };

export default async function SignUpPage() {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer));

  return (
    <div>
      <p className="text-sm font-medium text-accent-strong">For creators · Free</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">Build your talent profile</h1>
      <p className="mt-2 text-muted">
        Get discovered by vetted management companies. It takes about five minutes.
      </p>
      <div className="mt-8">
        <SignUpForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        Representing creators?{" "}
        <Link href="/for-companies#contact" className="font-medium text-primary hover:underline">
          Talk to our team
        </Link>
      </p>
    </div>
  );
}
