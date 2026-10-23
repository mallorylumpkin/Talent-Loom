"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/actions/types";
import { resetPasswordAction } from "../actions";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  const e = state.errors ?? {};

  return (
    <div>
      <h1 className="text-3xl font-bold text-ink">Choose a new password</h1>
      <p className="mt-2 text-muted">Use at least 10 characters, with a letter and a number.</p>

      <form action={action} className="mt-8 space-y-5" noValidate>
        {state.message && <Alert tone="danger">{state.message}</Alert>}
        <Field label="New password" name="password" error={e.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password"
            invalid={!!e.password} aria-describedby="password-error" required />
        </Field>
        <Field label="Confirm new password" name="confirmPassword" error={e.confirmPassword}>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password"
            invalid={!!e.confirmPassword} aria-describedby="confirmPassword-error" required />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingLabel="Saving…">
          Update password
        </SubmitButton>
      </form>
    </div>
  );
}
