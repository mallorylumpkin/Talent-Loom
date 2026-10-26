# Connected social accounts — setup guide

Creators can connect **YouTube, Instagram and TikTok** with each platform's own sign-in. TalentLoom then reads their
numbers directly from the platform's official API, refreshes them daily, and companies see them labelled
**Verified · connected**. Anything a creator types stays **Self-reported**; numbers our team checks from screenshots
are **Verified · reviewed**.

Nothing here is simulated. A platform's "Connect" button only appears once you've added that platform's developer
keys, and real connections only work after you've created a developer app with each platform (steps below).

---

## How it works

1. Creator clicks **Connect Instagram** (Social accounts page) → sees what's read and gives consent.
2. They're sent to the platform's own sign-in and approve read-only access.
3. The platform sends them back to `/api/oauth/<platform>/callback`. TalentLoom checks a signed, 15-minute state
   cookie, swaps the one-time code for tokens, and reads the account.
4. Tokens are **encrypted (AES-256-GCM)** with `TOKEN_ENCRYPTION_KEY` before they're stored and can never be read by
   signed-in users — only the server.
5. Numbers are saved as API-verified. A daily job (`/api/cron/sync-social`, scheduled in `vercel.json`) refreshes
   them. Creators can also press **Sync now** (once every 10 minutes).
6. **Disconnect** (or removing the account, or withdrawing consent on the Privacy page) revokes access at the platform
   where the platform allows it and deletes the tokens. Earlier verified numbers stay, labelled with their date.

What's read:

| Platform | Followers | Avg. views | Avg. likes / comments | Engagement rate |
|---|---|---|---|---|
| YouTube | Subscribers (unless hidden by the creator) | Last 12 videos | Last 12 videos | ✓ |
| Instagram | Followers | — (needs an extra Instagram permission; not requested yet) | Last 12 posts | ✓ |
| TikTok | Followers | Last 20 videos | Last 20 videos | ✓ |

Engagement rate = (average likes + average comments) ÷ followers × 100. 30-day growth is only calculated against
earlier *connected* numbers, never against typed ones. Audience demographics aren't read from platforms yet.

Security rules are enforced in the database (see tests SC-1…SC-20 in `supabase/tests/rls_test.sql`): creators can't
mark an account as connected, edit synced numbers, type numbers for a connected account, attach demographics to
verified numbers, or change a connected account's handle; one platform account can only be connected to one creator.

---

## Step 0 — Update TalentLoom and add the encryption key

In Terminal, in your project folder:

```bash
git pull
npx supabase db push
```

Create the encryption key and the cron secret (each prints one random line):

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Add them to `.env.local` (and later to **Vercel → Project → Settings → Environment Variables**):

```
TOKEN_ENCRYPTION_KEY=<first line>
CRON_SECRET=<second line>
```

⚠️ Keep `TOKEN_ENCRYPTION_KEY` the same forever once creators connect. If it changes, every creator has to reconnect.

Restart `npm run dev` after editing `.env.local`.

**Redirect URLs** — every platform asks for these. Use exactly:

| | Local (YouTube only) | Live site |
|---|---|---|
| YouTube | `http://localhost:3002/api/oauth/youtube/callback` | `https://YOUR-DOMAIN/api/oauth/youtube/callback` |
| Instagram | — (needs https) | `https://YOUR-DOMAIN/api/oauth/instagram/callback` |
| TikTok | — (needs https) | `https://YOUR-DOMAIN/api/oauth/tiktok/callback` |

`YOUR-DOMAIN` must match `NEXT_PUBLIC_SITE_URL` (for example your `….vercel.app` address). Instagram and TikTok only
accept https web addresses, so test those on your deployed Vercel site.

---

## Step 1 — YouTube (Google Cloud) — start here; it works on localhost

1. Go to **https://console.cloud.google.com** → top bar project picker → **New project** → name it `TalentLoom` → Create.
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform**) → **Get started**:
   - App name `TalentLoom`, your support email → **External** audience → your contact email → Create.
   - **Data access → Add or remove scopes** → tick `.../auth/youtube.readonly` → Update → Save.
   - **Audience → Test users → Add users** → add the Google accounts you'll test with.
4. **Clients** (or **Credentials → Create credentials → OAuth client ID**) → type **Web application**:
   - Authorized redirect URIs → add both the localhost and live YouTube URLs from the table above → Create.
5. Copy the **Client ID** and **Client secret** into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
6. Restart `npm run dev`, sign in as a creator → **Social accounts → Connect YouTube**.

Before launch: while the Google app is in **Testing**, only the test users you added can connect, and Google
expires their access after 7 days (they'd need to reconnect). To open it to everyone, click **Publish app** on the
Audience page. `youtube.readonly` is a sensitive scope, so Google will ask you to complete **app verification**
(privacy policy link, a short demo video of the connect flow, domain verification). That review usually takes a few
days to a few weeks.

---

## Step 2 — Instagram (Meta for Developers)

Only **Instagram Professional accounts** (Business or Creator) can connect — this is Meta's rule. Creators can switch
for free in Instagram → Settings → Account type and tools. No Facebook Page is needed.

1. Go to **https://developers.facebook.com** → **My Apps → Create app**. Choose the **Business** app type (or the use
   case for managing Instagram messaging and content), name it `TalentLoom`.
2. In the app, add the **Instagram** product → **API setup with Instagram business login**.
3. Under **Set up Instagram business login → Business login settings**, add the Instagram redirect URL from the table
   above and save.
4. On the same page, copy the **Instagram app ID** and **Instagram app secret** (these are different from the Meta
   app ID at the top of the dashboard):
   ```
   INSTAGRAM_APP_ID=...
   INSTAGRAM_APP_SECRET=...
   ```
5. While the app is in development mode, only Instagram accounts added as testers can connect: **App roles → Roles →
   Add people → Instagram Tester**, then accept the invite in that Instagram account (Settings → Website permissions /
   Apps and websites → Tester invites).
6. Add the variables in Vercel, redeploy, and test **Connect Instagram** on your live site.

Before launch: to let any creator connect, request **Advanced Access** for `instagram_business_basic` through
**App Review**, and complete **Business Verification**. Meta needs your privacy policy URL, a screencast of the connect
flow, and an explanation of how the data is used.

---

## Step 3 — TikTok (TikTok for Developers)

1. Go to **https://developers.tiktok.com** → log in → **Manage apps → Connect an app**, name it `TalentLoom`.
2. Fill in the app details (icon, category, description, Terms and Privacy Policy URLs — use
   `https://YOUR-DOMAIN/legal/terms` and `https://YOUR-DOMAIN/legal/privacy`) and select the **Web** platform with your
   site URL.
3. **Add products → Login Kit**. Add the TikTok redirect URL from the table above.
4. **Scopes**: make sure `user.info.basic`, `user.info.profile`, `user.info.stats` and `video.list` are added.
5. Copy the **Client key** and **Client secret**:
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   ```
6. To test before review, switch to **Sandbox**, create a sandbox and add your TikTok account under **Target users**.

Before launch: **Submit for review** with a demo video of the connect flow. TikTok reviews each scope; until
`video.list` is approved, TikTok connections still work but show followers only (no averages).

---

## Step 4 — Vercel

1. **Vercel → Project → Settings → Environment Variables**: add `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET` and each
   platform's keys (Production and Preview).
2. Redeploy. The daily refresh is set in `vercel.json` (09:17 UTC). Vercel sends `CRON_SECRET` automatically, and the
   job refuses requests without it.
3. Check **Vercel → Project → Settings → Cron Jobs** shows `/api/cron/sync-social`.

## Troubleshooting

| What you see | Fix |
|---|---|
| No "Connect" buttons | Keys or `TOKEN_ENCRYPTION_KEY` missing in `.env.local`/Vercel, or the dev server wasn't restarted. |
| Google "redirect_uri_mismatch" | The redirect URL in Google doesn't exactly match the table (check http vs https, port 3002, no trailing slash). |
| "The sign-in took too long…" | The connect was started on a different site address (e.g. localhost vs vercel.app). Use one address throughout. |
| Instagram "couldn't connect" | The Instagram account is Personal, or isn't added as a tester while the app is in development. |
| "Reconnect needed" | The creator revoked access in the platform, or (Google Testing mode) 7 days passed. Click Reconnect. |
