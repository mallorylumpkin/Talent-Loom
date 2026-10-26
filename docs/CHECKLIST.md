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

## Phase 2 — Creator profile ✅
- ✅ 5-step onboarding wizard (about you → content → platforms → goals → go live), with "finish later"
- ✅ Edit profile: name, handle, headline, bio, location, contact preference
- ✅ Profile photo and cover image uploads
- ✅ Niches, content types, preferred industries, support wanted, seeking-management, representation status
- ✅ Social accounts: add, remove, set primary (Free plan limit of 3 enforced in the database)
- ✅ Manual analytics per account with history, audience demographics (age, gender, top countries)
- ✅ Evidence uploads (private) and verification requests; numbers always labelled self-reported until verified
- ✅ Portfolio (links, images, PDFs; per-item visibility and featuring; Free plan limit of 12)
- ✅ Brand partnerships
- ✅ Media kit upload (private file; shared only through short-lived links when allowed)
- ✅ Privacy matrix (public / approved companies / only me) for 10 kinds of information
- ✅ Discoverability with recorded consent; consent required by the database; withdrawing consent hides the profile
- ✅ Consent history with withdraw
- ✅ Public creator profile (privacy-masked, owner preview, view counter) and creator directory with filters
- ✅ Profile-strength checklist on the dashboard
- ✅ Account settings: change password, download my data (JSON), permanently delete account
- ✅ Fictional sample creators script (`npm run seed:fictional`, remove with `-- --remove`)
- ✅ Security test suite extended — 85 checks passing

## Phase 3 — Companies & search ✅
- ✅ `npm run create-admin` creates the first super admin without email delivery
- ✅ Admin: sales leads inbox with status and notes; "Create company from lead"
- ✅ Admin: create company + assign plan (complimentary until Phase 6) + create owner account + one-time setup link
- ✅ Admin: company review (approve, request info, reject, suspend, reactivate) with history and member notifications
- ✅ Admin: change plan, verified badge, freeze outreach, featured; add members; issue setup links (audit-logged)
- ✅ Company: dashboard with setup checklist and plan limits
- ✅ Company: profile, logo, categories represented, specialties, submit for review
- ✅ Company: team invites with one-time setup links, roles, removal; seat limits; owner-only rules
- ✅ Creator search: keyword, niche, platform, location, followers, seeking, representation, sort; advanced filters
  (engagement, growth, content type, audience, recently active, verified only) on Agency plans
- ✅ Privacy-respecting results: unapproved companies see public fields; approved see "approved companies" fields;
  detailed analytics need the permissioned-analytics plan feature; filters never match hidden values
- ✅ Creator detail page for companies (views counted once per company per day; media kit when allowed)
- ✅ Saved talent: one-click save, lists, private lists (Agency Pro), plan limits
- ✅ Side-by-side comparison of 2–4 creators (Agency plans)
- ✅ Company settings: plan features and password change
- ✅ Security suite extended — 93 checks passing

## Phase 4 — Relationships 🔜
- ⬜ Representation inquiries (atomic, plan-limited, rate-limited)
- ⬜ Messaging with realtime, unread counts, archive, block, report
- ⬜ Recruiting pipeline board, notes, assignments, signed-talent roster
- ⬜ In-app notifications
- ⬜ Public company profile pages (shown to creators with inquiries)

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
- ⬜ Custom media-kit page and advanced insights (Creator Pro)
- ⬜ Accessibility pass, full seed data, testing and social-API integration guide
