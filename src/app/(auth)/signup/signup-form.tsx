"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/actions/types";
import { signUpAction } from "../actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialFormState);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  // Latest allowed birthday for an 18-year-old, as a hint for the date picker.
  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Field label="Your name" name="displayName" error={e.displayName}>
        <Input id="displayName" name="displayName" autoComplete="name" defaultValue={v.displayName}
          invalid={!!e.displayName} aria-describedby="displayName-error" required />
      </Field>

      <Field label="Email" name="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email}
          placeholder="you@example.com" invalid={!!e.email} aria-describedby="email-error" required />
      </Field>

      <Field label="Password" name="password" error={e.password} hint="At least 10 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password"
          invalid={!!e.password} aria-describedby="password-error" required />
      </Field>

      <Field label="Date of birth" name="dateOfBirth" error={e.dateOfBirth}
        hint="Used only to confirm you're 18 or older. We don't store it.">
        <Input id="dateOfBirth" name="dateOfBirth" type="date" max={maxDob} defaultValue={v.dateOfBirth}
          invalid={!!e.dateOfBirth} aria-describedby="dateOfBirth-error" required />
      </Field>

      <div className="space-y-3 rounded-xl bg-canvas p-4">
        <Checkbox name="confirm18" error={e.confirm18}>
          I confirm I am <strong>18 years of age or older</strong>.
        </Checkbox>
        <Checkbox name="acceptTerms" error={e.acceptTerms}>
          I agree to the{" "}
          <Link href="/legal/terms" className="font-medium text-primary underline-offset-2 hover:underline" target="_blank">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="font-medium text-primary underline-offset-2 hover:underline" target="_blank">
            Privacy Policy
          </Link>
          .
        </Checkbox>
      </div>

      <SubmitButton className="w-full" size="lg" pendingLabel="Creating your account…">
        Create creator account
      </SubmitButton>
    </form>
  );
}
