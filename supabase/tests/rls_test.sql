-- =====================================================================
-- TalentLoom security test suite
-- Runs against a database with all migrations applied. Every check raises
-- on failure; a clean run ends with "ALL SECURITY TESTS PASSED".
--
-- Run locally (Supabase CLI):  supabase db reset && psql "$DB_URL" -f supabase/tests/rls_test.sql
-- =====================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Act as a signed-in user (aal = 'aal1' or 'aal2'), or as anon.
create or replace function pg_temp.login(p_uid uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

-- Expect a statement to raise.
create or replace function pg_temp.fails(p_sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % (blocked: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % — statement was allowed: %', msg, p_sql;
end $$;

-- Rows affected by a statement (RLS silently filters updates/deletes).
create or replace function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

set client_min_messages = notice;

-- ---------------------------------------------------------------------
-- Fixtures (fixed ids so tests are readable)
--  A, B = creators · C = company owner · D = recruiter · E = other company owner · Z = future admin
-- ---------------------------------------------------------------------
select pg_temp.as_postgres();

select pg_temp.fails($$insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-0000000000ff', 'kid@example.com', '{}')$$,
  '1. sign-up without 18+ confirmation is rejected');

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'Ava@Example.com', '{"age_18_plus":"true","display_name":"Ava (fictional)","terms_version":"t1"}', '{}'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', '{"age_18_plus":"true","account_type":"super_admin"}', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'cora@agency.example', '{}', '{"account_type":"company_member"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dev@agency.example', '{}', '{"account_type":"company_member"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eli@other.example', '{}', '{"account_type":"company_member"}'),
  ('00000000-0000-0000-0000-00000000000f', 'zoe@talentloom.example', '{"age_18_plus":"true"}', '{}');

select pg_temp.ok((select account_type = 'creator' and email = 'ava@example.com' and age_attested_at is not null
                   from profiles where id = '00000000-0000-0000-0000-00000000000a'),
  '2. creator sign-up creates a creator profile with lowercased email and age attestation');
select pg_temp.ok((select count(*) = 3 from consents where user_id = '00000000-0000-0000-0000-00000000000a'),
  '3. sign-up records 18+, terms and privacy consents');
select pg_temp.ok((select count(*) = 1 from creator_privacy_settings s join creator_profiles c on c.id = s.creator_id
                   where c.user_id = '00000000-0000-0000-0000-00000000000a'),
  '4. privacy settings row created automatically');
select pg_temp.ok((select account_type = 'creator' from profiles where id = '00000000-0000-0000-0000-00000000000b'),
  '5. user-supplied account_type=super_admin in metadata is ignored');
-- Supabase's admin API inserts the user first and sets app_metadata afterwards; the pending table covers that.
select public.register_pending_company_account('New.Owner@Agency.example');
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values ('00000000-0000-0000-0000-000000000011', 'new.owner@agency.example', '{}', '{}');
select pg_temp.ok((select account_type = 'company_member' from profiles where id = '00000000-0000-0000-0000-000000000011')
                  and not exists (select 1 from private.pending_company_accounts),
  '6a. server-registered company accounts are created even before app_metadata is set');
select pg_temp.as_anon();
select pg_temp.fails($$select public.register_pending_company_account('attacker@example.com')$$,
  '6b. only the server can register company accounts');
select pg_temp.as_postgres();
select pg_temp.ok((select account_type = 'company_member' from profiles where id = '00000000-0000-0000-0000-00000000000c')
                  and not exists (select 1 from creator_profiles where user_id = '00000000-0000-0000-0000-00000000000c'),
  '6. server-created company member gets no creator profile');

-- Companies (created by admin/server) with plans
insert into companies (id, slug, name, status) values
  ('10000000-0000-0000-0000-000000000001', 'north-star-talent', 'North Star Talent (fictional)', 'approved'),
  ('10000000-0000-0000-0000-000000000002', 'other-agency', 'Other Agency (fictional)', 'submitted');
select pg_temp.ok((select count(*) = 8 from pipeline_stages s join pipelines p on p.id = s.pipeline_id
                   where p.company_id = '10000000-0000-0000-0000-000000000001'),
  '7. new company gets the default 8-stage pipeline');

insert into subscriptions (owner_type, owner_id, plan_id, status, collection_method, is_complimentary)
select 'company', '10000000-0000-0000-0000-000000000001', id, 'complimentary', 'none', true
from plans where key = 'management_agency';

insert into company_members (company_id, user_id, role_id)
select '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', id from company_roles where key = 'owner' and company_id is null;
insert into company_members (company_id, user_id, role_id)
select '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', id from company_roles where key = 'recruiter' and company_id is null;
insert into company_members (company_id, user_id, role_id)
select '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000e', id from company_roles where key = 'owner' and company_id is null;

select pg_temp.fails($$insert into company_members (company_id, user_id, role_id)
  select '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', id
  from company_roles where key = 'viewer' and company_id is null$$,
  '8. seat limit enforced (company without a plan has 1 seat)');

-- ---------------------------------------------------------------------
-- Creator A
-- ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select pg_temp.ok((select count(*) = 1 from creator_profiles), '9. creator sees only their own creator profile');
select pg_temp.ok((select count(*) = 1 from profiles), '10. creator sees only their own account row');
select pg_temp.ok(pg_temp.affected($$update creator_profiles set bio = 'Fictional creator bio', handle = 'ava.fictional'$$) = 1,
  '11. creator can edit their own profile');
select pg_temp.fails($$update profiles set account_type = 'super_admin' where id = auth.uid()$$,
  '12. creator cannot promote themselves');
select pg_temp.fails($$update profiles set status = 'active', email = 'x@y.z' where id = auth.uid()$$,
  '13. creator cannot change protected account fields');
select pg_temp.fails($$update creator_profiles set is_featured = true$$,
  '14. creator cannot mark themselves featured');
select pg_temp.fails($$update creator_profiles set is_discoverable = true$$,
  '15a. discoverability requires consent (enforced in the database)');
insert into consents (user_id, consent_type, document_version) values (auth.uid(), 'discoverability', 't1');
update creator_profiles set is_discoverable = true;
select pg_temp.ok((select is_discoverable and discoverable_consent_at is not null from creator_profiles),
  '15. turning on discoverability stamps consent');

-- Social accounts: Free plan allows 3
insert into social_accounts (creator_id, platform_id, handle)
select private.my_creator_id(), id, 'ava_' || key from platforms where key in ('instagram', 'tiktok', 'youtube');
select pg_temp.fails($$insert into social_accounts (creator_id, platform_id, handle)
  select private.my_creator_id(), id, 'ava_pin' from platforms where key = 'pinterest'$$,
  '16. Free plan limited to 3 social accounts');

-- Analytics need data consent, and are always self-reported
select pg_temp.fails($$insert into analytics_snapshots (social_account_id, followers)
  select id, 1000 from social_accounts where handle = 'ava_instagram'$$,
  '17a. analytics cannot be stored before creator data consent');
insert into consents (user_id, consent_type, document_version) values (auth.uid(), 'creator_data_consent', 't1');
insert into analytics_snapshots (social_account_id, followers, engagement_rate, source, verification_status)
select id, 84200, 5.8, 'admin_verified', 'verified' from social_accounts where handle = 'ava_instagram';
select pg_temp.ok((select source = 'self_reported' and verification_status = 'none' from analytics_snapshots),
  '17. creator-entered analytics are always stored as self-reported');
select pg_temp.fails($$update analytics_snapshots set verification_status = 'verified'$$,
  '18. creator cannot mark their analytics verified');

select pg_temp.fails($$insert into affiliate_codes (creator_id, brand_name) values (private.my_creator_id(), 'Fictional Brand')$$,
  '19. Affiliate Code Vault requires Creator Pro');

select pg_temp.ok((select count(*) = 10 from my_entitlements()), '20. my_entitlements() returns the creator feature set');
select pg_temp.fails($$select * from my_entitlements('10000000-0000-0000-0000-000000000001')$$,
  '21. creator cannot read a company''s entitlements');

-- Storage
select pg_temp.ok(pg_temp.affected($$insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-0000-0000-00000000000a/me.png')$$) = 1, '22. creator can upload into their own folder');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values
  ('avatars', '00000000-0000-0000-0000-00000000000b/not-mine.png')$$, '23. creator cannot upload into someone else''s folder');
select pg_temp.fails($$insert into storage.objects (bucket_id, name) values
  ('company-logos', '10000000-0000-0000-0000-000000000001/logo.png')$$, '24. creator cannot upload a company logo');

-- Company internals invisible to creators
select pg_temp.ok((select count(*) = 0 from companies) and (select count(*) = 0 from pipelines)
                  and (select count(*) = 0 from internal_notes), '25. creator cannot see company workspaces');

-- Upgrade A to Pro (server-side) and retry the vault
select pg_temp.as_postgres();
insert into subscriptions (owner_type, owner_id, plan_id, status)
select 'user', '00000000-0000-0000-0000-00000000000a', id, 'active' from plans where key = 'creator_pro';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(pg_temp.affected($$insert into affiliate_codes (creator_id, brand_name, code)
  values (private.my_creator_id(), 'Fictional Brand', 'AVA10')$$) = 1, '26. Creator Pro unlocks the Affiliate Code Vault');
select pg_temp.ok(pg_temp.affected($$insert into social_accounts (creator_id, platform_id, handle)
  select private.my_creator_id(), id, 'ava_pin' from platforms where key = 'pinterest'$$) = 1,
  '27. Creator Pro removes the social-account limit');

-- Phase 2: verification requests
select pg_temp.fails($$select public.request_verification((select id from analytics_snapshots limit 1))$$,
  'P2-1. verification needs uploaded evidence');
insert into analytics_evidence (creator_id, snapshot_id, storage_path, file_name, mime_type, size_bytes)
select private.my_creator_id(), id, auth.uid() || '/proof.png', 'proof.png', 'image/png', 1000 from analytics_snapshots limit 1;
select public.request_verification((select id from analytics_snapshots limit 1));
select pg_temp.ok((select verification_status = 'pending' and source = 'self_reported' from analytics_snapshots),
  'P2-2. creator can request verification; numbers stay self-reported while pending');
select pg_temp.fails($$select public.request_verification((select id from analytics_snapshots limit 1))$$,
  'P2-3. duplicate verification requests are blocked');

-- Phase 2: public profile respects privacy settings
update creator_profiles set headline = 'Fictional wellness creator', bio = 'Fictional bio', city = 'Austin';
select pg_temp.as_anon();
select pg_temp.ok((select (j ->> 'handle') = 'ava.fictional' and (j ->> 'bio') = 'Fictional bio'
                          and (j -> 'social_accounts' -> 0 ->> 'followers') = '84200'
                          and (j -> 'social_accounts' -> 0 ->> 'engagement_rate') is null
                          and (j ->> 'is_owner_preview') = 'false'
                   from (select public.get_public_creator_profile('Ava.Fictional') j) x),
  'P2-4. visitors see public fields; engagement (approved companies only) is hidden');
select pg_temp.ok((select (public.list_public_creators() ->> 'total') = '1'),
  'P2-5. directory lists discoverable creators');
select public.record_creator_profile_view((select (public.get_public_creator_profile('ava.fictional') ->> 'id')::uuid));
select pg_temp.as_postgres();
select pg_temp.ok((select profile_views_count = 1 from creator_profiles where handle = 'ava.fictional'),
  'P2-6. public profile views are counted');
update creator_privacy_settings set bio = 'private'
  where creator_id = (select id from creator_profiles where handle = 'ava.fictional');
select pg_temp.as_anon();
select pg_temp.ok((select public.get_public_creator_profile('ava.fictional') ->> 'bio') is null,
  'P2-7. fields set to private disappear from the public profile');

-- Phase 3: company search respects approval, plan and creator privacy
select pg_temp.login('00000000-0000-0000-0000-00000000000d');   -- recruiter, approved company on Agency plan
select pg_temp.ok((select (r ->> 'total') = '1' and (r ->> 'view_level') = '2'
                          and (r -> 'items' -> 0 ->> 'engagement_rate') = '5.800'
                   from (select public.search_creators('10000000-0000-0000-0000-000000000001') r) x),
  'P3-1. approved Agency company sees creators and permissioned analytics');
select pg_temp.ok((select (public.search_creators('10000000-0000-0000-0000-000000000001',
                     '{"engagement_min": "5"}'::jsonb) ->> 'total') = '1'),
  'P3-2. advanced filters work on plans that include them');
select pg_temp.fails($$select public.search_creators('10000000-0000-0000-0000-000000000002')$$,
  'P3-3. a company cannot search as another company');
select pg_temp.ok((select (j ->> 'view_level') = '2' and (j ->> 'handle') = 'ava.fictional'
                   from (select public.get_creator_for_company('10000000-0000-0000-0000-000000000001',
                           (public.search_creators('10000000-0000-0000-0000-000000000001') -> 'items' -> 0 ->> 'id')::uuid) j) x),
  'P3-4. approved company can open a creator profile');

select pg_temp.login('00000000-0000-0000-0000-00000000000e');   -- owner of a company still under review, no plan
select pg_temp.ok((select (r ->> 'view_level') = '0'
                          and (r -> 'items' -> 0 ->> 'followers') = '84200'
                          and (r -> 'items' -> 0 ->> 'engagement_rate') is null
                   from (select public.search_creators('10000000-0000-0000-0000-000000000002') r) x),
  'P3-5. unapproved company sees public fields only');
select pg_temp.fails($$select public.submit_company_for_review('10000000-0000-0000-0000-000000000002')$$,
  'P3-6. a company already under review cannot resubmit');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.search_creators('10000000-0000-0000-0000-000000000001')$$,
  'P3-7. creators cannot use company search');
update creator_privacy_settings set engagement = 'private';
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok((select (public.search_creators('10000000-0000-0000-0000-000000000001',
                     '{"engagement_min": "1"}'::jsonb) ->> 'total') = '0'),
  'P3-8. filtering on a hidden field never matches (no leaking through filters)');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update creator_privacy_settings set engagement = 'approved_companies';
select pg_temp.as_anon();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------------
-- Creator B cannot touch A
-- ---------------------------------------------------------------------
select pg_temp.as_postgres();
select set_config('tl.a_account', (select id::text from social_accounts where handle = 'ava_instagram'), false);
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) = 0 from social_accounts) and (select count(*) = 0 from analytics_snapshots)
                  and (select count(*) = 0 from affiliate_codes), '28. another creator sees none of A''s data');
select pg_temp.ok(pg_temp.affected($$update creator_profiles set bio = 'hacked'
  where user_id = '00000000-0000-0000-0000-00000000000a'$$) = 0, '29. another creator cannot edit A''s profile');
select pg_temp.ok((select (public.get_public_creator_profile('ava.fictional') ->> 'is_owner_preview') = 'false'),
  'P2-8. other users never get owner-preview access');
update creator_profiles set handle = 'ben.fictional';
select pg_temp.ok(public.get_public_creator_profile('ben.fictional') is not null
                  and (select public.get_public_creator_profile('ben.fictional') ->> 'is_owner_preview') = 'true',
  'P2-9. a hidden creator can preview their own page');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.get_public_creator_profile('ben.fictional') is null,
  'P2-10. hidden (non-discoverable) profiles are not visible to others');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into portfolio_items (creator_id, title, item_type, url)
select private.my_creator_id(), 'Fictional item ' || g, 'link', 'https://example.com/' || g from generate_series(1, 12) g;
select pg_temp.fails($$insert into portfolio_items (creator_id, title, item_type, url)
  values (private.my_creator_id(), 'One too many', 'link', 'https://example.com/13')$$,
  'P2-11. Free plan limited to 12 portfolio items');
select pg_temp.fails($$insert into analytics_snapshots (social_account_id, followers)
  values (current_setting('tl.a_account')::uuid, 1)$$, '30. cannot attach analytics to someone else''s account');

-- ---------------------------------------------------------------------
-- Company owner C
-- ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) = 1 from companies), '31. company member sees only their own company');
select pg_temp.ok((select count(*) = 0 from creator_profiles) and (select count(*) = 0 from analytics_snapshots),
  '32. companies cannot read creator tables directly (masking functions only)');
select pg_temp.ok(pg_temp.affected($$update companies set description = 'Fictional boutique agency'$$) = 1,
  '33. owner can edit the company profile');
select pg_temp.fails($$update companies set status = 'approved', is_verified_badge = true$$,
  '34. company cannot approve or badge itself');
select pg_temp.ok(pg_temp.affected($$update companies set description = 'x' where id = '10000000-0000-0000-0000-000000000002'$$) = 0,
  '35. company cannot edit another company');
select pg_temp.fails($$update company_members set status = 'removed' where user_id = auth.uid()$$,
  '35b. even an owner cannot edit their own membership');
select pg_temp.ok(pg_temp.affected($$update company_members set role_id = (select id from company_roles where key = 'viewer' and company_id is null)
  where user_id = '00000000-0000-0000-0000-00000000000d'$$) = 1, '35c. owner can change a teammate''s role');
update company_members set role_id = (select id from company_roles where key = 'recruiter' and company_id is null)
  where user_id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select count(*) = 2 from profiles), '36. members can see teammates (and not other users)');

insert into talent_lists (id, company_id, name, is_private, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Shortlist', false, auth.uid());
select pg_temp.fails($$insert into talent_lists (company_id, name, is_private, created_by)
  values ('10000000-0000-0000-0000-000000000001', 'Secret', true, auth.uid())$$,
  '37. private lists require Agency Pro');
select pg_temp.as_postgres();
insert into internal_notes (company_id, creator_id, author_id, body, visibility)
select '10000000-0000-0000-0000-000000000001', c.id, '00000000-0000-0000-0000-00000000000c', 'Owner private note', 'private'
from creator_profiles c where c.user_id = '00000000-0000-0000-0000-00000000000a';
insert into internal_notes (company_id, creator_id, author_id, body, visibility)
select '10000000-0000-0000-0000-000000000001', c.id, '00000000-0000-0000-0000-00000000000c', 'Team note', 'team'
from creator_profiles c where c.user_id = '00000000-0000-0000-0000-00000000000a';

-- ---------------------------------------------------------------------
-- Recruiter D
-- ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok(pg_temp.affected($$update companies set description = 'recruiter edit'$$) = 0,
  '38. recruiter lacks company.edit permission');
select pg_temp.ok(pg_temp.affected($$update company_members set role_id = (select id from company_roles where key = 'owner' and company_id is null)
  where user_id = auth.uid()$$) = 0, '39. recruiter cannot promote themselves');
select pg_temp.ok((select count(*) = 1 from internal_notes), '40. teammates see team notes but not private notes');
select pg_temp.ok((select count(*) = 1 from talent_lists), '41. recruiter sees the shared team list');

-- ---------------------------------------------------------------------
-- Other company owner E cannot see company 1
-- ---------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.ok((select count(*) = 1 from companies) and (select count(*) = 0 from talent_lists)
                  and (select count(*) = 0 from internal_notes) and (select count(*) = 1 from pipelines),
  '42. another company cannot see lists, notes or pipelines of company 1');

-- ---------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------
select pg_temp.as_postgres();
insert into conversations (id, company_id, creator_id, status)
select '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', c.id, 'pending'
from creator_profiles c where c.user_id = '00000000-0000-0000-0000-00000000000a';

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$insert into messages (conversation_id, sender_user_id, body)
  values ('30000000-0000-0000-0000-000000000001', auth.uid(), 'hi')$$, '43. no messages until the inquiry is accepted');
select pg_temp.as_postgres();
update conversations set status = 'open' where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(pg_temp.affected($$insert into messages (conversation_id, sender_user_id, body)
  values ('30000000-0000-0000-0000-000000000001', auth.uid(), 'Hi! Thanks for reaching out.')$$) = 1,
  '44. creator can message once the conversation is open');
select pg_temp.fails($$insert into messages (conversation_id, sender_user_id, body)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'spoofed')$$,
  '45. cannot send a message as someone else');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok(pg_temp.affected($$insert into messages (conversation_id, sender_user_id, body)
  values ('30000000-0000-0000-0000-000000000001', auth.uid(), 'Great to meet you!')$$) = 1,
  '46. approved company recruiter can reply');

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.ok((select count(*) = 0 from messages) and (select count(*) = 0 from conversations),
  '47. other companies cannot read the conversation');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into user_blocks (blocker_user_id, blocked_company_id) values (auth.uid(), '10000000-0000-0000-0000-000000000001');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.fails($$insert into messages (conversation_id, sender_user_id, body)
  values ('30000000-0000-0000-0000-000000000001', auth.uid(), 'still there?')$$, '48. blocked company cannot message');

select pg_temp.ok(pg_temp.affected($$update messages set body = 'edited'$$) = 0, '49. messages cannot be edited');

-- ---------------------------------------------------------------------
-- Super admin + MFA
-- ---------------------------------------------------------------------
select pg_temp.as_postgres();
select pg_temp.ok(public.bootstrap_super_admin('ZOE@talentloom.example') like 'Super admin created%',
  '50. bootstrap_super_admin promotes the first admin');
select pg_temp.fails($$select public.bootstrap_super_admin('ava@example.com')$$,
  '51. bootstrap_super_admin refuses once an admin exists');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.fails($$select public.bootstrap_super_admin('ava@example.com')$$,
  '52. bootstrap_super_admin is not callable from the app');

select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'aal1');
select pg_temp.ok((select count(*) = 1 from profiles), '53. admin WITHOUT MFA has no admin powers');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'aal2');
select pg_temp.ok((select count(*) >= 6 from profiles), '54. admin WITH MFA can see all users');
select pg_temp.ok(pg_temp.affected($$update analytics_snapshots set source = 'admin_verified', verification_status = 'verified',
  verified_by = auth.uid(), verified_at = now()$$) = 1, '55. admin can verify analytics');
select pg_temp.ok(pg_temp.affected($$update companies set status = 'approved'
  where id = '10000000-0000-0000-0000-000000000002'$$) = 1, '56. admin can approve a company');
select pg_temp.ok((select count(*) > 0 from audit_logs where action = 'companies.update'
                   and actor_id = '00000000-0000-0000-0000-00000000000f'), '57. admin actions are audit-logged with the actor');
select pg_temp.ok(pg_temp.affected($$delete from audit_logs$$) = 0, '58. admin cannot delete audit logs');
select pg_temp.as_postgres();
select pg_temp.fails($$update audit_logs set action = 'tampered'$$, '59. audit log cannot be altered even by the database owner');
select pg_temp.fails($$delete from audit_logs$$, '60. audit log cannot be deleted even by the database owner');

-- Creator edits a verified number → back to self-reported
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update analytics_snapshots set followers = 90000;
select pg_temp.ok((select source = 'self_reported' and verification_status = 'none' from analytics_snapshots),
  '61. editing verified numbers resets them to self-reported');

-- Revoking consent hides the profile
update consents set revoked_at = now() where consent_type = 'discoverability' and user_id = auth.uid();
select pg_temp.ok((select not is_discoverable from creator_profiles),
  'P2-12. revoking discoverability consent hides the profile immediately');

-- Suspension
select pg_temp.as_postgres();
update profiles set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(pg_temp.affected($$update creator_profiles set bio = 'still here'$$) = 0, '62. suspended users cannot edit data');

-- ---------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.ok((select count(*) = 6 from plans), '63. visitors can read active plans (pricing page)');
select pg_temp.ok((select count(*) = 0 from profiles) and (select count(*) = 0 from creator_profiles)
                  and (select count(*) = 0 from companies), '64. visitors cannot read user, creator or company tables');
select pg_temp.ok((select count(*) = 8 from legal_pages), '65. legal pages are public');
select pg_temp.ok(public.submit_company_lead('Fictional Agency', 'Pat Lee', 'pat@fictional.example') is not null,
  '66. visitors can submit a contact-sales request');
select pg_temp.ok((select count(*) = 0 from company_leads), '67. visitors cannot read leads');
select public.submit_company_lead('Fictional Agency', 'Pat Lee', 'pat@fictional.example');
select public.submit_company_lead('Fictional Agency', 'Pat Lee', 'pat@fictional.example');
select pg_temp.fails($$select public.submit_company_lead('Fictional Agency', 'Pat Lee', 'pat@fictional.example')$$,
  '68. contact-sales form is rate limited');
select pg_temp.fails($$select private.check_rate_limit('x', interval '1 hour', 1)$$,
  '69. internal helpers are not callable by visitors');

select pg_temp.as_postgres();
\echo
\echo ===== ALL SECURITY TESTS PASSED =====
