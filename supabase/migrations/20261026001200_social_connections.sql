-- =====================================================================
-- TalentLoom · 1200 · Connected social accounts (official platform APIs)
--
-- Creators can connect Instagram, TikTok and YouTube through each
-- platform's own sign-in (OAuth). TalentLoom then reads their numbers
-- straight from the platform and stores them as API-verified.
--
-- Rules enforced here (not just in the app):
--  - Only trusted server code (service role) can mark an account as
--    connected, store tokens or write API-verified numbers.
--  - Tokens are stored encrypted by the app AND are never readable by
--    signed-in users (column-level grants).
--  - A connected account's handle comes from the platform and can't be
--    edited; its numbers can't be typed in or edited by the creator.
--  - Demographics can't be added to verified numbers by the creator.
--  - One platform account can only be connected to one creator.
--  - Removing the account or withdrawing consent wipes the tokens.
-- =====================================================================

-- ---------- Consent type for connecting a platform -------------------
alter table public.consents drop constraint consents_consent_type_check;
alter table public.consents add constraint consents_consent_type_check check (consent_type in (
  'terms_of_service', 'privacy_policy', 'age_18_plus', 'creator_data_consent',
  'discoverability', 'analytics_sharing', 'company_standards', 'platform_connection'
));

-- ---------- Platforms with an official connection --------------------
update public.platforms set api_supported = true where key in ('instagram', 'tiktok', 'youtube');

-- ---------- Connection details ----------------------------------------
alter table public.social_connections
  add column encrypted_tokens text,                       -- AES-256-GCM, encrypted by the app (TOKEN_ENCRYPTION_KEY)
  add column token_expires_at timestamptz,
  add column external_username text check (char_length(external_username) <= 200),
  add column last_error text check (char_length(last_error) <= 500),
  add column last_attempt_at timestamptz,
  add column updated_at timestamptz not null default now();
alter table public.social_connections
  add constraint social_connections_provider_check check (provider in ('instagram', 'tiktok', 'youtube'));
create trigger social_connections_updated_at before update on public.social_connections
  for each row execute function public.set_updated_at();
create index social_connections_sync_idx on public.social_connections (status, last_synced_at);

-- Signed-in users may read the STATUS of their own connections — never the tokens.
revoke all on public.social_connections from anon, authenticated;
grant select (social_account_id, provider, scopes, status, connected_at, last_synced_at,
              last_attempt_at, last_error, external_username, revoked_at)
  on public.social_connections to authenticated;
grant all on public.social_connections to service_role;
create policy connections_owner_select on public.social_connections for select to authenticated
  using (private.owns_social_account(social_account_id));

-- One platform account ↔ one live TalentLoom account.
create unique index social_accounts_unique_external
  on public.social_accounts (platform_id, external_account_id)
  where deleted_at is null and external_account_id is not null;

-- ---------- Guard: creators can't fake a connection -------------------
create or replace function private.guard_social_accounts()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.connection_type := 'manual';
    new.external_account_id := null;
    return new;
  end if;

  if new.connection_type is distinct from old.connection_type
     or new.external_account_id is distinct from old.external_account_id then
    raise exception 'Accounts can only be connected through the platform''s own sign-in'
      using errcode = '42501';
  end if;

  if (new.handle is distinct from old.handle or new.platform_id is distinct from old.platform_id
      or new.url is distinct from old.url)
     and (old.connection_type = 'oauth' or exists (
       select 1 from public.analytics_snapshots s
       where s.social_account_id = old.id and s.source <> 'self_reported')) then
    raise exception 'This account has verified numbers, so its handle and platform can''t be changed. Add it again as a new account instead.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger social_accounts_guard before insert or update on public.social_accounts
  for each row execute function private.guard_social_accounts();

-- Removing an account (soft delete) wipes its tokens immediately.
create or replace function private.on_social_account_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.social_connections
       set status = 'revoked', revoked_at = coalesce(revoked_at, now()),
           encrypted_tokens = null, token_expires_at = null
     where social_account_id = new.id;
  end if;
  return new;
end;
$$;
create trigger social_accounts_removed after update of deleted_at on public.social_accounts
  for each row execute function private.on_social_account_removed();

-- ---------- Guard: API numbers can't be typed over --------------------
create or replace function private.guard_analytics_snapshots()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from public.social_accounts sa
               where sa.id = new.social_account_id and sa.connection_type = 'oauth') then
      raise exception 'This account is connected to the platform, so its numbers update automatically.'
        using errcode = 'P0001';
    end if;
    -- Anything a creator types is self-reported. Full stop.
    new.source := 'self_reported';
    new.verification_status := 'none';
    new.verified_by := null;
    new.verified_at := null;
    return new;
  end if;

  if old.source = 'api_verified' then
    raise exception 'Numbers synced from the platform can''t be edited.' using errcode = '42501';
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

-- Demographics typed by a creator can't be attached to verified numbers.
create or replace function private.guard_audience_demographics()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then
    return new;
  end if;
  if exists (select 1 from public.analytics_snapshots s
             where s.id in (new.snapshot_id, case when tg_op = 'UPDATE' then old.snapshot_id end)
               and s.source <> 'self_reported') then
    raise exception 'These numbers are verified, so their demographics can''t be changed here.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger audience_demographics_guard before insert or update on public.audience_demographics
  for each row execute function private.guard_audience_demographics();

grant execute on function
  private.guard_social_accounts(),
  private.guard_analytics_snapshots(),
  private.guard_audience_demographics()
to authenticated, service_role;

-- ---------- Withdrawing connection consent disconnects everything -----
create or replace function private.on_platform_consent_revoked()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.revoked_at is not null and old.revoked_at is null
     and new.consent_type in ('platform_connection', 'creator_data_consent') then
    update public.social_connections c
       set status = 'revoked', revoked_at = coalesce(c.revoked_at, now()),
           encrypted_tokens = null, token_expires_at = null
      from public.social_accounts sa
      join public.creator_profiles cp on cp.id = sa.creator_id
     where c.social_account_id = sa.id and cp.user_id = new.user_id and c.status <> 'revoked';
    update public.social_accounts sa
       set connection_type = 'manual', external_account_id = null
      from public.creator_profiles cp
     where cp.id = sa.creator_id and cp.user_id = new.user_id and sa.connection_type = 'oauth';
  end if;
  return new;
end;
$$;
create trigger consents_platform_revoked after update of revoked_at on public.consents
  for each row execute function private.on_platform_consent_revoked();

-- ---------- Server-only: attach a connected account ------------------
-- Called by the OAuth callback (service role) after the platform confirms
-- who the user is. Reuses the creator's existing account for that
-- platform account (or same handle) instead of creating duplicates.
create or replace function public.attach_oauth_account(
  p_user_id uuid,
  p_platform_key text,
  p_external_id text,
  p_username text,
  p_url text,
  p_scopes text[],
  p_encrypted_tokens text,
  p_token_expires_at timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_creator uuid;
  v_platform uuid;
  v_account uuid;
  v_has_primary boolean;
begin
  if p_external_id is null or btrim(p_external_id) = '' or p_username is null or btrim(p_username) = '' then
    raise exception 'The platform did not return an account id' using errcode = '22023';
  end if;
  select cp.id into v_creator from public.creator_profiles cp
  where cp.user_id = p_user_id and cp.deleted_at is null;
  if v_creator is null then
    raise exception 'Creator profile not found' using errcode = 'P0002';
  end if;
  if not private.user_has_consent(p_user_id, 'platform_connection')
     or not private.user_has_consent(p_user_id, 'creator_data_consent') then
    raise exception 'Consent is required before connecting an account' using errcode = '42501';
  end if;
  select id into v_platform from public.platforms where key = p_platform_key and api_supported;
  if v_platform is null then
    raise exception 'Unsupported platform' using errcode = '22023';
  end if;

  if exists (select 1 from public.social_accounts sa
             where sa.platform_id = v_platform and sa.external_account_id = p_external_id
               and sa.deleted_at is null and sa.creator_id <> v_creator) then
    raise exception 'already_connected_elsewhere' using errcode = 'P0001',
      hint = 'This platform account is already connected to another TalentLoom creator.';
  end if;

  select sa.id into v_account from public.social_accounts sa
  where sa.creator_id = v_creator and sa.platform_id = v_platform and sa.deleted_at is null
    and (sa.external_account_id = p_external_id
         or (sa.connection_type = 'manual' and lower(sa.handle) = lower(p_username)))
  order by (sa.external_account_id = p_external_id) desc nulls last
  limit 1;

  if v_account is null then
    select exists (select 1 from public.social_accounts sa
                   where sa.creator_id = v_creator and sa.deleted_at is null and sa.is_primary)
      into v_has_primary;
    insert into public.social_accounts (creator_id, platform_id, handle, url, connection_type, external_account_id, is_primary)
    values (v_creator, v_platform, left(p_username, 100), p_url, 'oauth', p_external_id, not v_has_primary)
    returning id into v_account;
  else
    update public.social_accounts
       set connection_type = 'oauth', external_account_id = p_external_id,
           handle = left(p_username, 100), url = coalesce(p_url, url)
     where id = v_account;
  end if;

  insert into public.social_connections
    (social_account_id, provider, scopes, encrypted_tokens, token_expires_at, external_username,
     status, connected_at, revoked_at, last_error)
  values
    (v_account, p_platform_key, coalesce(p_scopes, '{}'), p_encrypted_tokens, p_token_expires_at, p_username,
     'active', now(), null, null)
  on conflict (social_account_id) do update
    set provider = excluded.provider, scopes = excluded.scopes, encrypted_tokens = excluded.encrypted_tokens,
        token_expires_at = excluded.token_expires_at, external_username = excluded.external_username,
        status = 'active', connected_at = now(), revoked_at = null, last_error = null;

  return v_account;
end;
$$;

-- ---------- Server-only: record numbers read from the platform --------
create or replace function public.record_api_snapshot(
  p_account_id uuid,
  p_followers bigint,
  p_avg_views bigint,
  p_avg_likes bigint,
  p_avg_comments bigint,
  p_engagement_rate numeric,
  p_raw jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := current_date;
  v_existing record;
  v_old_followers bigint;
  v_growth numeric;
  v_id uuid;
begin
  if not exists (select 1 from public.social_connections c
                 join public.social_accounts sa on sa.id = c.social_account_id
                 where c.social_account_id = p_account_id and c.status = 'active'
                   and sa.connection_type = 'oauth' and sa.deleted_at is null) then
    raise exception 'Account is not connected' using errcode = 'P0001';
  end if;

  -- 30-day growth, only against earlier platform-verified numbers (never mixed with typed numbers).
  select s.followers into v_old_followers from public.analytics_snapshots s
  where s.social_account_id = p_account_id and s.source = 'api_verified'
    and s.captured_at between v_today - 35 and v_today - 25 and s.followers > 0
  order by abs((v_today - 30) - s.captured_at) limit 1;
  if v_old_followers is not null and p_followers is not null then
    v_growth := least(10000, greatest(-100, round((p_followers - v_old_followers) * 100.0 / v_old_followers, 2)));
  end if;

  select s.id, s.source into v_existing from public.analytics_snapshots s
  where s.social_account_id = p_account_id and s.captured_at = v_today;

  if v_existing.id is not null then
    if v_existing.source <> 'api_verified' then
      -- Typed demographics must not appear under verified numbers.
      delete from public.audience_demographics where snapshot_id = v_existing.id;
    end if;
    update public.analytics_snapshots
       set followers = p_followers, avg_views = p_avg_views, avg_likes = p_avg_likes,
           avg_comments = p_avg_comments,
           engagement_rate = least(100, round(p_engagement_rate, 3)),
           growth_30d_pct = v_growth,
           source = 'api_verified', verification_status = 'verified',
           verified_by = null, verified_at = now(), raw = p_raw,
           notes = 'Read from the platform''s official API'
     where id = v_existing.id
    returning id into v_id;
  else
    insert into public.analytics_snapshots
      (social_account_id, captured_at, followers, avg_views, avg_likes, avg_comments, engagement_rate,
       growth_30d_pct, source, verification_status, verified_at, raw, notes)
    values
      (p_account_id, v_today, p_followers, p_avg_views, p_avg_likes, p_avg_comments,
       least(100, round(p_engagement_rate, 3)), v_growth, 'api_verified', 'verified', now(), p_raw,
       'Read from the platform''s official API')
    returning id into v_id;
  end if;

  update public.social_connections
     set last_synced_at = now(), last_attempt_at = now(), last_error = null
   where social_account_id = p_account_id;
  return v_id;
end;
$$;

-- ---------- Server-only: disconnect -----------------------------------
-- Keeps earlier snapshots (they were verified on their dates) but stops
-- syncing and wipes the tokens.
create or replace function public.disconnect_oauth_account(p_account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.social_connections
     set status = 'revoked', revoked_at = now(), encrypted_tokens = null, token_expires_at = null
   where social_account_id = p_account_id;
  update public.social_accounts
     set connection_type = 'manual', external_account_id = null
   where id = p_account_id;
end;
$$;

revoke execute on function
  public.attach_oauth_account(uuid, text, text, text, text, text[], text, timestamptz),
  public.record_api_snapshot(uuid, bigint, bigint, bigint, bigint, numeric, jsonb),
  public.disconnect_oauth_account(uuid)
from public, anon, authenticated;
grant execute on function
  public.attach_oauth_account(uuid, text, text, text, text, text[], text, timestamptz),
  public.record_api_snapshot(uuid, bigint, bigint, bigint, bigint, numeric, jsonb),
  public.disconnect_oauth_account(uuid)
to service_role;

-- Audit: connecting / disconnecting accounts. (Custom, so tokens never reach the audit log.)
create or replace function private.audit_social_connection()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.connected_at is not distinct from old.connected_at then
    return new;
  end if;
  perform private.write_audit(
    'social_connections.' || lower(tg_op),
    'social_connections',
    coalesce(new.social_account_id, old.social_account_id)::text,
    case when tg_op <> 'INSERT' then jsonb_build_object('status', old.status, 'provider', old.provider) else '{}'::jsonb end,
    case when tg_op <> 'DELETE' then jsonb_build_object('status', new.status, 'provider', new.provider,
                                                         'external_username', new.external_username) else '{}'::jsonb end,
    jsonb_build_object('db_role', current_setting('role', true))
  );
  return coalesce(new, old);
end;
$$;
create trigger audit_social_connections after insert or update or delete
  on public.social_connections for each row execute function private.audit_social_connection();
