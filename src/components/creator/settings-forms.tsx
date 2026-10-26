"use client";

import { ActionForm, FormSubmit } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { changePasswordAction, deleteAccountAction } from "@/app/creator/_actions/settings";

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="password" label="New password" type="password" autoComplete="new-password"
          hint="At least 10 characters, with a letter and a number." />
        <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
      </div>
      <FormSubmit variant="secondary" pendingLabel="Updating…">Update password</FormSubmit>
    </ActionForm>
  );
}

export function DeleteAccountForm() {
  return (
    <ActionForm action={deleteAccountAction}>
      <TextField name="confirm" label={<>Type <strong>DELETE</strong> to confirm</>} autoComplete="off" />
      <FormSubmit variant="danger" pendingLabel="Deleting…">Permanently delete my account</FormSubmit>
    </ActionForm>
  );
}
