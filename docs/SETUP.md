# TalentLoom setup guide

Follow these steps in order. Each step says **which tool to open** and **exactly what to click or type**. Plan on about 45 minutes the first time.

> **Terminal** means: on Mac, open the **Terminal** app; on Windows, open **PowerShell**. Paste the command after the `$` (don't type the `$` itself) and press Enter.

---

## Part 1 — Install the tools on your computer (one time)

### 1.1 Node.js
1. Go to **https://nodejs.org** and download the **LTS** version (22.x or newer).
2. Run the installer with the default options.
3. Check it worked, in Terminal:
   ```
   $ node -v
   ```
   You should see `v22...` or higher.

### 1.2 Git
- **Mac:** in Terminal run `git --version`. If it asks to install developer tools, click **Install**.
- **Windows:** download from **https://git-scm.com/download/win** and install with defaults.

### 1.3 Supabase CLI and Stripe CLI
You'll run these through `npx`, so there's nothing to install now.

---

## Part 2 — Get the code onto your computer

1. In Terminal, go to where you keep projects (for example your Documents folder):
   ```
   $ cd ~/Documents
   ```
2. Download the code:
   ```
   $ git clone https://github.com/mallorylumpkin/Talent-Loom.git talentloom
   $ cd talentloom
   ```
3. Install the app's packages (takes a minute or two):
   ```
   $ npm install
   ```

---

## Part 3 — Create your Supabase project

### 3.1 Create the project
1. Go to **https://supabase.com** → **Sign in** (GitHub sign-in is easiest).
2. Click **New project**.
3. **Name:** `talentloom` · **Database password:** click **Generate a password** and **save it in your password manager** — you'll need it in step 3.3 · **Region:** the one closest to your users (e.g. *East US*).
4. Click **Create new project** and wait about 2 minutes.

### 3.2 Copy your keys
1. In your project, click **Project Settings** (gear icon, bottom left) → **API Keys**.
2. Keep this tab open. You need:
   - **Project URL** (Project Settings → **Data API**, or shown at the top of API Keys)
   - **Publishable key** (starts with `sb_publishable_`)
   - **Secret key** (starts with `sb_secret_`) — click **Reveal**. **Never share this or put it in any file that gets committed.**

   *If your project only shows "anon" and "service_role" keys, use those: anon = publishable, service_role = secret.*

### 3.3 Create the database tables (run the migrations)
In Terminal, inside the `talentloom` folder:
```
$ npx supabase init
```
Answer **N** to both questions (VS Code / IntelliJ settings). Then:
```
$ npx supabase login
```
A browser window opens — click **Authorize**. Then link your project. Your **project ref** is the part of your Project URL between `https://` and `.supabase.co`:
```
$ npx supabase link --project-ref YOUR_PROJECT_REF
```
Enter the database password from step 3.1 when asked. Then create everything:
```
$ npx supabase db push
```
Type **Y** to confirm. You should see 8 migrations applied.

> **Alternative (no CLI):** In Supabase, open **SQL Editor** → **New query**, paste the contents of each file in `supabase/migrations/` **in filename order**, and click **Run** for each one.

### 3.4 Configure authentication
In Supabase, go to **Authentication**:

1. **URL Configuration**
   - **Site URL:** `http://localhost:3002` (you'll change this to your real domain in Part 6)
   - **Redirect URLs** → **Add URL**: `http://localhost:3002/**`
2. **Sign In / Providers** → **Email**: make sure **Confirm email** is **ON**. Click **Save**.
3. **Emails** (Email Templates) — **skip this for now.** On the free plan Supabase only lets you edit templates after you connect your own email sender (Part 6.4). The default templates already work: just open confirmation and reset links **in the same browser** you used to sign up. Once custom SMTP is connected, set these templates so links work on any device:
   - **Confirm signup** link:
     ```
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/creator">Confirm your email</a>
     ```
   - **Reset password** link:
     ```
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
     ```
4. **Multi-Factor** (under Authentication → **Sign In / Providers** or **MFA**): make sure **TOTP (Authenticator app)** is **enabled**. Admins need it.
5. **Attack Protection / Passwords:** turn on **Leaked password protection** if available on your plan, and set **Minimum password length** to **10**.

> Supabase's built-in email sender is limited to a few emails per hour — fine for testing. Before launch, connect a real email provider (Part 6.4).

---

## Part 4 — Run TalentLoom on your computer

1. Create your local settings file:
   ```
   $ cp .env.example .env.local
   ```
   *(Windows PowerShell: `Copy-Item .env.example .env.local`)*
2. Open `.env.local` in a text editor (VS Code, TextEdit in plain-text mode, or Notepad) and fill in:
   ```
   NEXT_PUBLIC_SITE_URL=http://localhost:3002
   NEXT_PUBLIC_SUPABASE_URL=   ← Project URL from 3.2
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   ← Publishable key from 3.2
   SUPABASE_SECRET_KEY=   ← Secret key from 3.2
   ```
   Leave the Stripe and other lines empty for now. Save the file.
3. Start the app:
   ```
   $ npm run dev
   ```
4. Open **http://localhost:3002** in your browser. You should see the TalentLoom homepage.

**Quick test:** click **Join free**, sign up with a real email address you can check, open the confirmation email, click the link. You should land on your creator dashboard.

To stop the app, press **Ctrl + C** in Terminal.

---

## Part 5 — Create your Super Admin account (one time)

The admin role can never be chosen at sign-up. Create it with this command (it doesn't need email):

1. In Terminal, in your project folder:
   ```
   $ npm run create-admin
   ```
2. Enter an email for the admin account. Use a **different** email from your creator test account — a "plus" address works,
   e.g. `you+admin@yahoo.com`. Then choose a password (12+ characters; nothing shows while you type).
3. Sign out of TalentLoom, then sign in with the admin email. You'll be asked to set up two-factor authentication: scan the
   QR code with an authenticator app (1Password, Google Authenticator, Authy) and enter the 6-digit code.

The command refuses to run once an admin exists. (Alternative: sign up normally, then run
`select public.bootstrap_super_admin('you@yourdomain.com');` in the Supabase SQL Editor.)

### Recommended: make setup links last longer
Company accounts get a one-time "setup link" to choose their password. By default it expires after 1 hour. To give people
a day: Supabase → **Authentication** → **Sign In / Providers** → **Email** → set **Email OTP Expiration** to `86400` → **Save**.

## Part 6 — Deploy to the internet with Vercel

### 6.1 Connect the repository
1. Go to **https://vercel.com** → **Sign up / Log in with GitHub**.
2. Click **Add New… → Project**.
3. Find **Talent-Loom** and click **Import**. (If you don't see it, click **Adjust GitHub App Permissions** and grant access to the repo.)
4. **Framework Preset:** Next.js (auto-detected). Leave build settings as they are.

### 6.2 Add environment variables
Before clicking Deploy, open **Environment Variables** and add each of these (same values as `.env.local`, except the site URL):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://YOUR-PROJECT.vercel.app` (or your domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key |

Click **Deploy**. When it finishes, click **Visit**.

### 6.3 Point Supabase at your live site
In Supabase → **Authentication** → **URL Configuration**:
- Change **Site URL** to your live URL (e.g. `https://talentloom.vercel.app`).
- **Add** to Redirect URLs: `https://talentloom.vercel.app/**` (keep the localhost one for development).

### 6.4 Before real users (launch checklist)
- **Custom domain:** Vercel → Project → **Settings → Domains** → add your domain and follow the DNS instructions. Then update `NEXT_PUBLIC_SITE_URL` in Vercel and the Site URL in Supabase.
- **Email provider (also unlocks custom email templates — see Part 3.4 step 3):** create an account with an email service such as **Resend** or **Postmark**, verify your domain, then in Supabase → **Project Settings → Authentication → SMTP Settings**, turn on **Custom SMTP** and paste their SMTP details.
- **Supabase plan:** upgrade to **Pro** for daily backups and so the project never pauses.
- **Legal pages:** have an attorney review the templates (they're editable in the admin console in Phase 5).

From now on, every time code is pushed to GitHub, Vercel redeploys automatically.

---

## Updating to a new phase

Each time a new phase is pushed to GitHub, stop the site (Control + C) and run:
```
$ git pull
$ npm install
$ npx supabase db push
$ npm run dev
```
`npm install` only does something when new packages were added; `db push` applies any new database changes (type **Y** to confirm).

## Optional: fictional sample creators

To see the creator directory with content while testing:
```
$ npm run seed:fictional
```
This adds 6 creators clearly labelled "(fictional)". Remove them before launch:
```
$ npm run seed:fictional -- --remove
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "TalentLoom isn't configured yet" | `.env.local` is missing or has a typo. Restart `npm run dev` after editing it. |
| Confirmation link says "That link didn't work" | Open the link in the same browser you signed up in (until custom templates are set up), and check the Site URL matches the address you're using. |
| "You must confirm you are 18 or older" | The sign-up form requires the 18+ checkbox; accounts can't be created without it. |
| Admin keeps asking for a code | Make sure your phone's clock is set automatically; codes depend on accurate time. |
| `supabase db push` asks for a password | Use the database password from step 3.1 (reset it in Project Settings → Database if lost). |
