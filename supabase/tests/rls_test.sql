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

-- ---------------------------------------------------------------------
-- Connected social accounts (official platform APIs)
--  G, H = creators (fictional)
-- ---------------------------------------------------------------------
select pg_temp.as_postgres();
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000021', 'gia@example.com', '{"age_18_plus":"true","terms_version":"t1"}', '{}'),
  ('00000000-0000-0000-0000-000000000022', 'hal@example.com', '{"age_18_plus":"true","terms_version":"t1"}', '{}');
insert into consents (user_id, consent_type, document_version) values
  ('00000000-0000-0000-0000-000000000021', 'creator_data_consent', 't1'),
  ('00000000-0000-0000-0000-000000000022', 'creator_data_consent', 't1'),
  ('00000000-0000-0000-0000-000000000022', 'platform_connection', 't1');

select pg_temp.login('00000000-0000-0000-0000-000000000021');
insert into social_accounts (creator_id, platform_id, handle, connection_type, external_account_id)
values (private.my_creator_id(), (select id from platforms where key = 'instagram'), 'gia.fictional', 'oauth', 'ig-fake-1');
select pg_temp.ok((select connection_type = 'manual' and external_account_id is null from social_accounts),
  'SC-1. a creator cannot create an account that claims to be connected');
select pg_temp.fails($$update social_accounts set connection_type = 'oauth', external_account_id = 'ig-1'$$,
  'SC-2. a creator cannot mark an account as connected');
select pg_temp.fails($$insert into social_connections (social_account_id, provider)
  select id, 'instagram' from social_accounts$$, 'SC-3. a creator cannot write connection records');
insert into analytics_snapshots (social_account_id, followers, captured_at)
  select id, 999999, current_date from social_accounts;
insert into audience_demographics (snapshot_id, dimension, bucket, pct)
  select id, 'age', '18-24', 90 from analytics_snapshots;
select pg_temp.fails($$select public.attach_oauth_account(auth.uid(), 'instagram', 'ig-1', 'gia.fictional', null, '{}', 'x', null)$$,
  'SC-4. creators cannot call the server-only connect function');
select pg_temp.fails($$select public.record_api_snapshot((select id from social_accounts), 5, null, null, null, null, '{}')$$,
  'SC-5. creators cannot write API-verified numbers');

-- Server (service role) connects the account after the platform confirms it.
select pg_temp.as_postgres();
set role service_role;
select pg_temp.fails($$select public.attach_oauth_account('00000000-0000-0000-0000-000000000021', 'instagram', 'ig-1',
  'gia.fictional', null, '{}', 'enc', null)$$, 'SC-6. connecting requires the creator''s connection consent');
reset role;
insert into consents (user_id, consent_type, document_version)
  values ('00000000-0000-0000-0000-000000000021', 'platform_connection', 't1');
set role service_role;
select public.attach_oauth_account('00000000-0000-0000-0000-000000000021', 'instagram', 'ig-1',
  'Gia.Fictional', 'https://www.instagram.com/gia.fictional', '{instagram_business_basic}', 'enc-secret', now() + interval '60 days');
select pg_temp.ok((select count(*) = 1 and bool_and(connection_type = 'oauth' and external_account_id = 'ig-1')
                   from social_accounts sa join creator_profiles cp on cp.id = sa.creator_id
                   where cp.user_id = '00000000-0000-0000-0000-000000000021' and sa.deleted_at is null),
  'SC-7. connecting reuses the creator''s existing account with the same handle');
select public.record_api_snapshot((select sa.id from social_accounts sa where sa.external_account_id = 'ig-1'),
  12000, null, 400, 20, 3.5, '{"source":"test"}');
select pg_temp.ok((select source = 'api_verified' and verification_status = 'verified' and followers = 12000
                   from analytics_snapshots s join social_accounts sa on sa.id = s.social_account_id
                   where sa.external_account_id = 'ig-1' and s.captured_at = current_date),
  'SC-8. synced numbers are stored as API-verified (replacing same-day typed numbers)');
select pg_temp.ok((select count(*) = 0 from audience_demographics d join analytics_snapshots s on s.id = d.snapshot_id
                   join social_accounts sa on sa.id = s.social_account_id where sa.external_account_id = 'ig-1'),
  'SC-9. typed demographics are removed from numbers that become verified');
select pg_temp.fails($$select public.attach_oauth_account('00000000-0000-0000-0000-000000000022', 'instagram', 'ig-1',
  'gia.fictional', null, '{}', 'enc', null)$$, 'SC-10. one platform account cannot be connected to two creators');
reset role;

select pg_temp.login('00000000-0000-0000-0000-000000000021');
select pg_temp.fails($$select encrypted_tokens from social_connections$$, 'SC-11. creators cannot read tokens, even their own');
select pg_temp.ok((select status = 'active' and provider = 'instagram' from social_connections),
  'SC-12. creators can see their own connection status');
select pg_temp.fails($$update analytics_snapshots set followers = 50000000$$, 'SC-13. creators cannot edit API-verified numbers');
select pg_temp.fails($$insert into analytics_snapshots (social_account_id, followers, captured_at)
  select id, 50000000, current_date - 1 from social_accounts$$, 'SC-14. creators cannot type numbers for a connected account');
select pg_temp.fails($$insert into audience_demographics (snapshot_id, dimension, bucket, pct)
  select id, 'age', '25-34', 80 from analytics_snapshots$$, 'SC-15. creators cannot add demographics to verified numbers');
select pg_temp.fails($$update social_accounts set handle = 'someone.famous'$$,
  'SC-16. a connected account''s handle cannot be changed');

select pg_temp.login('00000000-0000-0000-0000-000000000022');
select pg_temp.ok((select count(*) = 0 from social_connections), 'SC-17. creators cannot see other creators'' connections');

select pg_temp.login('00000000-0000-0000-0000-000000000021');
update social_accounts set deleted_at = now(), is_primary = false;
select pg_temp.as_postgres();
select pg_temp.ok((select status = 'revoked' and encrypted_tokens is null from social_connections c
                   join social_accounts sa on sa.id = c.social_account_id where sa.external_account_id = 'ig-1'),
  'SC-18. removing a connected account wipes its tokens');

-- Withdrawing connection consent disconnects every account.
set role service_role;
select public.attach_oauth_account('00000000-0000-0000-0000-000000000022', 'youtube', 'yt-1',
  'hal.fictional', null, '{}', 'enc', null);
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000022');
update consents set revoked_at = now() where consent_type = 'platform_connection' and user_id = auth.uid();
select pg_temp.as_postgres();
select pg_temp.ok((select c.status = 'revoked' and c.encrypted_tokens is null and sa.connection_type = 'manual'
                   from social_connections c join social_accounts sa on sa.id = c.social_account_id
                   where c.external_username = 'hal.fictional'),
  'SC-19. withdrawing connection consent disconnects accounts and wipes tokens');
select pg_temp.ok((select count(*) > 0 from audit_logs where target_type = 'social_connections'
                   and not (after ? 'encrypted_tokens')),
  'SC-20. connections are audit-logged without tokens');

-- ---------------------------------------------------------------------
-- Phase 4: inquiries, messaging, pipeline, roster (all fictional)
--  P, Q = discoverable creators · Z = hidden creator
--  Company X (approved, Scout plan): R owner · S recruiter · V viewer
--  Company Y (submitted): W owner
-- ---------------------------------------------------------------------
select pg_temp.as_postgres();
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-000000000031', 'pia@example.com', '{"age_18_plus":"true","display_name":"Pia (fictional)"}', '{}'),
  ('00000000-0000-0000-0000-000000000032', 'quinn@example.com', '{"age_18_plus":"true","display_name":"Quinn (fictional)"}', '{}'),
  ('00000000-0000-0000-0000-000000000037', 'zed@example.com', '{"age_18_plus":"true"}', '{}'),
  ('00000000-0000-0000-0000-000000000033', 'rae@x-agency.example', '{"display_name":"Rae"}', '{"account_type":"company_member"}'),
  ('00000000-0000-0000-0000-000000000034', 'sam@x-agency.example', '{"display_name":"Sam"}', '{"account_type":"company_member"}'),
  ('00000000-0000-0000-0000-000000000035', 'val@x-agency.example', '{}', '{"account_type":"company_member"}'),
  ('00000000-0000-0000-0000-000000000036', 'wes@y-agency.example', '{}', '{"account_type":"company_member"}');
insert into consents (user_id, consent_type, document_version)
select u, t, 't1' from unnest(array['00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032']::uuid[]) u,
  unnest(array['creator_data_consent','discoverability']) t;
update creator_profiles set is_discoverable = true, discoverable_consent_at = now(),
  handle = case user_id when '00000000-0000-0000-0000-000000000031' then 'pia.fictional' else 'quinn.fictional' end
where user_id in ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000032');

insert into companies (id, slug, name, status) values
  ('10000000-0000-0000-0000-000000000009', 'x-agency', 'X Agency (fictional)', 'approved'),
  ('10000000-0000-0000-0000-00000000000a', 'y-agency', 'Y Agency (fictional)', 'submitted');
insert into subscriptions (owner_type, owner_id, plan_id, status, collection_method, is_complimentary)
select 'company', '10000000-0000-0000-0000-000000000009', id, 'complimentary', 'none', true from plans where key = 'management_scout';
insert into subscriptions (owner_type, owner_id, plan_id, status, collection_method, is_complimentary)
select 'company', '10000000-0000-0000-0000-00000000000a', id, 'complimentary', 'none', true from plans where key = 'management_scout';
insert into entitlement_overrides (owner_type, owner_id, feature_key, enabled, limit_value)
values ('company', '10000000-0000-0000-0000-000000000009', 'seats.max', true, 5);
insert into company_members (company_id, user_id, role_id)
select '10000000-0000-0000-0000-000000000009', u, (select id from company_roles where key = k and company_id is null)
from (values ('00000000-0000-0000-0000-000000000033'::uuid, 'owner'), ('00000000-0000-0000-0000-000000000034'::uuid, 'recruiter'),
             ('00000000-0000-0000-0000-000000000035'::uuid, 'viewer')) v(u, k);
insert into company_members (company_id, user_id, role_id)
select '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000036', id from company_roles where key = 'owner' and company_id is null;

create temp table ids as
select (select id from creator_profiles where user_id = '00000000-0000-0000-0000-000000000031') as pia,
       (select id from creator_profiles where user_id = '00000000-0000-0000-0000-000000000032') as quinn,
       (select id from creator_profiles where user_id = '00000000-0000-0000-0000-000000000037') as zed;
grant select on ids to authenticated, anon;

-- Sending
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.ok(public.send_inquiry('10000000-0000-0000-0000-000000000009', (select pia from ids),
  'Representation chat', 'Hi Pia, we love your wellness content and would like to talk about representation.') is not null,
  'R1. an approved company recruiter can send an inquiry');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-000000000009', (select pia from ids),
  'Again', 'Following up on our earlier note about representation.')$$, 'R2. only one open inquiry per creator');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-000000000009', (select zed from ids),
  'Hello there', 'A message long enough to pass the length check.')$$, 'R3. hidden creators cannot be contacted');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-000000000009', (select quinn from ids),
  'Hi', 'short')$$, 'R4. inquiries need a real subject and message');
select pg_temp.ok((select s.name = 'Contacted' from pipeline_entries e join pipeline_stages s on s.id = e.stage_id
                   where e.creator_id = (select pia from ids)), 'R5. sending moves the creator to Contacted in the pipeline');

select pg_temp.login('00000000-0000-0000-0000-000000000035');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-000000000009', (select quinn from ids),
  'Hello Quinn', 'A message long enough to pass the length check.')$$, 'R6. a viewer cannot send inquiries');
select pg_temp.login('00000000-0000-0000-0000-000000000036');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-00000000000a', (select quinn from ids),
  'Hello Quinn', 'A message long enough to pass the length check.')$$, 'R7. an unapproved company cannot send inquiries');

select pg_temp.as_postgres();
insert into entitlement_overrides (owner_type, owner_id, feature_key, enabled, limit_value)
values ('company', '10000000-0000-0000-0000-000000000009', 'contacts.monthly', true, 1);
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-000000000009', (select quinn from ids),
  'Hello Quinn', 'A message long enough to pass the length check.')$$, 'R8. the monthly new-creator contact limit is enforced');
select pg_temp.as_postgres();
delete from entitlement_overrides where feature_key = 'contacts.monthly' and owner_id = '10000000-0000-0000-0000-000000000009';

-- Receiving
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.ok((select count(*) = 1 from notifications where type = 'inquiry.new'), 'R9. the creator is notified');
select pg_temp.ok(jsonb_array_length(public.my_inquiries()) = 1 and public.my_inquiries() -> 0 -> 'company' ->> 'slug' = 'x-agency',
  'R10. the creator sees the inquiry with the company''s details');
select pg_temp.ok((select public.my_badges() ->> 'inquiries') = '1', 'R11. unanswered inquiries are counted for the sidebar');
select pg_temp.fails($$insert into messages (conversation_id, sender_user_id, body)
  select conversation_id, auth.uid(), 'hi' from representation_inquiries$$, 'R12. no messaging before accepting');
select pg_temp.fails($$select public.company_inquiries('10000000-0000-0000-0000-000000000009')$$,
  'R13. creators cannot list a company''s inquiries');

select pg_temp.login('00000000-0000-0000-0000-000000000032');
select pg_temp.fails($$select public.respond_to_inquiry((select id from representation_inquiries limit 1), true)$$,
  'R14. another creator cannot answer someone else''s inquiry');
select pg_temp.ok((select count(*) = 0 from representation_inquiries), 'R15. creators only see their own inquiries');
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.fails($$select public.respond_to_inquiry((select id from representation_inquiries limit 1), true)$$,
  'R16. a company cannot accept its own inquiry');

select pg_temp.login('00000000-0000-0000-0000-000000000031');
select public.mark_inquiry_viewed((select id from representation_inquiries limit 1));
select public.respond_to_inquiry((select id from representation_inquiries limit 1), true);
select pg_temp.ok((select status = 'open' from conversations) and (select count(*) = 1 from messages),
  'R17. accepting opens the conversation with the inquiry as the first message');
insert into messages (conversation_id, sender_user_id, body) select id, auth.uid(), 'Thanks, happy to chat!' from conversations;
insert into messages (conversation_id, sender_user_id, body) select id, auth.uid(), 'When works for you?' from conversations;

select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.ok((select count(*) = 1 from notifications where type = 'inquiry.accepted'), 'R18. the sender is told the inquiry was accepted');
select pg_temp.ok((select count(*) = 1 from notifications where type = 'message.new'),
  'R19. new messages notify the company sender once per conversation (no spam)');
select pg_temp.ok((public.my_inbox('10000000-0000-0000-0000-000000000009') -> 0 ->> 'unread') = '2',
  'R20. unread counts work');
select public.mark_conversation_read((select id from conversations));
select pg_temp.ok((public.my_inbox('10000000-0000-0000-0000-000000000009') -> 0 ->> 'unread') = '0'
                  and (select count(*) = 0 from notifications where type = 'message.new' and read_at is null),
  'R21. opening a conversation marks it and its alert read');
select pg_temp.ok((select s.name = 'Responded' from pipeline_entries e join pipeline_stages s on s.id = e.stage_id),
  'R22. accepting moves the creator to Responded');
select pg_temp.ok((public.get_conversation((select id from conversations)) ->> 'can_send')::boolean,
  'R23. the recruiter can reply');

select pg_temp.login('00000000-0000-0000-0000-000000000036');
select pg_temp.fails($$select public.get_conversation((select id from conversations where company_id = '10000000-0000-0000-0000-000000000009'))$$,
  'R24. other companies cannot open the conversation');
select pg_temp.fails($$select public.my_inbox('10000000-0000-0000-0000-000000000009')$$, 'R25. other companies cannot read the inbox');

-- Blocking
select pg_temp.login('00000000-0000-0000-0000-000000000031');
insert into user_blocks (blocker_user_id, blocked_company_id) values (auth.uid(), '10000000-0000-0000-0000-000000000009');
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.fails($$insert into messages (conversation_id, sender_user_id, body)
  select id, auth.uid(), 'still there?' from conversations$$, 'R26. a blocked company cannot message');
select pg_temp.ok((select status = 'blocked' from conversations), 'R27. blocking marks the conversation blocked');
select pg_temp.login('00000000-0000-0000-0000-000000000031');
delete from user_blocks where blocked_company_id = '10000000-0000-0000-0000-000000000009';
select pg_temp.ok((select status = 'open' from conversations), 'R28. unblocking re-opens an accepted conversation');

-- Decline, withdraw, cool-off
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select public.withdraw_inquiry(public.send_inquiry('10000000-0000-0000-0000-000000000009', (select quinn from ids),
  'Hello Quinn', 'A message long enough to pass the length check.'));
select pg_temp.ok((select status = 'withdrawn' from representation_inquiries where creator_id = (select quinn from ids)),
  'R29. a company can withdraw an unanswered inquiry');
select public.send_inquiry('10000000-0000-0000-0000-000000000009', (select quinn from ids),
  'Hello again', 'A message long enough to pass the length check.');
select pg_temp.login('00000000-0000-0000-0000-000000000032');
select public.respond_to_inquiry((select id from representation_inquiries where status = 'sent'), false);
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.ok((select count(*) = 1 from notifications where type = 'inquiry.declined'), 'R30. the sender is told about a decline');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-000000000009', (select quinn from ids),
  'One more try', 'A message long enough to pass the length check.')$$, 'R31. a declined creator can''t be re-contacted for 30 days');

-- Pipeline, notes, roster
select pg_temp.fails($$insert into pipeline_entries (pipeline_id, creator_id, stage_id)
  select p.id, (select zed from ids), s.id from pipelines p join pipeline_stages s on s.pipeline_id = p.id
  where p.company_id = '10000000-0000-0000-0000-000000000009' and s.position = 1$$,
  'R32. companies cannot add hidden creators they have no relationship with');
select pg_temp.fails($$insert into internal_notes (company_id, creator_id, author_id, body, visibility)
  values ('10000000-0000-0000-0000-000000000009', (select zed from ids), auth.uid(), 'note', 'private')$$,
  'R33. companies cannot write notes about unknown hidden creators');
select pg_temp.ok(pg_temp.affected($$insert into internal_notes (company_id, creator_id, author_id, body, visibility)
  values ('10000000-0000-0000-0000-000000000009', (select pia from ids), auth.uid(), 'Great fit for wellness brands', 'private')$$) = 1,
  'R34. recruiters can write private notes');
select pg_temp.fails($$update pipeline_entries set assigned_to = '00000000-0000-0000-0000-000000000033'
  where creator_id = (select pia from ids)$$, 'R35. assignments need the team-assignments plan feature');
update pipeline_entries set stage_id = (select s.id from pipeline_stages s join pipelines p on p.id = s.pipeline_id
  where p.company_id = '10000000-0000-0000-0000-000000000009' and s.kind = 'signed')
where creator_id = (select pia from ids);
select pg_temp.ok((select count(*) = 0 from roster_members), 'R36. no roster without the roster plan feature');
select pg_temp.ok((select count(*) >= 3 from pipeline_stage_history), 'R37. stage moves are recorded in history');
select pg_temp.ok(jsonb_array_length(public.pipeline_board((select id from pipelines where is_default
  and company_id = '10000000-0000-0000-0000-000000000009')) -> 'entries') = 2, 'R38. the board shows the company''s entries');

select pg_temp.as_postgres();
insert into entitlement_overrides (owner_type, owner_id, feature_key, enabled, limit_value) values
  ('company', '10000000-0000-0000-0000-000000000009', 'roster', true, null),
  ('company', '10000000-0000-0000-0000-000000000009', 'team_assignments', true, null);
select pg_temp.login('00000000-0000-0000-0000-000000000034');
update pipeline_entries set stage_id = (select s.id from pipeline_stages s join pipelines p on p.id = s.pipeline_id
  where p.company_id = '10000000-0000-0000-0000-000000000009' and s.name = 'Offered') where creator_id = (select pia from ids);
update pipeline_entries set stage_id = (select s.id from pipeline_stages s join pipelines p on p.id = s.pipeline_id
  where p.company_id = '10000000-0000-0000-0000-000000000009' and s.kind = 'signed') where creator_id = (select pia from ids);
select pg_temp.ok((select count(*) = 1 from roster_members where creator_id = (select pia from ids)),
  'R39. moving to Signed adds the creator to the roster');
select pg_temp.fails($$update pipeline_entries set assigned_to = '00000000-0000-0000-0000-000000000036'
  where creator_id = (select pia from ids)$$, 'R40. only teammates can be assigned');
select pg_temp.ok(pg_temp.affected($$update pipeline_entries set assigned_to = '00000000-0000-0000-0000-000000000033'
  where creator_id = (select pia from ids)$$) = 1, 'R41. teammates can be assigned with the plan feature');

-- Company profile
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.ok(public.get_company_profile('x-agency') ->> 'name' = 'X Agency (fictional)',
  'R42. signed-in creators can view an approved company''s profile');
select pg_temp.ok(public.get_company_profile('y-agency') is null, 'R43. unapproved companies have no profile');
select pg_temp.as_anon();
select pg_temp.ok(public.get_company_profile('x-agency') is null and jsonb_array_length(public.list_companies()) = 0,
  'R44. visitors cannot view company profiles while the directory is off');
select pg_temp.as_postgres();
update platform_settings set value = 'true' where key = 'features.company_directory';
select pg_temp.as_anon();
select pg_temp.ok(public.get_company_profile('x-agency') is not null and public.get_company_profile('y-agency') is null,
  'R45. with the directory on, approved companies are public (unapproved never)');
select pg_temp.as_postgres();
update platform_settings set value = 'false' where key = 'features.company_directory';

-- ---------------------------------------------------------------------
-- Phase 5: admin console, impersonation, templates, support
-- ---------------------------------------------------------------------
create or replace function pg_temp.login_session(p_uid uuid, p_session uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal1', 'session_id', p_session)::text, false);
  execute 'set role authenticated';
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

select pg_temp.as_postgres();
insert into impersonation_sessions (admin_id, target_user_id, reason, auth_session_id)
values ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000031', 'Support ticket check', 'aaaaaaaa-0000-0000-0000-000000000001');

select pg_temp.login_session('00000000-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) = 1 from creator_profiles) and jsonb_array_length(public.my_inbox()) = 1,
  'A1. an impersonation session can read what the user sees');
select pg_temp.ok(pg_temp.affected($$update creator_profiles set bio = 'changed by admin'$$) = 0,
  'A2. an impersonation session cannot edit the profile');
select pg_temp.fails($$insert into messages (conversation_id, sender_user_id, body) select id, auth.uid(), 'hi' from conversations$$,
  'A3. an impersonation session cannot send messages');
select public.mark_conversation_read((select id from conversations));
select pg_temp.ok(pg_temp.affected($$update notifications set read_at = now() where read_at is null$$) = 0,
  'A3b. viewing as a user does not change their read/unread state');
select pg_temp.login_session('00000000-0000-0000-0000-000000000034', 'aaaaaaaa-0000-0000-0000-000000000009');
select pg_temp.login_session('00000000-0000-0000-0000-000000000031', 'bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.ok(pg_temp.affected($$update creator_profiles set bio = 'Fictional bio, edited by Pia'$$) = 1,
  'A4. the user''s own sessions keep working normally');
select pg_temp.fails($$select public.record_impersonation_start('00000000-0000-0000-0000-00000000000f',
  '00000000-0000-0000-0000-000000000031', 'trying', gen_random_uuid())$$, 'A5. users cannot start impersonation');
select pg_temp.as_postgres();
set role service_role;
select pg_temp.fails($$select public.record_impersonation_start('00000000-0000-0000-0000-00000000000f',
  '00000000-0000-0000-0000-00000000000f', 'looking around', gen_random_uuid())$$, 'A6. admins cannot be impersonated');
reset role;

-- Templates drive notification text, and can be switched off
select pg_temp.ok((select title = 'X Agency (fictional) sent you a representation inquiry.' from notifications
                   where user_id = '00000000-0000-0000-0000-000000000031' and type = 'inquiry.new'),
  'A7. notification text comes from the editable template');
update notification_templates set enabled = false where key = 'message.new';
update notifications set read_at = now() where type = 'message.new';
select pg_temp.login('00000000-0000-0000-0000-000000000031');
insert into messages (conversation_id, sender_user_id, body) select id, auth.uid(), 'Template test' from conversations;
select pg_temp.as_postgres();
select pg_temp.ok((select count(*) = 0 from notifications where type = 'message.new' and read_at is null),
  'A8. disabling a template stops that notification');
update notification_templates set enabled = true where key = 'message.new';

-- Settings drive limits
update platform_settings set value = '1' where key = 'messages.max_per_minute';
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.fails($$insert into messages (conversation_id, sender_user_id, body)
  select c.id, auth.uid(), 'burst ' || g from conversations c, generate_series(1, 2) g$$, 'A9. the message rate setting is enforced');
select pg_temp.as_postgres();
update platform_settings set value = '20' where key = 'messages.max_per_minute';
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000038', 'tess@example.com', '{"age_18_plus":"true","display_name":"Tess (fictional)"}');
insert into consents (user_id, consent_type, document_version) values
  ('00000000-0000-0000-0000-000000000038', 'creator_data_consent', 't1'), ('00000000-0000-0000-0000-000000000038', 'discoverability', 't1');
update creator_profiles set is_discoverable = true, discoverable_consent_at = now(), handle = 'tess.fictional'
where user_id = '00000000-0000-0000-0000-000000000038';
create temp table tess as select id from creator_profiles where handle = 'tess.fictional';
grant select on tess to authenticated;
update platform_settings set value = '0' where key = 'outreach.max_inquiries_per_hour';
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.fails($$select public.send_inquiry('10000000-0000-0000-0000-000000000009',
  (select id from tess), 'Hello Tess', 'A message long enough to pass the check.')$$,
  'A10. the per-company outreach setting is enforced');
select pg_temp.as_postgres();
update platform_settings set value = '10' where key = 'outreach.max_inquiries_per_hour';

-- Admin user management
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.fails($$select public.admin_set_user_status('00000000-0000-0000-0000-000000000032', 'suspended', 'spam reports')$$,
  'A11. non-admins cannot suspend users');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'aal2');
select pg_temp.fails($$select public.admin_set_user_status('00000000-0000-0000-0000-000000000032', 'suspended', '')$$,
  'A12. suspending needs a reason');
select public.admin_set_user_status('00000000-0000-0000-0000-000000000032', 'suspended', 'Repeated spam reports');
select pg_temp.ok((select p.status = 'suspended' and not cp.is_discoverable from profiles p join creator_profiles cp on cp.user_id = p.id
                   where p.id = '00000000-0000-0000-0000-000000000032'), 'A13. suspending hides the creator');
select pg_temp.ok((select count(*) > 0 from audit_logs where action = 'profiles.update' and target_id = '00000000-0000-0000-0000-000000000032'),
  'A14. status changes are audit-logged');
select public.admin_set_user_status('00000000-0000-0000-0000-000000000032', 'active');
select pg_temp.fails($$select public.admin_set_user_status(auth.uid(), 'suspended', 'testing myself')$$, 'A15. admins cannot suspend themselves');
select pg_temp.fails($$select public.admin_set_super_admin(auth.uid(), false)$$, 'A16. admins cannot change their own role');
select public.admin_set_super_admin('00000000-0000-0000-0000-000000000033', true);
select pg_temp.ok((select account_type = 'super_admin' from profiles where id = '00000000-0000-0000-0000-000000000033'),
  'A17. an admin can promote another super admin');
select public.admin_set_super_admin('00000000-0000-0000-0000-000000000033', false);
select pg_temp.ok((select account_type = 'company_member' from profiles where id = '00000000-0000-0000-0000-000000000033'),
  'A18. and demote them back');

-- Verification review
select pg_temp.as_postgres();
insert into social_accounts (id, creator_id, platform_id, handle)
values ('50000000-0000-0000-0000-000000000001', (select id from creator_profiles where handle = 'tess.fictional'),
        (select id from platforms where key = 'instagram'), 'tess.fictional');
insert into analytics_snapshots (id, social_account_id, followers, verification_status)
values ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 12000, 'pending');
insert into verification_requests (id, subject_type, subject_id, requested_by)
values ('50000000-0000-0000-0000-000000000003', 'analytics', '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000038');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'aal2');
select pg_temp.fails($$select public.admin_review_verification('50000000-0000-0000-0000-000000000003', false, '')$$,
  'A19. rejecting needs a note for the creator');
select public.admin_review_verification('50000000-0000-0000-0000-000000000003', true, null);
select pg_temp.ok((select source = 'admin_verified' and verification_status = 'verified' from analytics_snapshots
                   where id = '50000000-0000-0000-0000-000000000002'), 'A20. approving marks the numbers reviewed');
select pg_temp.as_postgres();
select pg_temp.ok((select title = 'Your Instagram numbers are now verified by TalentLoom.' from notifications
                   where user_id = '00000000-0000-0000-0000-000000000038' and type = 'verification.approved'),
  'A21. the creator is notified');

-- Support
select pg_temp.login('00000000-0000-0000-0000-000000000038');
select public.open_support_request('Can''t upload evidence', 'verification', 'The upload button spins forever on my phone.');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'aal2');
insert into support_messages (request_id, author_id, body, is_internal)
select id, auth.uid(), 'Internal: check storage logs', true from support_requests;
insert into support_messages (request_id, author_id, body)
select id, auth.uid(), 'Thanks — could you try again now?' from support_requests;
select pg_temp.login('00000000-0000-0000-0000-000000000038');
select pg_temp.ok((select count(*) = 2 from support_messages), 'A22. users never see internal support notes');
select pg_temp.ok((select status = 'pending' from support_requests), 'A23. an admin reply marks the request waiting on the user');
select pg_temp.ok((select count(*) = 1 from notifications where type = 'support.reply'), 'A24. the user is notified of the reply');
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.ok((select count(*) = 0 from support_requests), 'A25. users only see their own support requests');

-- ---------------------------------------------------------------------
-- Phase 6/7: billing records, credits, insights, reports
-- ---------------------------------------------------------------------
select pg_temp.as_postgres();
update plan_prices set stripe_price_id = 'price_test_creator_pro_month'
where plan_id = (select id from plans where key = 'creator_pro') and billing_interval = 'month';
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.fails($$select public.billing_upsert_subscription('user', auth.uid(), 'sub_x', 'price_test_creator_pro_month',
  'active', now(), now() + interval '1 month', false, null, null)$$, 'B1. users cannot write subscriptions');
select pg_temp.ok((public.my_profile_insights() ->> 'locked')::boolean, 'B2. profile insights are a Creator Pro feature');
select pg_temp.as_postgres();
set role service_role;
select public.billing_upsert_subscription('user', '00000000-0000-0000-0000-000000000031', 'sub_test_1', 'price_test_creator_pro_month',
  'active', now(), now() + interval '1 month', false, null, null);
select pg_temp.fails($$select public.billing_upsert_subscription('company', '10000000-0000-0000-0000-000000000009', 'sub_test_2',
  'price_test_creator_pro_month', 'active', now(), now() + interval '1 month', false, null, null)$$,
  'B3. a creator plan cannot be attached to a company');
select public.billing_record_invoice('user', '00000000-0000-0000-0000-000000000031', 'in_test_1', 'Creator Pro', 999, 'usd', 'failed', null, null, null);
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.ok((select count(*) = 1 from my_entitlements() where feature_key = 'affiliate_vault' and enabled),
  'B4. a paid subscription unlocks Creator Pro features');
select pg_temp.ok(not (public.my_profile_insights() ->> 'locked')::boolean, 'B5. and profile insights');
select pg_temp.ok((select count(*) = 1 from payments where status = 'failed')
                  and (select count(*) = 1 from notifications where type = 'payment.failed'),
  'B6. failed payments are recorded and the user is warned');
select pg_temp.ok(pg_temp.affected($$insert into affiliate_codes (creator_id, brand_name, code) values (private.my_creator_id(), 'Fictional Brand', 'PIA10')$$) = 1,
  'B7. Creator Pro members can use the Affiliate Code Vault');
select pg_temp.as_postgres();
set role service_role;
select public.billing_upsert_subscription('user', '00000000-0000-0000-0000-000000000031', 'sub_test_1', 'price_test_creator_pro_month',
  'canceled', null, null, false, now(), null);
reset role;
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.fails($$insert into affiliate_codes (creator_id, brand_name, code) values (private.my_creator_id(), 'Another Brand', 'X')$$,
  'B8. after cancelling, new Pro records are blocked');
select pg_temp.ok((select count(*) = 1 from affiliate_codes), 'B9. but existing records stay readable');

-- Contact credits extend the monthly allowance
select pg_temp.as_postgres();
insert into entitlement_overrides (owner_type, owner_id, feature_key, enabled, limit_value)
values ('company', '10000000-0000-0000-0000-000000000009', 'contacts.monthly', true, 0);
insert into contact_credit_ledger (company_id, delta, reason, source) values ('10000000-0000-0000-0000-000000000009', 1, 'Test grant', 'admin');
select pg_temp.login('00000000-0000-0000-0000-000000000034');
select pg_temp.ok(public.send_inquiry('10000000-0000-0000-0000-000000000009', (select id from tess), 'Hello Tess',
  'A message long enough to pass the length check.') is not null, 'B10. a contact credit is used when the monthly allowance is spent');
select pg_temp.ok(public.company_credit_balance('10000000-0000-0000-0000-000000000009') = 0, 'B11. the credit is consumed');
select pg_temp.login('00000000-0000-0000-0000-00000000000f', 'aal2');
select pg_temp.ok((public.admin_revenue_summary() ->> 'canceled_30d')::int = 1, 'B12. admins see revenue and churn');
select pg_temp.login('00000000-0000-0000-0000-000000000031');
select pg_temp.fails($$select public.admin_revenue_summary()$$, 'B13. revenue metrics are admin-only');

select pg_temp.as_postgres();
\echo
\echo ===== ALL SECURITY TESTS PASSED =====
