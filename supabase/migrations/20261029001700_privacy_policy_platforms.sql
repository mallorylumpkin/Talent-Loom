-- Privacy Policy + Data Deletion pages: add what Meta, TikTok and Google (YouTube) reviewers look for.
-- Only replaces pages that still contain the original placeholders, so edits made in Admin → Legal pages are kept.

update public.legal_pages set
  body_md = $md$
_Last updated: October 29, 2026_

TalentLoom ("we", "us") runs talentloom.live, a network where creators aged 18+ build a professional profile and talent management companies find creators to represent. This policy explains what we collect, how we use it, who we share it with, and how you can delete it.

## What we collect
- **Account details:** email address, display name, and your confirmation that you are 18 or older. We do **not** store your date of birth.
- **Profile information you add:** bio, location, niches, photos, portfolio files, media kit, rates and similar details.
- **Numbers you enter yourself:** follower counts and other stats you type in or upload as screenshots. These are labeled **Self-reported** unless our team verifies them.
- **Messages and inquiries** you send or receive on TalentLoom, and support requests.
- **Billing details:** your plan and payment history. Card details are handled by Stripe; we never see or store full card numbers.
- **Basic technical data:** sign-in cookies needed to keep you logged in, and server logs used for security and troubleshooting. We do not use advertising or tracking cookies.

## Data from connected social accounts
Connecting a social account is optional. When you choose to connect one, you sign in on that platform's own page and approve access there. We never see your password for that platform. We only **read** data; we never post, comment, message or change anything on your social accounts.

- **Instagram** (permission `instagram_business_basic`): your account ID, username, follower count, number of posts, and like and comment counts on your recent posts.
- **Facebook Pages** (permissions `pages_show_list`, `pages_read_engagement`): the list of Pages you choose to share, and for each selected Page its ID, name, username, link, follower and like counts, and reaction and comment counts on recent posts. Personal profile data is not requested.
- **TikTok** (scopes `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`): your account ID, display name, username, follower, likes and video counts, and view, like and comment counts on recent videos. We do not download or store your videos.
- **YouTube** (scope `youtube.readonly`): your channel ID, name, subscriber, view and video counts, and view, like and comment counts on recent videos.

**How we use it:** only to show accurate audience statistics (followers, average views, engagement rate) on your TalentLoom profile and in your own insights. Stats from a connected account are labeled as coming from that platform. We do not use this data for advertising, do not sell it, and do not use it for any purpose other than the one described here.

**Storage and refresh:** access tokens are encrypted (AES-256-GCM) and stored on our servers. While an account stays connected, we refresh its stats about once a day.

**Disconnecting:** you can disconnect any account at any time from **Social accounts**. We then revoke access with the platform where it allows it and delete the stored access tokens immediately, so no further data is collected. You can also remove TalentLoom's access from the platform itself:
- Instagram: Settings → Apps and websites
- Facebook: Settings & privacy → Settings → Business integrations
- TikTok: Settings and privacy → Security → Manage app permissions
- Google / YouTube: https://myaccount.google.com/permissions

Stats that were already saved stay on your profile as past snapshots until you delete them, ask us to remove them, or delete your account (see "Deleting your data" below).

**YouTube:** TalentLoom uses YouTube API Services. By connecting YouTube you agree to the YouTube Terms of Service (https://www.youtube.com/t/terms), and Google's Privacy Policy (https://policies.google.com/privacy) applies to Google's handling of your data.

## How visibility works
You choose, field by field, whether information is public, visible only to approved management companies, or private. Your profile only appears in company search after you give consent, and you can withdraw that consent at any time from **Privacy & discoverability**.

## How we use data
To run the network (profiles, search, messaging, inquiries), to show your stats, to process payments, to send service emails (such as notifications and password resets), to keep the platform safe and prevent abuse, and to provide support.

## Sharing
We do **not** sell or rent personal information. We share data only:
- **With management companies,** and only what your visibility settings allow.
- **With service providers** that run TalentLoom for us under contract: Supabase (database, sign-in and file storage), Vercel (website hosting), Stripe (payments) and Resend (email delivery).
- **When required by law** or to protect the safety of our users.

## Deleting your data
- **Creators:** go to **Settings → Delete account** and type DELETE to confirm. Your profile, connected accounts and stored tokens, saved stats and files are deleted right away. Messages you already sent stay in the other person's inbox but are no longer linked to your account.
- **Company users,** or anyone who prefers not to use the button: send a request from **Support** in your account, or email us at the address below. Include the email address on your account.
- **Removing only saved social stats:** contact Support and tell us which account.

We keep a minimal record that an account existed and was deleted (for security and audit purposes), and billing records that the law requires us to keep. Full instructions are on our Data Deletion page: https://talentloom.live/legal/data-deletion

## Your rights
You can access, correct, export or delete your information. Most of it can be changed directly in your account; for anything else, contact us. Depending on where you live (for example California or the EU/UK) you may have additional rights, and you will not be treated differently for using them.

## Retention
We keep your information while your account is open. When you delete your account, your data is removed as described above. Server logs are kept only for a short period for security and troubleshooting.

## Security
Data is encrypted in transit (HTTPS). Social access tokens are encrypted at rest. Access to data is restricted by database security rules so each person can only see what they are allowed to.

## Children
TalentLoom is only for people aged 18 and older. We do not knowingly collect information from anyone under 18; if we learn we have, we delete it.

## Changes
If we make material changes, we will update the date at the top and notify you in the app or by email.

## Contact
Email **support@talentloom.live**, or use **Support** in your account.
$md$,
  version = '2026-10-29',
  published_at = now(),
  updated_at = now()
where slug = 'privacy' and body_md like '%[privacy contact]%';

update public.legal_pages set
  body_md = $md$
_Last updated: October 29, 2026_

You can delete your TalentLoom account and data at any time.

## Delete your account yourself (creators)
1. Sign in at https://talentloom.live
2. Go to **Settings → Delete account**.
3. Type **DELETE** and confirm.

Your profile, connected social accounts and their stored access tokens, saved stats and uploaded files are deleted immediately. Messages you already sent stay in the other person's inbox but are no longer linked to your account.

## Ask us to delete it (companies, or anyone)
Send a request from **Support** in your account, or email **support@talentloom.live** from the email address on your account. We reply within 7 days and complete deletion within 30 days.

## Remove only data from a social account
- **Stop future collection:** go to **Social accounts** and click **Disconnect**. We revoke access and delete the stored access tokens immediately.
- **Remove stats already saved:** contact Support and tell us which account.
- You can also remove TalentLoom's access on the platform itself: Instagram (Settings → Apps and websites), Facebook (Settings & privacy → Settings → Business integrations), TikTok (Settings and privacy → Security → Manage app permissions), Google/YouTube (https://myaccount.google.com/permissions). Then contact us if you want the saved stats deleted too.

## What we keep
A minimal record that an account existed and was deleted (for security and audit purposes), and billing records that the law requires us to keep.
$md$,
  version = '2026-10-29',
  published_at = now(),
  updated_at = now()
where slug = 'data-deletion' and body_md like '%[X]%';
