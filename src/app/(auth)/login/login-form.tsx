"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/actions/types";
import { signInAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}

      <Field label="Email" name="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email}
          invalid={!!e.email} aria-describedby="email-error" required />
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password"
          invalid={!!e.password} aria-describedby="password-error" required />
        {e.password && <p id="password-error" className="text-sm text-danger-strong">{e.password}</p>}
      </div>

      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
