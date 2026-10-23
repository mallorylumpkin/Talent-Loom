"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/actions/types";
import { forgotPasswordAction } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);

  return (
    <div>
      <h1 className="text-3xl font-bold text-ink">Reset your password</h1>
      <p className="mt-2 text-muted">Enter your email and we'll send you a link to choose a new password.</p>

      <form action={action} className="mt-8 space-y-5" noValidate>
        {state.ok && <Alert tone="success">{state.message}</Alert>}
        <Field label="Email" name="email" error={state.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email}
            invalid={!!state.errors?.email} aria-describedby="email-error" required />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
