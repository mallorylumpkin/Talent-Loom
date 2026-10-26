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
- Creator-entered analytics are always stored as **self-reported**; editing staff-verified numbers resets them.
- **Connected accounts:** only server code can mark an account as connected or write API-verified numbers. Platform tokens are encrypted (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`) before storage, are not readable by any signed-in user (column-level grants), never enter the audit log, and are wiped when the account is removed, disconnected, or consent is withdrawn. The OAuth callback requires a signed, 15-minute, user-bound state cookie. Creators can't edit synced numbers, type numbers for a connected account, or change a connected account's handle; one platform account can be connected to only one creator. The daily sync endpoint requires `CRON_SECRET`.
- Messages require an open (accepted) conversation, an approved company, no block, and a matching sender; they can't be edited.
- **Inquiries** are sent only through `send_inquiry()`, which checks role permission, company approval, outreach freeze, the creator's discoverability and blocks, one open inquiry per creator, a 30-day cool-off after a decline, the plan's monthly contact limit (under a per-company lock so it can't be raced) and a 20-per-hour rate limit. Only the creator can accept or decline.
- Blocking a company declines its open inquiries and blocks the conversation immediately; messages are rate-limited (30/minute).
- Companies can only add creators to pipelines, notes or rosters if the creator is discoverable or already has a relationship with the company. Assignments require the plan feature and an active teammate.
- Company profiles are only visible to signed-in members, and only for approved companies.
- Super-admin powers require an **MFA (aal2) session**, checked inside the database.
- `audit_logs` rejects UPDATE, DELETE and TRUNCATE for every role.
- Internal helper functions live in a `private` schema that the public API cannot call.
- Analytics can't be stored without the creator's data consent, and a profile can't become discoverable without discoverability consent — both enforced in the database. Withdrawing consent hides the profile immediately.
- Public profiles and the directory are served by database functions that return only fields the creator marked Public.
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
