"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (uploads to your own folder,
 * realtime message updates, MFA enrolment). Uses the publishable key;
 * Row Level Security protects all data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
