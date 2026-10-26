"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Re-renders the page when a new row arrives (Supabase Realtime). The database's
 * row-level security decides which rows this browser is allowed to hear about.
 */
export function LiveRefresh({ table, filter, channel }: { table: "messages" | "notifications"; filter: string; channel: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(channel)
      .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 250);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(sub);
    };
  }, [table, filter, channel, router]);

  return null;
}
