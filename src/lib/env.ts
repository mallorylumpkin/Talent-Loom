/**
 * Typed access to environment variables with clear errors when something
 * is missing. Public values are inlined by Next.js at build time, so they
 * must be referenced as literal `process.env.NEXT_PUBLIC_*` expressions.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in (see docs/SETUP.md).`,
    );
  }
  return value;
}

/**
 * Keeps only https://<project>.supabase.co even if extra path text such as
 * /rest/v1/ was pasted, which would otherwise break every auth request.
 */
export function normalizeSupabaseUrl(value: string): string {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

export const publicEnv = {
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002").replace(/\/$/, ""),
  supabaseUrl: () => normalizeSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)),
  supabaseKey: () =>
    required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
};
