# TalentLoom — Creator Management Network

TalentLoom connects growing social media creators with vetted management companies and talent agencies. Creators build a professional talent profile and control exactly what companies can see; approved companies search, save, contact and recruit creators through a structured pipeline.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Auth, Postgres, Row Level Security, Storage) · Stripe (test mode first) · Vercel

## Getting started

👉 **[docs/SETUP.md](docs/SETUP.md)** — step-by-step setup: Supabase, local development, first super admin, and deployment to Vercel.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys
npx supabase db push         # after linking your project (see SETUP.md)
npm run dev                  # http://localhost:3002
```

## Project layout

```
src/
  app/
    (public)/        Homepage, creator directory and profiles, pricing, for-companies (contact sales), legal pages
    (auth)/          Sign up (18+), sign in, forgot/reset password, check email
    auth/            Email-link confirmation and sign-out routes
    creator/         Creator dashboard, onboarding, profile, accounts, analytics, portfolio, media kit, privacy, settings
    company/         Company workspace: dashboard, search, creator details, lists, compare, profile, team, settings
    admin/           Super-admin console (role + MFA protected): leads, companies, review; MFA setup
    api/             OAuth callbacks for connected social accounts; daily sync job
  components/
    ui/              Buttons, fields, cards, badges, alerts, empty states
    layout/          Public header/footer, dashboard shell, navigation
    brand/           Logo
  lib/
    supabase/        Browser, server and server-only admin clients; session proxy
    auth/            Session helpers and role guards
    validation/      Zod schemas
    social/          Platform connections: providers, token encryption, sync
  proxy.ts           Refreshes the auth session on every request
supabase/
  migrations/        Database schema, security policies, storage, reference data
  tests/             Security test suite (185 checks)
scripts/             create-admin and fictional sample-data scripts
docs/                Setup, social connections, security model, build checklist
```

## Security model (summary)

- **Row Level Security on every table.** Companies can never read creator tables directly; they'll use masking functions that apply each creator's field-level privacy settings.
- **Roles live in the database**, never in user-editable metadata. Public sign-up can only create creator accounts; company accounts are created by TalentLoom staff.
- **Super admin** is created once with `bootstrap_super_admin()` from the Supabase SQL editor and requires **two-factor authentication** — enforced in the database, not just the UI.
- **Plan limits** (social accounts, seats, saved creators, pipelines) are enforced by database triggers.
- **Analytics provenance:** anything a creator types is stored as *self-reported*; only staff review or a creator's connected platform account (official APIs, see [docs/SOCIAL-CONNECTIONS.md](docs/SOCIAL-CONNECTIONS.md)) can produce verified numbers.
- **Append-only audit log** that even the database owner cannot edit or delete.

Details: [docs/SECURITY.md](docs/SECURITY.md). Build progress: [docs/CHECKLIST.md](docs/CHECKLIST.md).

## Sample data

All sample people, companies and numbers used in tests and seed data are **fictional** and labelled as such.
