-- =====================================================================
-- TalentLoom · 0500 · Security helpers, guard triggers, lifecycle, audit
--
-- Helper functions live in the `private` schema, which is NOT exposed by
-- the Supabase Data API, so they cannot be called from the browser. RLS
-- policies may still use them (the roles get USAGE + EXECUTE below).
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
-- Functions created in `private` later must not be executable by default.
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------
create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'super_admin'
      and p.status = 'active'
      and p.deleted_at is null
  )
  -- Admin powers require a multi-factor session (TOTP).
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null
  );
$$;

-- TRUE for trusted server-side contexts (SQL editor, service role, SECURITY
-- DEFINER functions owned by postgres) or an MFA-verified super admin.
-- Deliberately SECURITY INVOKER so current_user reflects the real caller.
create or replace function private.is_privileged()
returns boolean language sql stable set search_path = '' as $$
  select current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin')
      or private.is_super_admin();
$$;

create or replace function private.my_creator_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select cp.id from public.creator_profiles cp
  where cp.user_id = auth.uid() and cp.deleted_at is null;
$$;

create or replace function private.my_company_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.company_id), '{}')
  from public.company_members m
  join public.companies c on c.id = m.company_id and c.deleted_at is null
  where m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function private.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_company_id = any (private.my_company_ids());
$$;

create or replace function private.has_company_permission(p_company_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id and c.deleted_at is null
    join public.company_role_permissions rp on rp.role_id = m.role_id
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission_key = p_permission
  );
$$;

create or replace function private.company_is_approved(p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company_id and c.status = 'approved' and c.deleted_at is null
  );
$$;

create or replace function private.is_blocked(p_creator_id uuid, p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_blocks b
    join public.creator_profiles cp on cp.user_id = b.blocker_user_id
    where cp.id = p_creator_id and b.blocked_company_id = p_company_id
  );
$$;

create or replace function private.owns_social_account(p_social_account_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.social_accounts sa
    where sa.id = p_social_account_id and sa.creator_id = private.my_creator_id()
  );
$$;

create or replace function private.owns_snapshot(p_snapshot_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.analytics_snapshots s
    join public.social_accounts sa on sa.id = s.social_account_id
    where s.id = p_snapshot_id and sa.creator_id = private.my_creator_id()
  );
$$;

create or replace function private.can_view_conversation(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (
        c.creator_id = private.my_creator_id()
        or private.has_company_permission(c.company_id, 'messages.view')
      )
  );
$$;

create or replace function private.shares_company_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.company_members a
    join public.company_members b on b.company_id = a.company_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user_id and b.status in ('active', 'invited')
  );
$$;

-- ---------------------------------------------------------------------
-- Entitlements (plan features + overrides). Limits: NULL = unlimited.
-- ---------------------------------------------------------------------
create or replace function private.plan_id_for(p_owner_type public.owner_type, p_owner_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (
      select s.plan_id
      from public.subscriptions s
      where s.owner_type = p_owner_type
        and s.owner_id = p_owner_id
        and (s.comp_expires_at is null or s.comp_expires_at > now())
        and (
          s.status in ('active', 'trialing', 'complimentary')
          or (
            s.status = 'past_due'
            and s.current_period_end + make_interval(days => coalesce(
              (select (ps.value #>> '{}')::int from public.platform_settings ps
               where ps.key = 'billing.past_due_grace_days'), 7)) > now()
          )
        )
      order by s.created_at desc
      limit 1
    ),
    (
      select p.id from public.plans p
      where p.key = case p_owner_type when 'user' then 'creator_free' else 'company_pending' end
    )
  );
$$;

create or replace function private.entitlement(
  p_owner_type public.owner_type, p_owner_id uuid, p_feature text,
  out enabled boolean, out limit_value integer
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_override record;
begin
  select o.enabled, o.limit_value into v_override
  from public.entitlement_overrides o
  where o.owner_type = p_owner_type and o.owner_id = p_owner_id and o.feature_key = p_feature
    and (o.expires_at is null or o.expires_at > now())
  order by o.created_at desc
  limit 1;

  if found then
    enabled := v_override.enabled;
    limit_value := v_override.limit_value;
    return;
  end if;

  select pf.enabled, pf.limit_value into enabled, limit_value
  from public.plan_features pf
  where pf.plan_id = private.plan_id_for(p_owner_type, p_owner_id) and pf.feature_key = p_feature;

  if not found then
    enabled := false;
    limit_value := 0;
  end if;
end;
$$;

create or replace function private.has_feature(p_owner_type public.owner_type, p_owner_id uuid, p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select e.enabled from private.entitlement(p_owner_type, p_owner_id, p_feature) e), false);
$$;

-- Returns NULL for unlimited, 0 when the feature is disabled.
create or replace function private.feature_limit(p_owner_type public.owner_type, p_owner_id uuid, p_feature text)
returns integer language sql stable security definer set search_path = '' as $$
  select case when e.enabled then e.limit_value else 0 end
  from private.entitlement(p_owner_type, p_owner_id, p_feature) e;
$$;

-- Public RPC: entitlements for the signed-in user, or for a company they belong to.
create or replace function public.my_entitlements(p_company_id uuid default null)
returns table (feature_key text, enabled boolean, limit_value integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_owner_type public.owner_type;
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_company_id is null then
    v_owner_type := 'user';
    v_owner_id := auth.uid();
  elsif private.is_company_member(p_company_id) then
    v_owner_type := 'company';
    v_owner_id := p_company_id;
  else
    raise exception 'not a member of this company' using errcode = '42501';
  end if;

  return query
  select f.key, e.enabled, e.limit_value
  from public.features f
  cross join lateral private.entitlement(v_owner_type, v_owner_id, f.key) e
  where f.audience = case v_owner_type when 'user' then 'creator' else 'company' end
  order by f.sort;
end;
$$;

-- ---------------------------------------------------------------------
-- Audit log writer + generic row-change trigger
-- ---------------------------------------------------------------------
create or replace function private.write_audit(
  p_action text, p_target_type text, p_target_id text,
  p_before jsonb default null, p_after jsonb default null, p_metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, actor_email, action, target_type, target_id, before, after, metadata)
  values (
    auth.uid(),
    (select p.email from public.profiles p where p.id = auth.uid()),
    p_action, p_target_type, p_target_id, p_before, p_after, coalesce(p_metadata, '{}')
  );
end;
$$;

create or replace function private.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_before jsonb := '{}';
  v_after jsonb := '{}';
  v_key text;
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at') and (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_before := v_before || jsonb_build_object(v_key, v_old -> v_key);
        v_after := v_after || jsonb_build_object(v_key, v_new -> v_key);
      end if;
    end loop;
    if v_after = '{}' then
      return new;
    end if;
  else
    v_before := v_old;
    v_after := v_new;
  end if;

  perform private.write_audit(
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'slug',
             (v_row ->> 'plan_id') || ':' || (v_row ->> 'feature_key')),
    v_before,
    v_after,
    jsonb_build_object('db_role', current_setting('role', true))
  );
  return coalesce(new, old);
end;
$$;

-- Audit rows can never be changed or removed, by anyone.
create or replace function private.audit_logs_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.audit_logs_immutable();

-- ---------------------------------------------------------------------
-- Guard triggers: block privilege escalation through ordinary updates.
-- These run as the CALLER (security invoker) so is_privileged() sees the
-- real role.
-- ---------------------------------------------------------------------
create or replace function private.guard_profiles()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then
    return new;
  end if;
  if new.account_type is distinct from old.account_type
     or new.status is distinct from old.status
     or new.email is distinct from old.email
     or new.age_attested_at is distinct from old.age_attested_at
     or new.suspended_reason is distinct from old.suspended_reason
     or new.deleted_at is distinct from old.deleted_at
     or new.id is distinct from old.id then
    raise exception 'You cannot change protected account fields' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profiles();

create or replace function private.guard_creator_profiles()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.is_featured is distinct from old.is_featured
     or new.featured_until is distinct from old.featured_until
     or new.profile_views_count is distinct from old.profile_views_count
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'You cannot change protected profile fields' using errcode = '42501';
  end if;
  -- Turning discoverability on must be an explicit, fresh consent.
  if new.is_discoverable and not old.is_discoverable then
    new.discoverable_consent_at := coalesce(new.discoverable_consent_at, now());
  end if;
  return new;
end;
$$;
create trigger creator_profiles_guard before update on public.creator_profiles
  for each row execute function private.guard_creator_profiles();

create or replace function private.guard_analytics_snapshots()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Anything a creator types is self-reported. Full stop.
    new.source := 'self_reported';
    new.verification_status := 'none';
    new.verified_by := null;
    new.verified_at := null;
    return new;
  end if;

  if new.social_account_id is distinct from old.social_account_id then
    raise exception 'Snapshots cannot be moved between accounts' using errcode = '42501';
  end if;

  -- Editing the numbers on a verified snapshot drops it back to self-reported.
  if (new.followers, new.avg_views, new.avg_likes, new.avg_comments, new.engagement_rate, new.growth_30d_pct, new.captured_at)
     is distinct from
     (old.followers, old.avg_views, old.avg_likes, old.avg_comments, old.engagement_rate, old.growth_30d_pct, old.captured_at) then
    new.source := 'self_reported';
    new.verification_status := 'none';
    new.verified_by := null;
    new.verified_at := null;
    return new;
  end if;

  if new.source is distinct from old.source
     or new.verification_status is distinct from old.verification_status
     or new.verified_by is distinct from old.verified_by
     or new.verified_at is distinct from old.verified_at then
    raise exception 'Only TalentLoom staff can change verification fields' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger analytics_snapshots_guard before insert or update on public.analytics_snapshots
  for each row execute function private.guard_analytics_snapshots();

create or replace function private.guard_companies()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.is_verified_badge is distinct from old.is_verified_badge
     or new.is_featured is distinct from old.is_featured
     or new.outreach_frozen is distinct from old.outreach_frozen
     or new.approved_at is distinct from old.approved_at
     or new.slug is distinct from old.slug
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'You cannot change protected company fields' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger companies_guard before update on public.companies
  for each row execute function private.guard_companies();

create or replace function private.guard_company_members()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_owner_role uuid;
  v_caller_is_owner boolean;
begin
  if private.is_privileged() then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'Membership cannot move between companies' using errcode = '42501';
  end if;

  -- Nobody edits their own membership (prevents self-promotion).
  if coalesce(new.user_id, old.user_id) = auth.uid() then
    raise exception 'You cannot change your own team membership' using errcode = '42501';
  end if;

  select r.id into v_owner_role from public.company_roles r where r.company_id is null and r.key = 'owner';
  select exists (
    select 1 from public.company_members m
    where m.company_id = coalesce(new.company_id, old.company_id)
      and m.user_id = auth.uid() and m.status = 'active' and m.role_id = v_owner_role
  ) into v_caller_is_owner;

  -- Only an owner can grant, change, or remove the owner role.
  if not v_caller_is_owner and (
       (tg_op in ('INSERT', 'UPDATE') and new.role_id = v_owner_role)
    or (tg_op in ('UPDATE', 'DELETE') and old.role_id = v_owner_role)
  ) then
    raise exception 'Only an owner can manage owners' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;
create trigger company_members_guard before insert or update or delete on public.company_members
  for each row execute function private.guard_company_members();

-- ---------------------------------------------------------------------
-- Plan-limit enforcement (server-side, cannot be bypassed by the UI)
-- ---------------------------------------------------------------------
create or replace function private.enforce_social_account_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_limit integer;
  v_count integer;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  select cp.user_id into v_user from public.creator_profiles cp where cp.id = new.creator_id;
  v_limit := private.feature_limit('user', v_user, 'social_accounts.max');
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from public.social_accounts sa
  where sa.creator_id = new.creator_id and sa.deleted_at is null and sa.id <> new.id;
  if v_count >= v_limit then
    raise exception 'Your plan allows up to % social accounts. Upgrade to Creator Pro for unlimited accounts.', v_limit
      using errcode = 'P0001', hint = 'plan_limit:social_accounts.max';
  end if;
  return new;
end;
$$;
create trigger social_accounts_limit before insert or update of deleted_at on public.social_accounts
  for each row execute function private.enforce_social_account_limit();

create or replace function private.enforce_saved_creator_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
  v_limit integer;
  v_count integer;
begin
  select l.company_id into v_company from public.talent_lists l where l.id = new.list_id;
  v_limit := private.feature_limit('company', v_company, 'saved_creators.max');
  if v_limit is null then
    return new;
  end if;
  select count(distinct m.creator_id) into v_count
  from public.talent_list_members m
  join public.talent_lists l on l.id = m.list_id
  where l.company_id = v_company and m.creator_id <> new.creator_id;
  if v_count >= v_limit then
    raise exception 'Your plan allows up to % saved creators.', v_limit
      using errcode = 'P0001', hint = 'plan_limit:saved_creators.max';
  end if;
  return new;
end;
$$;
create trigger talent_list_members_limit before insert on public.talent_list_members
  for each row execute function private.enforce_saved_creator_limit();

create or replace function private.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then
    return new;
  end if;
  v_limit := private.feature_limit('company', new.company_id, 'seats.max');
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from public.company_members m
  where m.company_id = new.company_id and m.status = 'active' and m.id <> new.id;
  if v_count >= v_limit then
    raise exception 'Your plan includes % seat(s). Contact TalentLoom to add more.', v_limit
      using errcode = 'P0001', hint = 'plan_limit:seats.max';
  end if;
  return new;
end;
$$;
create trigger company_members_seat_limit before insert or update of status on public.company_members
  for each row execute function private.enforce_seat_limit();

create or replace function private.enforce_pipeline_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.is_default then
    return new;  -- the default pipeline is always allowed
  end if;
  v_limit := private.feature_limit('company', new.company_id, 'pipelines.max');
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from public.pipelines p where p.company_id = new.company_id;
  if v_count >= v_limit then
    raise exception 'Your plan allows % recruiting pipeline(s).', v_limit
      using errcode = 'P0001', hint = 'plan_limit:pipelines.max';
  end if;
  return new;
end;
$$;
create trigger pipelines_limit before insert on public.pipelines
  for each row execute function private.enforce_pipeline_limit();

-- ---------------------------------------------------------------------
-- Lifecycle
-- ---------------------------------------------------------------------

-- New auth user → profile (+ creator profile). Public sign-up can only ever
-- produce a CREATOR. Company accounts are created server-side by an admin and
-- carry account_type in app_metadata (which users cannot set themselves).
create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type public.account_type := 'creator';
  v_terms_version text := coalesce(new.raw_user_meta_data ->> 'terms_version', 'unversioned');
  v_age_ok boolean := coalesce(new.raw_user_meta_data ->> 'age_18_plus', '') = 'true';
begin
  if new.raw_app_meta_data ->> 'account_type' = 'company_member' then
    v_type := 'company_member';
  end if;

  if v_type = 'creator' and not v_age_ok then
    raise exception 'You must confirm you are 18 or older to create an account'
      using errcode = 'P0001';
  end if;

  insert into public.profiles (id, account_type, email, display_name, age_attested_at)
  values (
    new.id,
    v_type,
    lower(new.email),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''),
    case when v_age_ok then now() end
  );

  if v_type = 'creator' then
    insert into public.creator_profiles (user_id, display_name)
    values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''));

    insert into public.consents (user_id, consent_type, document_version) values
      (new.id, 'age_18_plus', v_terms_version),
      (new.id, 'terms_of_service', v_terms_version),
      (new.id, 'privacy_policy', v_terms_version);
  end if;

  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.sync_auth_user_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.sync_auth_user_email();

create or replace function private.create_privacy_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.creator_privacy_settings (creator_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger creator_profiles_privacy after insert on public.creator_profiles
  for each row execute function private.create_privacy_settings();

create or replace function private.create_default_pipeline()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pipeline uuid;
begin
  insert into public.pipelines (company_id, name, is_default)
  values (new.id, 'Recruiting', true)
  returning id into v_pipeline;

  insert into public.pipeline_stages (pipeline_id, name, position, kind, is_system) values
    (v_pipeline, 'Discovered', 1, 'open', true),
    (v_pipeline, 'Saved', 2, 'open', true),
    (v_pipeline, 'Contacted', 3, 'open', true),
    (v_pipeline, 'Responded', 4, 'open', true),
    (v_pipeline, 'Interviewing', 5, 'open', true),
    (v_pipeline, 'Offered', 6, 'open', true),
    (v_pipeline, 'Signed', 7, 'signed', true),
    (v_pipeline, 'Passed', 8, 'passed', true);
  return new;
end;
$$;
create trigger companies_default_pipeline after insert on public.companies
  for each row execute function private.create_default_pipeline();

-- ---------------------------------------------------------------------
-- First super admin (run ONCE from the Supabase SQL editor)
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_super_admin(p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.profiles where account_type = 'super_admin' and deleted_at is null) then
    raise exception 'A super admin already exists. Promote additional admins from the admin dashboard.';
  end if;

  select id into v_id from public.profiles where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No account found for %. Sign up on the site and verify the email first.', p_email;
  end if;

  update public.profiles set account_type = 'super_admin', status = 'active' where id = v_id;
  update public.creator_profiles set is_discoverable = false where user_id = v_id;

  insert into public.audit_logs (actor_id, actor_email, action, target_type, target_id, after, metadata)
  values (null, 'sql-editor', 'admin.bootstrap', 'profile', v_id::text,
          jsonb_build_object('account_type', 'super_admin'),
          jsonb_build_object('note', 'First super admin created via bootstrap_super_admin()'));

  return 'Super admin created for ' || lower(trim(p_email)) || '. Sign in and enrol MFA to open /admin.';
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges
-- Supabase grants EXECUTE on new functions to anon/authenticated by default.
-- Lock everything down, then grant back only what RLS policies need.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  private.is_super_admin(),
  private.is_active_user(),
  private.is_privileged(),
  private.my_creator_id(),
  private.my_company_ids(),
  private.is_company_member(uuid),
  private.has_company_permission(uuid, text),
  private.company_is_approved(uuid),
  private.is_blocked(uuid, uuid),
  private.owns_social_account(uuid),
  private.owns_snapshot(uuid),
  private.can_view_conversation(uuid),
  private.shares_company_with(uuid),
  private.has_feature(public.owner_type, uuid, text),
  private.feature_limit(public.owner_type, uuid, text),
  private.entitlement(public.owner_type, uuid, text),
  private.plan_id_for(public.owner_type, uuid)
to anon, authenticated;

-- Trigger functions run with their owner's rights; still grant to the API roles
-- so triggers fired by their statements can execute.
grant execute on function
  private.guard_profiles(),
  private.guard_creator_profiles(),
  private.guard_analytics_snapshots(),
  private.guard_companies(),
  private.guard_company_members(),
  private.audit_logs_immutable()
to authenticated, service_role;

grant execute on all functions in schema private to service_role;

revoke execute on function public.bootstrap_super_admin(text) from public, anon, authenticated, service_role;
revoke execute on function public.my_entitlements(uuid) from public, anon;
grant execute on function public.my_entitlements(uuid) to authenticated;
