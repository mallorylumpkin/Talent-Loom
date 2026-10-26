"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/actions/types";

export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

interface Ctx {
  state: FormState;
  pending: boolean;
}
const FormCtx = createContext<Ctx>({ state: {}, pending: false });
export const useActionForm = () => useContext(FormCtx);

/**
 * Form wired to a Server Action. Unlike a plain <form action>, it does NOT wipe
 * what the user typed when the server returns an error.
 * `prepare` can run before submit (used for file uploads) and may cancel by returning an error string.
 */
export function ActionForm({
  action,
  children,
  hidden,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  prepare,
}: {
  action: FormAction;
  children: ReactNode;
  hidden?: Record<string, string | undefined>;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
  prepare?: (fd: FormData) => Promise<string | null>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLocalError(null);
    if (prepare) {
      setPreparing(true);
      const err = await prepare(fd).finally(() => setPreparing(false));
      if (err) {
        setLocalError(err);
        return;
      }
    }
    startTransition(() => formAction(fd));
  }

  const showMessage = !localError && state.message && (!state.ok || showSuccess);
  const busy = pending || preparing;

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className ?? "space-y-5"} noValidate>
      <FormCtx.Provider value={{ state, pending: busy }}>
        {hidden &&
          Object.entries(hidden).map(([k, v]) => (v === undefined ? null : <input key={k} type="hidden" name={k} value={v} />))}
        {localError && <Alert tone="danger">{localError}</Alert>}
        {showMessage && (
          <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
        )}
        {children}
      </FormCtx.Provider>
    </form>
  );
}

export function FormSubmit({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useActionForm();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} className={className}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}

/** Field error for `name` from the last submission. */
export function useFieldError(name: string): string | undefined {
  return useActionForm().state.errors?.[name];
}

/** Last submitted value for `name` (so inputs keep their value after an error re-render). */
export function useFieldValue(name: string, fallback?: string | null): string | undefined {
  const v = useActionForm().state.values?.[name];
  return v ?? fallback ?? undefined;
}
