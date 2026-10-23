# Security model

## Layers

| Layer | What it enforces |
|---|---|
| **Database (RLS + triggers)** | Who can read and write every row; protected fields; plan limits; append-only audit log. This is the real boundary — everything else is convenience. |
| **Server Actions / Route Handlers** | Input validation (Zod), friendly errors, redirects. Never trusts values from the browser for roles, prices or plan access. |
| **Proxy (`src/proxy.ts`)** | Refreshes sessions; sends signed-out visitors away from dashboards. |
| **Layouts** | `requireRole()` / `requireAdmin()` route each account type to its own area. |
| **UI** | Hides what you can't do. Never relied on for security. |

## Key rules (all covered by `supabase/tests/rls_test.sql`)

- Sign-up without the 18+ confirmation is rejected **by the database**, even if someone calls the auth API directly.
- User-supplied metadata can never set a role. Company accounts are created server-side; the super admin is created with `bootstrap_super_admin()`.
- Creators see and edit only their own data. Companies see only their own workspace. No company can read creator tables directly.
- Protected fields (role, status, featured flags, company approval, verification fields) can only be changed by privileged server code or an MFA-verified super admin.
- Creator-entered analytics are always stored as **self-reported**; editing verified numbers resets them.
- Messages require an open (accepted) conversation, an approved company, no block, and a matching sender; they can't be edited.
- Super-admin powers require an **MFA (aal2) session**, checked inside the database.
- `audit_logs` rejects UPDATE, DELETE and TRUNCATE for every role.
- Internal helper functions live in a `private` schema that the public API cannot call.
- Storage: users can only write inside a folder named with their own user id; company logos only by members with `company.edit`; private buckets are never public.

## Secrets

- `SUPABASE_SECRET_KEY` is only read in `src/lib/supabase/admin.ts`, which imports `server-only` so the build fails if it reaches the browser.
- `.env*` files are gitignored (except `.env.example`, which contains no real values).

## Running the security tests

The suite needs a Supabase-compatible Postgres. With Docker installed you can run a local Supabase:

```bash
npx supabase start
npx supabase db reset            # applies all migrations
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/rls_test.sql
```

A clean run ends with `ALL SECURITY TESTS PASSED`. **Never run the test suite against your production database** — it creates fictional test users.
