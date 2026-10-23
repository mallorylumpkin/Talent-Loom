# Build checklist

Legend: ✅ done and in the repo · 🔜 next · ⬜ planned

## Phase 1 — Foundation ✅
- ✅ Next.js 16 + TypeScript + Tailwind 4 project, security headers
- ✅ Design system: colors, fonts (Bricolage Grotesque, Inter, Instrument Serif), logo, UI kit (buttons, fields, cards, badges incl. provenance + sponsored, alerts, empty states)
- ✅ Database schema: 73 tables for identity, creators, analytics, companies, recruiting, messaging, Pro tools, billing, platform, audit
- ✅ Row Level Security on every table; private helper schema; guard triggers; plan-limit triggers
- ✅ Storage buckets (9) with owner-folder policies
- ✅ Reference data: 6 plans with your prices and limits, 32 features, roles and permissions, niches, categories, platforms, settings, 8 legal templates, 15 notification templates, 9 optional add-ons (all off)
- ✅ Append-only audit log + automatic audit triggers on sensitive tables
- ✅ Security test suite — 71 checks passing on PostgreSQL 16
- ✅ Creator sign-up with 18+ gate (date of birth checked, not stored), email confirmation, sign in, forgot/reset password
- ✅ Role routing: creator, company, super admin dashboards; admin requires TOTP two-factor
- ✅ First-super-admin bootstrap procedure
- ✅ Public site: homepage, pricing (live from database), For Companies with contact-sales form (rate-limited, honeypot), legal pages
- ✅ Responsive dashboard shell with mobile navigation
- ✅ Setup and deployment guide

## Phase 2 — Creator profile 🔜
- ⬜ Onboarding wizard
- ⬜ Edit profile, photo and cover upload
- ⬜ Niches, categories, support wanted, representation status
- ⬜ Social accounts and manual analytics + audience demographics
- ⬜ Analytics evidence upload + verification request
- ⬜ Portfolio, media kit, brand partnerships
- ⬜ Privacy & discoverability matrix with consent
- ⬜ Public creator profile + creator directory
- ⬜ Account settings (delete account, data export request)
- ⬜ Fictional seed data for creators

## Phase 3 — Companies & search
- ⬜ Admin: sales leads → create company → assign plan → invite owner
- ⬜ Team invites and roles; company profile and application
- ⬜ Creator search with all filters, privacy masking, search index
- ⬜ Creator details, saved lists, comparison

## Phase 4 — Relationships
- ⬜ Representation inquiries (atomic, plan-limited, rate-limited)
- ⬜ Messaging with realtime, unread counts, archive, block, report
- ⬜ Recruiting pipeline board, notes, assignments, signed-talent roster
- ⬜ In-app notifications

## Phase 5 — Admin console
- ⬜ Users, creators, companies (full lifecycle), verification queue, reports
- ⬜ Taxonomy, platforms, featured profiles, settings, legal pages, templates, support
- ⬜ Audit log viewer, CSV exports, impersonation

## Phase 6 — Billing
- ⬜ Stripe products sync, Checkout and Customer Portal (Creator Pro)
- ⬜ Admin-assigned company subscriptions (invoice billing) and complimentary plans
- ⬜ Webhooks, usage meters, promo codes, trials, credits, MRR/churn
- ⬜ Optional add-ons behind feature flags

## Phase 7 — Pro tools & polish
- ⬜ Affiliate Code Vault, Brand-Deal Tracker, creator insights
- ⬜ Remaining public pages (How it works, For creators, About, Contact, FAQ, Report a user)
- ⬜ Accessibility pass, full seed data, testing and social-API integration guide
