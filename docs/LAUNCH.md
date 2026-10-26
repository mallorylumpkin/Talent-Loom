# Going live — step by step

Do these in order. Each step says **where** to do it. Commands go in **Terminal** (a new window, not the one running the site).

## 1. Put the site on the internet (Vercel)

1. Go to **https://vercel.com** → sign in with GitHub → **Add New… → Project**.
2. Find **Talent-Loom** → **Import**. Framework: Next.js (automatic).
3. Open **Environment Variables** and add each line from your `.env.local` (open it with `open -e ~/Documents/talentloom/.env.local`), except change:
   - `NEXT_PUBLIC_SITE_URL` → leave it for now; you'll set it in step 4.
4. Click **Deploy**. When it finishes, copy your site address (like `https://talent-loom.vercel.app`).
5. **Settings → Environment Variables** → set `NEXT_PUBLIC_SITE_URL` to that address → **Deployments → ⋯ → Redeploy**.

Variables Vercel needs (copy from `.env.local`; make new random ones with the commands shown if you don't have them):

| Name | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | your Vercel address or domain |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (same value as local, never change it later) |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `IMPERSONATION_COOKIE_SECRET` | `openssl rand -base64 48` |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | [BILLING.md](BILLING.md) |
| `GOOGLE_*`, `INSTAGRAM_*`, `FACEBOOK_*`, `TIKTOK_*` | [SOCIAL-CONNECTIONS.md](SOCIAL-CONNECTIONS.md) (optional — add as you set each up) |

## 2. Point Supabase at the live site

Supabase → **Authentication → URL Configuration**:
- **Site URL** → your live address.
- **Redirect URLs** → add `https://YOUR-ADDRESS/**` (keep `http://localhost:3002/**` too).

## 3. Real emails (sign-up confirmations, password resets)

Supabase's built-in email only sends to your own team and a few per hour. Use Resend (free tier is fine to start):
1. **https://resend.com** → sign up → **Domains → Add domain** (needs a domain you own) → add the DNS records it shows at your domain provider → wait for "Verified".
2. Resend → **API Keys → Create** → copy it.
3. Supabase → **Project Settings → Authentication → SMTP Settings** → turn on **Custom SMTP**:
   host `smtp.resend.com`, port `465`, username `resend`, password = the API key, sender e.g. `hello@yourdomain.com`, name `TalentLoom`.
4. (Now available) Supabase → Authentication → **Email Templates**: personalise the confirmation and reset emails.

## 4. Payments (test mode first)

Follow [BILLING.md](BILLING.md) steps 1–6. Stay in test mode until you've checked everything.

## 5. Social connections

Follow [SOCIAL-CONNECTIONS.md](SOCIAL-CONNECTIONS.md). Add the live redirect URLs, then start each platform's review
early — they take days to weeks.

## 6. Daily jobs

Nothing to do: `vercel.json` schedules the daily social-account refresh, and Vercel sends `CRON_SECRET` automatically.
Check **Vercel → Settings → Cron Jobs** lists `/api/cron/sync-social`.

## 7. Your own domain (optional but recommended)

Vercel → **Settings → Domains** → add your domain → follow the DNS steps. Then update `NEXT_PUBLIC_SITE_URL` in Vercel,
the Site URL in Supabase, every platform redirect URL, and the Stripe webhook URL.

## 8. Before real users arrive

- [ ] Remove the fictional sample creators: `cd ~/Documents/talentloom` then `npm run seed:fictional -- --remove`
- [ ] Have a lawyer review the legal pages, then edit them in Admin → Legal pages and tick "reviewed"
- [ ] Upgrade Supabase to **Pro** (daily backups; project never pauses)
- [ ] Admin → Settings: check limits (messages per minute, inquiries per hour/day)
- [ ] Admin → Plans & pricing: final prices → Sync to Stripe
- [ ] Switch Stripe to live keys ([BILLING.md](BILLING.md) step 7)
- [ ] Create a second super admin (Admin → Users → make super admin) so you're never locked out
- [ ] Turn on the public company directory if you want it: Admin → Settings → `features.company_directory` = `true`
