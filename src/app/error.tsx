"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isSetup = error.message?.includes("Missing environment variable");

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-5 text-center">
      <TriangleAlert className="size-10 text-warning" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-ink">
        {isSetup ? "TalentLoom isn't configured yet" : "Something went wrong"}
      </h1>
      <p className="mt-2 max-w-md text-muted">
        {isSetup
          ? "Add your Supabase keys to .env.local (or Vercel environment variables). See docs/SETUP.md."
          : "Please try again. If it keeps happening, contact support."}
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <Button className="mt-8" onClick={reset}>Try again</Button>
    </div>
  );
}
