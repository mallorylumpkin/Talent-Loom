-- =====================================================================
-- TalentLoom · 0900 · Phase 2: creator profile
--  - consent is required (in the database) before analytics are stored
--    and before a profile becomes discoverable
--  - analytics verification requests
--  - portfolio plan limit
--  - privacy-respecting public profile + directory functions
-- =====================================================================

-- ---------- Consent helpers -------------------------------------------
create or replace function private.user_has_consent(p_user_id uuid, p_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.consents c
    where c.user_id = p_user_id and c.consent_type = p_type and c.revoked_at is null
  );
$$;

create or replace function private.has_active_consent(p_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.user_has_consent(auth.uid(), p_type);
$$;

grant execute on function private.user_has_consent(uuid, text), private.has_active_consent(text)
  to anon, authenticated, service_role;

-- Revoking discoverability or data consent immediately hides the profile.
create or replace function private.on_consent_revoked()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.revoked_at is not null and old.revoked_at is null
     and new.consent_type in ('discoverability', 'creator_data_consent') then
    update public.creator_profiles set is_discoverable = false
    where user_id = new.user_id and is_discoverable;
  end if;
  return new;
end;
$$;
create trigger consents_revoked after update of revoked_at on public.consents
  for each row execute function private.on_consent_revoked();

-- ---------- Creator profile guard: discoverability needs consent -------
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
  if new.is_discoverable and not old.is_discoverable then
    if not private.user_has_consent(new.user_id, 'discoverability') then
      raise exception 'Please confirm you consent to being discoverable before turning this on.'
        using errcode = 'P0001';
    end if;
    new.discoverable_consent_at := now();
  end if;
  return new;
end;
$$;

-- ---------- Analytics require creator data consent ---------------------
drop policy snapshots_owner_insert on public.analytics_snapshots;
create policy snapshots_owner_insert on public.analytics_snapshots for insert to authenticated
  with check (private.owns_social_account(social_account_id) and private.is_active_user()
              and private.has_active_consent('creator_data_consent'));

drop policy snapshots_owner_update on public.analytics_snapshots;
create policy snapshots_owner_update on public.analytics_snapshots for update to authenticated
  using (private.owns_social_account(social_account_id) and private.is_active_user()
         and private.has_active_consent('creator_data_consent'))
  with check (private.owns_social_account(social_account_id));

drop policy owner_insert_analytics_evidence on public.analytics_evidence;
create policy owner_insert_analytics_evidence on public.analytics_evidence for insert to authenticated
  with check (creator_id = private.my_creator_id() and private.is_active_user()
              and private.has_active_consent('creator_data_consent'));

drop policy demographics_owner_all on public.audience_demographics;
create policy demographics_owner_select on public.audience_demographics for select to authenticated
  using (private.owns_snapshot(snapshot_id));
create policy demographics_owner_delete on public.audience_demographics for delete to authenticated
  using (private.owns_snapshot(snapshot_id) and private.is_active_user());
create policy demographics_owner_insert on public.audience_demographics for insert to authenticated
  with check (private.owns_snapshot(snapshot_id) and private.is_active_user()
              and private.has_active_consent('creator_data_consent'));
create policy demographics_owner_update on public.audience_demographics for update to authenticated
  using (private.owns_snapshot(snapshot_id) and private.is_active_user()
         and private.has_active_consent('creator_data_consent'))
  with check (private.owns_snapshot(snapshot_id));

-- One snapshot per account per day (updating the same day edits it).
create unique index analytics_snapshots_one_per_day
  on public.analytics_snapshots (social_account_id, captured_at);

-- ---------- Portfolio plan limit -----------------------------------------
create or replace function private.enforce_portfolio_limit()
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
  v_limit := private.feature_limit('user', v_user, 'portfolio_items.max');
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from public.portfolio_items p
  where p.creator_id = new.creator_id and p.deleted_at is null and p.id <> new.id;
  if v_count >= v_limit then
    raise exception 'Your plan allows up to % portfolio items. Upgrade to Creator Pro for unlimited items.', v_limit
      using errcode = 'P0001', hint = 'plan_limit:portfolio_items.max';
  end if;
  return new;
end;
$$;
create trigger portfolio_items_limit before insert or update of deleted_at on public.portfolio_items
  for each row execute function private.enforce_portfolio_limit();

-- ---------- Analytics verification request --------------------------------
create or replace function public.request_verification(p_snapshot_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_status public.verification_status;
  v_source public.analytics_source;
begin
  if auth.uid() is null or not private.is_active_user() then
    raise exception 'Sign in to request verification.' using errcode = '42501';
  end if;
  if not private.owns_snapshot(p_snapshot_id) then
    raise exception 'We couldn''t find those numbers.' using errcode = '42501';
  end if;

  select s.verification_status, s.source into v_status, v_source
  from public.analytics_snapshots s where s.id = p_snapshot_id;

  if v_source <> 'self_reported' then
    raise exception 'These numbers are already verified.' using errcode = 'P0001';
  end if;
  if v_status = 'pending' then
    raise exception 'Verification is already pending for these numbers.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.analytics_evidence e where e.snapshot_id = p_snapshot_id and e.deleted_at is null
  ) then
    raise exception 'Upload at least one screenshot or document as evidence first.' using errcode = 'P0001';
  end if;

  insert into public.verification_requests (subject_type, subject_id, requested_by, priority)
  values ('analytics', p_snapshot_id, auth.uid(),
          case when private.has_feature('user', auth.uid(), 'priority_verification') then 10 else 0 end)
  returning id into v_id;

  update public.analytics_snapshots set verification_status = 'pending' where id = p_snapshot_id;
  return v_id;
end;
$$;

-- ---------- Public profile (privacy-masked) -------------------------------
-- Returns only fields the creator marked PUBLIC. Non-discoverable profiles are
-- returned only to their owner (as a preview of what visitors would see).
create or replace function public.get_public_creator_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  ps record;
  v_owner boolean;
begin
  select cp.* into c
  from public.creator_profiles cp
  join public.profiles p on p.id = cp.user_id
  where cp.handle = lower(trim(p_handle))
    and cp.deleted_at is null
    and p.status = 'active' and p.deleted_at is null and p.account_type = 'creator';
  if not found then
    return null;
  end if;

  v_owner := coalesce(c.user_id = auth.uid(), false);
  if not c.is_discoverable and not v_owner then
    return null;
  end if;

  select * into ps from public.creator_privacy_settings where creator_id = c.id;

  return jsonb_build_object(
    'id', c.id,
    'handle', c.handle,
    'display_name', c.display_name,
    'headline', c.headline,
    'avatar_path', c.avatar_path,
    'cover_path', c.cover_path,
    'bio', case when ps.bio = 'public' then c.bio end,
    'location', case when ps.location = 'public'
                     then jsonb_build_object('city', c.city, 'region', c.region, 'country', c.country) end,
    'seeking_management', c.seeking_management,
    'representation_status', c.representation_status,
    'is_featured', c.is_featured and (c.featured_until is null or c.featured_until > now()),
    'is_discoverable', c.is_discoverable,
    'is_owner_preview', v_owner,
    'niches', (select coalesce(jsonb_agg(n.label order by n.sort), '[]'::jsonb)
               from public.creator_niches x join public.niches n on n.id = x.niche_id where x.creator_id = c.id),
    'categories', (select coalesce(jsonb_agg(n.label order by n.sort), '[]'::jsonb)
                   from public.creator_categories x join public.content_categories n on n.id = x.category_id where x.creator_id = c.id),
    'industries', (select coalesce(jsonb_agg(n.label order by n.sort), '[]'::jsonb)
                   from public.creator_industries x join public.industries n on n.id = x.industry_id where x.creator_id = c.id),
    'support_types', (select coalesce(jsonb_agg(n.label order by n.sort), '[]'::jsonb)
                      from public.creator_support_types x join public.support_types n on n.id = x.support_type_id where x.creator_id = c.id),
    'social_accounts', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'platform', pl.label,
          'platform_key', pl.key,
          'handle', case when ps.social_links = 'public' then sa.handle end,
          'url', case when ps.social_links = 'public' then sa.url end,
          'is_primary', sa.is_primary,
          'followers', case when ps.follower_counts = 'public' then s.followers end,
          'engagement_rate', case when ps.engagement = 'public' then s.engagement_rate end,
          'avg_views', case when ps.engagement = 'public' then s.avg_views end,
          'avg_likes', case when ps.engagement = 'public' then s.avg_likes end,
          'growth_30d_pct', case when ps.growth = 'public' then s.growth_30d_pct end,
          'source', s.source,
          'captured_at', s.captured_at,
          'demographics', case when ps.demographics = 'public' and s.id is not null then (
              select coalesce(jsonb_agg(jsonb_build_object('dimension', d.dimension, 'bucket', d.bucket, 'pct', d.pct)
                                        order by d.dimension, d.pct desc), '[]'::jsonb)
              from public.audience_demographics d where d.snapshot_id = s.id) end
        ) order by sa.is_primary desc, s.followers desc nulls last, pl.sort), '[]'::jsonb)
      from public.social_accounts sa
      join public.platforms pl on pl.id = sa.platform_id
      left join lateral (
        select x.* from public.analytics_snapshots x
        where x.social_account_id = sa.id
        order by x.captured_at desc, x.created_at desc
        limit 1
      ) s on true
      where sa.creator_id = c.id and sa.deleted_at is null
    ),
    'partnerships', case when ps.partnerships = 'public' then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'brand_name', b.brand_name, 'year', b.year, 'description', b.description,
          'link', b.link, 'category', cc.label
        ) order by b.year desc nulls last, b.created_at desc), '[]'::jsonb)
      from public.brand_partnerships b
      left join public.content_categories cc on cc.id = b.category_id
      where b.creator_id = c.id and b.deleted_at is null and b.visibility = 'public'
    ) else '[]'::jsonb end,
    'portfolio', case when ps.portfolio = 'public' then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'description', i.description, 'item_type', i.item_type,
          'url', i.url, 'storage_path', i.storage_path, 'is_featured', i.is_featured, 'platform', pl.label
        ) order by i.is_featured desc, i.sort, i.created_at desc), '[]'::jsonb)
      from public.portfolio_items i
      left join public.platforms pl on pl.id = i.platform_id
      where i.creator_id = c.id and i.deleted_at is null and i.visibility = 'public'
    ) else '[]'::jsonb end,
    'media_kit_path', case when ps.media_kit = 'public' then (
      select m.storage_path from public.media_kits m
      where m.creator_id = c.id and m.is_current and m.storage_path is not null
      limit 1
    ) end
  );
end;
$$;

-- ---------- Public creator directory ---------------------------------------
create or replace function public.list_public_creators(
  p_q text default null,
  p_niche text default null,
  p_platform text default null,
  p_seeking boolean default null,
  p_limit integer default 24,
  p_offset integer default 0
) returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select cp.id, cp.handle, cp.display_name, cp.headline, cp.avatar_path, cp.city, cp.region, cp.country,
           cp.seeking_management, cp.completeness_pct, cp.created_at,
           (cp.is_featured and (cp.featured_until is null or cp.featured_until > now())) as featured,
           ps.location as v_location, ps.follower_counts as v_followers
    from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
      and p.status = 'active' and p.deleted_at is null and p.account_type = 'creator'
    join public.creator_privacy_settings ps on ps.creator_id = cp.id
    where cp.is_discoverable and cp.deleted_at is null and cp.handle is not null
      and (p_q is null or btrim(p_q) = ''
           or cp.display_name ilike '%' || btrim(p_q) || '%'
           or cp.handle ilike '%' || btrim(p_q) || '%'
           or cp.headline ilike '%' || btrim(p_q) || '%')
      and (p_niche is null or p_niche = '' or exists (
            select 1 from public.creator_niches cn join public.niches n on n.id = cn.niche_id
            where cn.creator_id = cp.id and n.key = p_niche))
      and (p_platform is null or p_platform = '' or exists (
            select 1 from public.social_accounts sa join public.platforms pl on pl.id = sa.platform_id
            where sa.creator_id = cp.id and sa.deleted_at is null and pl.key = p_platform))
      and (p_seeking is null or cp.seeking_management = p_seeking)
  ),
  page as (
    select b.*, row_number() over (order by b.featured desc, b.completeness_pct desc, b.created_at desc) as rn
    from base b
    order by b.featured desc, b.completeness_pct desc, b.created_at desc
    limit least(greatest(coalesce(p_limit, 24), 1), 48)
    offset least(greatest(coalesce(p_offset, 0), 0), 2000)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'handle', pg.handle,
          'display_name', pg.display_name,
          'headline', pg.headline,
          'avatar_path', pg.avatar_path,
          'location', case when pg.v_location = 'public'
                           then jsonb_build_object('city', pg.city, 'region', pg.region, 'country', pg.country) end,
          'seeking_management', pg.seeking_management,
          'is_featured', pg.featured,
          'niches', (select coalesce(jsonb_agg(n.label order by n.sort), '[]'::jsonb)
                     from (select n2.label, n2.sort from public.creator_niches cn
                           join public.niches n2 on n2.id = cn.niche_id
                           where cn.creator_id = pg.id order by n2.sort limit 3) n),
          'top_account', (
            select jsonb_build_object(
                'platform', pl.label, 'platform_key', pl.key,
                'followers', case when pg.v_followers = 'public' then s.followers end,
                'source', s.source)
            from public.social_accounts sa
            join public.platforms pl on pl.id = sa.platform_id
            left join lateral (
              select x.followers, x.source from public.analytics_snapshots x
              where x.social_account_id = sa.id order by x.captured_at desc, x.created_at desc limit 1
            ) s on true
            where sa.creator_id = pg.id and sa.deleted_at is null
            order by sa.is_primary desc, s.followers desc nulls last
            limit 1)
        ) order by pg.rn)
      from page pg), '[]'::jsonb)
  );
$$;

-- ---------- Profile view counter --------------------------------------------
create or replace function public.record_creator_profile_view(p_creator_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.creator_profiles where id = p_creator_id and user_id = auth.uid()) then
    return; -- creators viewing their own page don't count
  end if;
  if not exists (select 1 from public.creator_profiles
                 where id = p_creator_id and is_discoverable and deleted_at is null) then
    return;
  end if;
  insert into public.creator_profile_views (creator_id, viewer_user_id, company_id)
  values (p_creator_id, auth.uid(), (select m.company_id from public.company_members m
                                     where m.user_id = auth.uid() and m.status = 'active' limit 1));
  update public.creator_profiles set profile_views_count = profile_views_count + 1 where id = p_creator_id;
end;
$$;

-- ---------- Function privileges ------------------------------------------------
revoke execute on function
  public.request_verification(uuid),
  public.get_public_creator_profile(text),
  public.list_public_creators(text, text, text, boolean, integer, integer),
  public.record_creator_profile_view(uuid)
from public, anon, authenticated;

grant execute on function public.request_verification(uuid) to authenticated;
grant execute on function
  public.get_public_creator_profile(text),
  public.list_public_creators(text, text, text, boolean, integer, integer),
  public.record_creator_profile_view(uuid)
to anon, authenticated;
