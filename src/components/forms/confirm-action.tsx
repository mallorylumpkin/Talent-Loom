"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/actions/types";

/**
 * Small inline button for one-off actions (remove, set primary, request verification).
 * With `confirm`, the first click asks "Are you sure?" and the second click runs it.
 */
export function ActionButton({
  action, children, confirm, tone = "neutral", className,
}: {
  action: () => Promise<FormState | void>;
  children: React.ReactNode;
  confirm?: string;
  tone?: "neutral" | "danger" | "primary";
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (confirm && !armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setArmed(false);
    setError(null);
    start(async () => {
      const res = await action();
      if (res && !res.ok && res.message) setError(res.message);
    });
  }

  const colors = {
    neutral: "text-ink/70 hover:bg-ink/5 hover:text-ink",
    danger: armed ? "bg-danger text-white" : "text-danger-strong hover:bg-danger-soft",
    primary: "text-primary hover:bg-primary-soft",
  }[tone];

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={run} disabled={pending}
        className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors disabled:opacity-60", colors, className)}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {armed ? confirm : children}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-danger-strong">{error}</span>}
    </span>
  );
}
