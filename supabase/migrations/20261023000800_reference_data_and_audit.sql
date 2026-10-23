-- =====================================================================
-- TalentLoom · 0800 · Reference data (plans, permissions, taxonomy,
-- settings, legal templates) + audit trigger wiring + lead intake.
-- Every value here is editable later from the admin dashboard.
-- =====================================================================

-- ---------- Permissions & system roles --------------------------------
insert into public.permissions (key, description) values
  ('company.edit',    'Edit the company profile and submit applications'),
  ('team.manage',     'Invite, remove and change roles of team members'),
  ('talent.search',   'Search and view creator profiles'),
  ('talent.manage',   'Create talent lists and save creators'),
  ('pipeline.edit',   'Move creators through pipelines and assign owners'),
  ('pipeline.manage', 'Create pipelines and custom stages'),
  ('notes.write',     'Write internal notes'),
  ('inquiries.view',  'View representation inquiries'),
  ('inquiries.send',  'Send representation inquiries'),
  ('messages.view',   'Read conversations with creators'),
  ('messages.send',   'Send messages to creators'),
  ('roster.manage',   'Manage the signed-talent roster'),
  ('export.csv',      'Export authorized data to CSV'),
  ('billing.view',    'View plan, usage and invoices'),
  ('analytics.view',  'View company analytics');

insert into public.company_roles (company_id, key, name, is_system) values
  (null, 'owner', 'Owner', true),
  (null, 'admin', 'Admin', true),
  (null, 'recruiter', 'Recruiter', true),
  (null, 'viewer', 'Viewer', true);

insert into public.company_role_permissions (role_id, permission_key)
select r.id, p.key
from public.company_roles r
cross join public.permissions p
where r.company_id is null and (
     r.key in ('owner', 'admin')
  or (r.key = 'recruiter' and p.key in ('talent.search', 'talent.manage', 'pipeline.edit', 'notes.write',
                                        'inquiries.view', 'inquiries.send', 'messages.view', 'messages.send'))
  or (r.key = 'viewer' and p.key in ('talent.search', 'inquiries.view', 'messages.view'))
);

-- ---------- Features ---------------------------------------------------
insert into public.features (key, kind, label, audience, sort) values
  -- creator
  ('social_accounts.max',     'limit',   'Social accounts',                      'creator', 10),
  ('portfolio_items.max',     'limit',   'Portfolio items',                      'creator', 20),
  ('advanced_analytics',      'boolean', 'Advanced profile analytics',           'creator', 30),
  ('view_insights',           'boolean', 'See which companies viewed or saved you', 'creator', 40),
  ('featured_search',         'boolean', 'Featured-search eligibility',          'creator', 50),
  ('custom_media_kit',        'boolean', 'Custom media-kit page',                'creator', 60),
  ('affiliate_vault',         'boolean', 'Affiliate Code Vault',                 'creator', 70),
  ('brand_deal_tracker',      'boolean', 'Brand-Deal Tracker',                   'creator', 80),
  ('monthly_insights',        'boolean', 'Monthly profile insights',             'creator', 90),
  ('priority_verification',   'boolean', 'Priority verification',                'creator', 100),
  -- company
  ('seats.max',               'limit',   'User seats',                           'company', 10),
  ('saved_creators.max',      'limit',   'Saved creators',                       'company', 20),
  ('contacts.monthly',        'limit',   'New creators contacted per month',     'company', 30),
  ('pipelines.max',           'limit',   'Recruiting pipelines',                 'company', 40),
  ('advanced_filters',        'boolean', 'Advanced creator filters',             'company', 50),
  ('permissioned_analytics',  'boolean', 'Permissioned creator analytics',       'company', 60),
  ('shared_notes',            'boolean', 'Shared team notes',                    'company', 70),
  ('team_assignments',        'boolean', 'Team assignments',                     'company', 80),
  ('creator_comparison',      'boolean', 'Creator comparison',                   'company', 90),
  ('roster',                  'boolean', 'Signed-talent roster',                 'company', 100),
  ('csv_export',              'boolean', 'CSV export',                           'company', 110),
  ('company_analytics',       'boolean', 'Company analytics',                    'company', 120),
  ('verified_badge',          'boolean', 'Verification badge after approval',    'company', 130),
  ('custom_stages',           'boolean', 'Custom pipeline stages',               'company', 140),
  ('custom_roles',            'boolean', 'Custom team permissions',              'company', 150),
  ('private_lists',           'boolean', 'Private talent lists',                 'company', 160),
  ('bulk_review',             'boolean', 'Bulk profile review',                  'company', 170),
  ('multiple_offices',        'boolean', 'Multiple offices or divisions',        'company', 180),
  ('branded_application_page','boolean', 'Agency-branded creator application page', 'company', 190),
  ('priority_support',        'boolean', 'Priority support',                     'company', 200),
  ('api_access',              'boolean', 'API access (readiness)',               'company', 210),
  ('sso',                     'boolean', 'Single sign-on (readiness)',           'company', 220);

-- ---------- Plans & prices (USD) ----------------------------------------
insert into public.plans (key, audience, name, description, is_public, sales_led, trial_days, sort) values
  ('creator_free',          'creator', 'Creator Free',          'Everything you need to get discovered.', true,  false, 0,  10),
  ('creator_pro',           'creator', 'Creator Pro',           'Grow faster with insights, featured eligibility and business tools.', true, false, 0, 20),
  ('company_pending',       'company', 'No plan yet',           'Internal default for companies without an assigned plan.', false, true, 0, 0),
  ('management_scout',      'company', 'Management Scout',      'For solo managers starting to scout talent.', true, true, 14, 30),
  ('management_agency',     'company', 'Management Agency',     'For growing teams recruiting and managing a roster.', true, true, 14, 40),
  ('management_agency_pro', 'company', 'Management Agency Pro', 'For established agencies with multiple teams.', true, true, 14, 50),
  ('enterprise',            'company', 'Enterprise',            'Custom seats, limits, security and integrations.', true, true, 0, 60);

insert into public.plan_prices (plan_id, billing_interval, amount_cents)
select p.id, v.billing_interval, v.amount_cents
from (values
  ('creator_pro', 'month', 999),            ('creator_pro', 'year', 9900),
  ('management_scout', 'month', 4900),      ('management_scout', 'year', 49000),
  ('management_agency', 'month', 14900),    ('management_agency', 'year', 149000),
  ('management_agency_pro', 'month', 29900),('management_agency_pro', 'year', 299000)
) v(plan_key, billing_interval, amount_cents)
join public.plans p on p.key = v.plan_key;

-- Helper for readable feature matrices: (plan, feature, enabled, limit)
insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, v.feature_key, v.enabled, v.limit_value
from (values
  -- Creator Free
  ('creator_free', 'social_accounts.max', true, 3),
  ('creator_free', 'portfolio_items.max', true, 12),
  ('creator_free', 'advanced_analytics', false, null),
  ('creator_free', 'view_insights', false, null),
  ('creator_free', 'featured_search', false, null),
  ('creator_free', 'custom_media_kit', false, null),
  ('creator_free', 'affiliate_vault', false, null),
  ('creator_free', 'brand_deal_tracker', false, null),
  ('creator_free', 'monthly_insights', false, null),
  ('creator_free', 'priority_verification', false, null),
  -- Creator Pro
  ('creator_pro', 'social_accounts.max', true, null),
  ('creator_pro', 'portfolio_items.max', true, null),
  ('creator_pro', 'advanced_analytics', true, null),
  ('creator_pro', 'view_insights', true, null),
  ('creator_pro', 'featured_search', true, null),
  ('creator_pro', 'custom_media_kit', true, null),
  ('creator_pro', 'affiliate_vault', true, null),
  ('creator_pro', 'brand_deal_tracker', true, null),
  ('creator_pro', 'monthly_insights', true, null),
  ('creator_pro', 'priority_verification', true, null),
  -- Company without an assigned plan (admin creates the company, then assigns a plan)
  ('company_pending', 'seats.max', true, 1),
  ('company_pending', 'saved_creators.max', true, 0),
  ('company_pending', 'contacts.monthly', true, 0),
  ('company_pending', 'pipelines.max', true, 1),
  -- Management Scout
  ('management_scout', 'seats.max', true, 1),
  ('management_scout', 'saved_creators.max', true, 50),
  ('management_scout', 'contacts.monthly', true, 10),
  ('management_scout', 'pipelines.max', true, 1),
  -- Management Agency
  ('management_agency', 'seats.max', true, 5),
  ('management_agency', 'saved_creators.max', true, null),
  ('management_agency', 'contacts.monthly', true, 50),
  ('management_agency', 'pipelines.max', true, 5),
  ('management_agency', 'advanced_filters', true, null),
  ('management_agency', 'permissioned_analytics', true, null),
  ('management_agency', 'shared_notes', true, null),
  ('management_agency', 'team_assignments', true, null),
  ('management_agency', 'creator_comparison', true, null),
  ('management_agency', 'roster', true, null),
  ('management_agency', 'csv_export', true, null),
  ('management_agency', 'company_analytics', true, null),
  ('management_agency', 'verified_badge', true, null),
  -- Management Agency Pro
  ('management_agency_pro', 'seats.max', true, 15),
  ('management_agency_pro', 'saved_creators.max', true, null),
  ('management_agency_pro', 'contacts.monthly', true, 150),
  ('management_agency_pro', 'pipelines.max', true, null),
  ('management_agency_pro', 'advanced_filters', true, null),
  ('management_agency_pro', 'permissioned_analytics', true, null),
  ('management_agency_pro', 'shared_notes', true, null),
  ('management_agency_pro', 'team_assignments', true, null),
  ('management_agency_pro', 'creator_comparison', true, null),
  ('management_agency_pro', 'roster', true, null),
  ('management_agency_pro', 'csv_export', true, null),
  ('management_agency_pro', 'company_analytics', true, null),
  ('management_agency_pro', 'verified_badge', true, null),
  ('management_agency_pro', 'custom_stages', true, null),
  ('management_agency_pro', 'custom_roles', true, null),
  ('management_agency_pro', 'private_lists', true, null),
  ('management_agency_pro', 'bulk_review', true, null),
  ('management_agency_pro', 'multiple_offices', true, null),
  ('management_agency_pro', 'branded_application_page', true, null),
  ('management_agency_pro', 'priority_support', true, null),
  -- Enterprise (custom; adjust per customer with entitlement overrides)
  ('enterprise', 'seats.max', true, null),
  ('enterprise', 'saved_creators.max', true, null),
  ('enterprise', 'contacts.monthly', true, null),
  ('enterprise', 'pipelines.max', true, null),
  ('enterprise', 'advanced_filters', true, null),
  ('enterprise', 'permissioned_analytics', true, null),
  ('enterprise', 'shared_notes', true, null),
  ('enterprise', 'team_assignments', true, null),
  ('enterprise', 'creator_comparison', true, null),
  ('enterprise', 'roster', true, null),
  ('enterprise', 'csv_export', true, null),
  ('enterprise', 'company_analytics', true, null),
  ('enterprise', 'verified_badge', true, null),
  ('enterprise', 'custom_stages', true, null),
  ('enterprise', 'custom_roles', true, null),
  ('enterprise', 'private_lists', true, null),
  ('enterprise', 'bulk_review', true, null),
  ('enterprise', 'multiple_offices', true, null),
  ('enterprise', 'branded_application_page', true, null),
  ('enterprise', 'priority_support', true, null),
  ('enterprise', 'api_access', true, null),
  ('enterprise', 'sso', true, null)
) v(plan_key, feature_key, enabled, limit_value)
join public.plans p on p.key = v.plan_key;

-- ---------- Optional paid add-ons (all OFF until you enable them) -------
insert into public.addon_products (key, name, audience, amount_cents, billing, config) values
  ('boost_7_day',         'Seven-day profile boost',     'creator', 900,   'one_time', '{"days": 7}'),
  ('boost_30_day',        'Thirty-day profile boost',    'creator', 1900,  'one_time', '{"days": 30}'),
  ('homepage_spotlight',  'Homepage creator spotlight',  'creator', 3900,  'one_time', '{"days": 7}'),
  ('contacts_25',         '25 additional creator contacts',  'company', 2500, 'one_time', '{"credits": 25}'),
  ('contacts_100',        '100 additional creator contacts', 'company', 7500, 'one_time', '{"credits": 100}'),
  ('expedited_review',    'Expedited company review',    'company', 4900,  'one_time', '{}'),
  ('enhanced_review',     'Enhanced company review',     'company', 9900,  'one_time', '{}'),
  ('featured_company',    'Featured company profile',    'company', 2900,  'monthly',  '{}'),
  ('success_fee',         'Successful-representation fee', 'company', 14900, 'one_time',
     '{"min_cents": 9900, "max_cents": 24900, "waived_for_plans": []}');

-- ---------- Taxonomy -------------------------------------------------
insert into public.niches (key, label, sort)
select k, l, row_number() over () * 10 from (values
  ('beauty', 'Beauty'), ('fashion', 'Fashion'), ('fitness', 'Fitness'), ('wellness', 'Health & wellness'),
  ('food', 'Food & cooking'), ('travel', 'Travel'), ('parenting', 'Parenting & family'), ('lifestyle', 'Lifestyle'),
  ('gaming', 'Gaming'), ('tech', 'Tech'), ('finance', 'Personal finance'), ('education', 'Education'),
  ('comedy', 'Comedy'), ('music', 'Music'), ('dance', 'Dance'), ('art_design', 'Art & design'),
  ('home_diy', 'Home & DIY'), ('pets', 'Pets & animals'), ('sports', 'Sports'), ('outdoors', 'Outdoors & adventure'),
  ('automotive', 'Automotive'), ('books', 'Books'), ('business', 'Business & entrepreneurship'), ('sustainability', 'Sustainability')
) v(k, l);

insert into public.content_categories (key, label, sort)
select k, l, row_number() over () * 10 from (values
  ('short_form_video', 'Short-form video'), ('long_form_video', 'Long-form video'), ('photography', 'Photography'),
  ('livestreaming', 'Livestreaming'), ('podcasting', 'Podcasting'), ('blogging', 'Blogging & newsletters'),
  ('ugc', 'UGC'), ('tutorials', 'Tutorials & how-tos'), ('reviews', 'Reviews'), ('vlogs', 'Vlogs')
) v(k, l);

insert into public.support_types (key, label, sort)
select k, l, row_number() over () * 10 from (values
  ('full_management', 'Full talent management'), ('brand_deals', 'Brand-deal sourcing and negotiation'),
  ('content_strategy', 'Content strategy'), ('legal_contracts', 'Contracts and legal review'),
  ('pr_media', 'PR and media'), ('business_development', 'Business development'),
  ('financial_planning', 'Financial planning'), ('audience_growth', 'Audience growth')
) v(k, l);

insert into public.industries (key, label, sort)
select k, l, row_number() over () * 10 from (values
  ('beauty_personal_care', 'Beauty & personal care'), ('fashion_apparel', 'Fashion & apparel'),
  ('health_fitness', 'Health & fitness'), ('food_beverage', 'Food & beverage'), ('travel_hospitality', 'Travel & hospitality'),
  ('technology', 'Technology'), ('gaming', 'Gaming'), ('finance', 'Finance'), ('home_living', 'Home & living'),
  ('parenting_baby', 'Parenting & baby'), ('automotive', 'Automotive'), ('entertainment', 'Entertainment'),
  ('education', 'Education'), ('pets', 'Pets')
) v(k, l);

insert into public.platforms (key, label, icon, profile_url_template, api_supported, sort) values
  ('instagram', 'Instagram', 'instagram', 'https://www.instagram.com/{handle}', false, 10),
  ('tiktok',    'TikTok',    'tiktok',    'https://www.tiktok.com/@{handle}',   false, 20),
  ('youtube',   'YouTube',   'youtube',   'https://www.youtube.com/@{handle}',  false, 30),
  ('pinterest', 'Pinterest', 'pinterest', 'https://www.pinterest.com/{handle}', false, 40),
  ('facebook',  'Facebook',  'facebook',  'https://www.facebook.com/{handle}',  false, 50),
  ('x',         'X',         'x',         'https://x.com/{handle}',             false, 60),
  ('twitch',    'Twitch',    'twitch',    'https://www.twitch.tv/{handle}',     false, 70),
  ('snapchat',  'Snapchat',  'snapchat',  'https://www.snapchat.com/add/{handle}', false, 80),
  ('linkedin',  'LinkedIn',  'linkedin',  'https://www.linkedin.com/in/{handle}', false, 90),
  ('threads',   'Threads',   'threads',   'https://www.threads.net/@{handle}',  false, 100),
  ('other',     'Other',     'link',      null,                                  false, 999);

-- ---------- Platform settings --------------------------------------------
insert into public.platform_settings (key, value, description, is_public) values
  ('legal.terms_version',             '"2026-10-draft"', 'Version stamped on consents at sign-up', true),
  ('features.company_directory',      'false', 'Show the public company directory', true),
  ('features.addons',                 'false', 'Enable optional paid add-ons (boosts, credit packs, reviews)', true),
  ('features.success_fee',            'false', 'Enable the successful-representation fee (keep OFF for MVP)', false),
  ('billing.past_due_grace_days',     '7',     'Days a past-due subscription keeps access', false),
  ('outreach.max_inquiries_per_hour', '10',    'Per-company anti-spam cap, on top of plan limits', false),
  ('outreach.max_inquiries_per_day',  '40',    'Per-company anti-spam cap, on top of plan limits', false),
  ('messages.max_per_minute',         '20',    'Per-user message rate limit', false),
  ('leads.max_per_hour',              '30',    'Global cap on public contact-sales submissions', false),
  ('verification.sla_days',           '5',     'Target days to review a verification request', true);

-- ---------- Notification templates --------------------------------------
insert into public.notification_templates (key, channel, subject, body) values
  ('inquiry.new',            'in_app', null, '{{company}} sent you a representation inquiry.'),
  ('inquiry.accepted',       'in_app', null, '{{creator}} accepted your inquiry. You can now message them.'),
  ('inquiry.declined',       'in_app', null, '{{creator}} declined your inquiry.'),
  ('message.new',            'in_app', null, 'New message from {{sender}}.'),
  ('company.approved',       'in_app', null, 'Your company has been approved. You can now contact creators.'),
  ('company.rejected',       'in_app', null, 'Your company application was not approved. See details in your dashboard.'),
  ('company.info_requested', 'in_app', null, 'TalentLoom needs more information to review your company.'),
  ('verification.approved',  'in_app', null, 'Your analytics for {{platform}} are now admin-verified.'),
  ('verification.rejected',  'in_app', null, 'Your verification request for {{platform}} was not approved.'),
  ('creator.saved',          'in_app', null, 'A management company saved your profile.'),
  ('subscription.updated',   'in_app', null, 'Your plan is now {{plan}}.'),
  ('payment.failed',         'in_app', null, 'Your latest payment failed. Update your card to keep your plan.'),
  ('trial.ending',           'in_app', null, 'Your trial ends on {{date}}.'),
  ('account.suspended',      'in_app', null, 'Your account has been suspended. Contact support for details.'),
  ('report.reviewed',        'in_app', null, 'We reviewed your report. Thank you for helping keep TalentLoom safe.');

-- ---------- Legal templates (MUST be reviewed by a lawyer) -------------
insert into public.legal_pages (slug, title, version, published_at, body_md)
select v.slug, v.title, '2026-10-draft', now(),
  '> **TEMPLATE — requires review by a qualified attorney before production use.** Replace every [bracketed] item.' || E'\n\n' || v.body
from (values
  ('terms', 'Terms of Service', $md$
## 1. Who we are
TalentLoom ("TalentLoom", "we") operates a creator management network connecting social media creators with management companies and talent agencies. [Legal entity name, state of formation, address.]

## 2. Eligibility
You must be **18 years of age or older** to create an account. By registering you confirm that you are at least 18. We may close accounts that do not meet this requirement.

## 3. Accounts
Creators may register directly. Management companies are onboarded by TalentLoom after review. You are responsible for your credentials and for activity on your account.

## 4. Creator content and analytics
You keep ownership of everything you upload. You grant TalentLoom a limited license to host and display it according to your privacy settings. Analytics you enter are labelled **self-reported** unless TalentLoom staff or an official platform connection verifies them. You must not submit false or misleading information.

## 5. Management companies
Companies must follow the Management Company Standards, respect outreach limits, and only use creator data for evaluating representation. TalentLoom does not guarantee any representation outcome.

## 6. Fees
Creators are never required to pay to receive or respond to a legitimate representation inquiry. Paid plans renew automatically until cancelled. [Refund policy.]

## 7. Prohibited conduct
See the Acceptable Use Policy and Community Guidelines.

## 8. Termination
We may suspend or terminate accounts that violate these terms. You may delete your account at any time from Account Settings.

## 9. Disclaimers and limitation of liability
[To be drafted by counsel.]

## 10. Governing law
[State], United States.

## 11. Contact
[support email / mailing address]
$md$),
  ('privacy', 'Privacy Policy', $md$
## What we collect
Account details (email, display name), profile information you choose to add, social account handles and analytics you enter, files you upload, messages you send, and basic usage data needed to run the service. We do **not** store your date of birth — only your confirmation that you are 18 or older.

## How visibility works
You choose, field by field, whether information is public, visible only to approved management companies, or private. Approved companies see only what your settings allow.

## How we use data
To operate the network, prevent abuse, process payments (through Stripe; we never see full card numbers), and improve the product.

## Sharing
We do not sell personal information. We share data with service providers (hosting: Supabase; payments: Stripe; hosting: Vercel) under contract, and with companies only as your settings allow.

## Your rights
Access, export, correction and deletion are available from Account Settings or by contacting [email]. [Add CCPA/CPRA and other state-specific disclosures as applicable.]

## Retention
[Retention periods.]

## Contact
[privacy contact]
$md$),
  ('community-guidelines', 'Community Guidelines', $md$
- Be honest about who you are and about your numbers.
- Be respectful. No harassment, hate, threats, or sexual content.
- Companies: personalize outreach, take "no" for an answer, and never ask creators for upfront fees to be represented.
- No scams, fake agencies, or impersonation.
- Report anything that feels wrong. We review every report.
$md$),
  ('creator-data-consent', 'Creator Data Consent', $md$
Before your profile becomes discoverable, or before you share analytics with companies, we ask for your explicit consent.

- **Discoverability:** approved management companies can find your profile in search.
- **Analytics sharing:** the analytics you mark as visible to approved companies can be viewed by them.
- You can withdraw consent at any time from **Privacy & discoverability**. Withdrawing hides your profile from search going forward.
- Future social-platform connections will request separate, platform-specific consent and can be revoked at any time.
$md$),
  ('company-standards', 'Management Company Standards', $md$
Companies on TalentLoom agree to:

1. Represent their business truthfully and keep their profile accurate.
2. Use creator information only to evaluate potential representation.
3. Never charge creators upfront fees for representation.
4. Respect outreach limits and creators' decisions.
5. Protect creator data and never export it except as permitted.
6. Respond to TalentLoom review and information requests.

Violations may result in suspension or removal.
$md$),
  ('acceptable-use', 'Acceptable Use Policy', $md$
You may not: scrape or bulk-download data; circumvent limits or security; upload malware; impersonate others; send spam; misrepresent analytics; or use TalentLoom for unlawful purposes. [Expand with counsel.]
$md$),
  ('data-deletion', 'Data Deletion Requests', $md$
You can delete your account from **Account Settings → Delete account**, or request deletion or a copy of your data from **Support**. We confirm requests within [X] days and complete them within [Y] days, except for records we must keep by law (for example, billing records).
$md$),
  ('reporting-appeals', 'Reporting and Appeals', $md$
Use **Report** on any profile or message, or visit the Report a User page. Our team reviews every report. If action is taken on your account and you believe it was a mistake, contact [appeals email] within 30 days and a different reviewer will look at your appeal.
$md$)
) v(slug, title, body);

-- ---------- Wire up audit triggers on sensitive tables ------------------
create trigger audit_profiles after update of account_type, status, deleted_at, suspended_reason or delete
  on public.profiles for each row execute function private.audit_row_change();
create trigger audit_companies after insert or update or delete
  on public.companies for each row execute function private.audit_row_change();
create trigger audit_company_members after insert or update or delete
  on public.company_members for each row execute function private.audit_row_change();
create trigger audit_snapshot_verification after update of source, verification_status, verified_by
  on public.analytics_snapshots for each row execute function private.audit_row_change();
create trigger audit_verification_requests after update
  on public.verification_requests for each row execute function private.audit_row_change();
create trigger audit_subscriptions after insert or update or delete
  on public.subscriptions for each row execute function private.audit_row_change();
create trigger audit_plans after insert or update or delete
  on public.plans for each row execute function private.audit_row_change();
create trigger audit_plan_prices after insert or update or delete
  on public.plan_prices for each row execute function private.audit_row_change();
create trigger audit_plan_features after insert or update or delete
  on public.plan_features for each row execute function private.audit_row_change();
create trigger audit_entitlement_overrides after insert or update or delete
  on public.entitlement_overrides for each row execute function private.audit_row_change();
create trigger audit_platform_settings after insert or update or delete
  on public.platform_settings for each row execute function private.audit_row_change();
create trigger audit_legal_pages after update
  on public.legal_pages for each row execute function private.audit_row_change();
create trigger audit_user_reports after update
  on public.user_reports for each row execute function private.audit_row_change();
create trigger audit_promo_codes after insert or update or delete
  on public.promo_codes for each row execute function private.audit_row_change();
create trigger audit_addon_products after update
  on public.addon_products for each row execute function private.audit_row_change();
create trigger audit_featured_placements after insert or update or delete
  on public.featured_placements for each row execute function private.audit_row_change();
create trigger audit_contact_credits after insert
  on public.contact_credit_ledger for each row execute function private.audit_row_change();
create trigger audit_company_leads after update
  on public.company_leads for each row execute function private.audit_row_change();

-- ---------- Rate limiting + public lead intake ----------------------------
create or replace function private.check_rate_limit(p_key text, p_window interval, p_max integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01');
  v_count integer;
begin
  insert into public.rate_limit_buckets (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = public.rate_limit_buckets.count + 1
  returning count into v_count;
  return v_count <= p_max;
end;
$$;
revoke execute on function private.check_rate_limit(text, interval, integer) from public, anon, authenticated;
grant execute on function private.check_rate_limit(text, interval, integer) to service_role;

-- Called by the "Contact sales" form. Validates, rate-limits, stores the lead.
create or replace function public.submit_company_lead(
  p_company_name text, p_contact_name text, p_contact_email text,
  p_website text default null, p_phone text default null, p_team_size text default null,
  p_categories text[] default '{}', p_message text default null, p_interested_plan text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_contact_email));
  v_global_max integer := coalesce(
    (select (value #>> '{}')::int from public.platform_settings where key = 'leads.max_per_hour'), 30);
begin
  if not private.check_rate_limit('lead:email:' || v_email, interval '1 day', 3) then
    raise exception 'We already have your request. Our team will be in touch soon.' using errcode = 'P0001';
  end if;
  if not private.check_rate_limit('lead:global', interval '1 hour', v_global_max) then
    raise exception 'We are receiving a lot of requests. Please try again shortly.' using errcode = 'P0001';
  end if;

  insert into public.company_leads (company_name, website, contact_name, contact_email, phone, team_size,
                                    categories, message, interested_plan)
  values (trim(p_company_name), nullif(trim(p_website), ''), trim(p_contact_name), v_email,
          nullif(trim(p_phone), ''), p_team_size, coalesce(p_categories, '{}'),
          nullif(trim(p_message), ''), p_interested_plan)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_company_lead(text, text, text, text, text, text, text[], text, text) from public;
grant execute on function public.submit_company_lead(text, text, text, text, text, text, text[], text, text) to anon, authenticated;
