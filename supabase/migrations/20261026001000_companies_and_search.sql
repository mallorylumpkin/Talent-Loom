-- =====================================================================
-- TalentLoom · 1000 · Phase 3: companies, review flow, creator search
--
-- Visibility levels used below:
--   0 = public            (visitors, and companies not yet approved)
--   1 = approved company  (sees "approved companies" fields, except detailed analytics)
--   2 = approved company with "permissioned analytics" on its plan (sees everything marked for approved companies)
-- =====================================================================

-- Server-side scripts (service role) may run the one-time admin bootstrap.
grant execute on function public.bootstrap_super_admin(text) to service_role;

-- ---------- Visibility helpers --------------------------------------------
create or replace function private.vis_ok(v public.visibility, p_group text, p_level integer)
returns boolean language sql immutable set search_path = '' as $$
  select v = 'public'
      or (v = 'approved_companies'
          and (p_level >= 2 or (p_level = 1 and p_group not in ('engagement', 'growth', 'demographics'))));
$$;

-- -1 = no access to creator search for this company
create or replace function private.company_view_level(p_company_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case
    when not private.has_company_permission(p_company_id, 'talent.search') then -1
    when not private.company_is_approved(p_company_id) then 0
    when private.has_feature('company', p_company_id, 'permissioned_analytics') then 2
    else 1
  end;
$$;

grant execute on function private.vis_ok(public.visibility, text, integer), private.company_view_level(uuid)
  to authenticated, service_role;

-- ---------- Profile JSON at a given visibility level ------------------------
create or replace function private.creator_profile_json(p_creator_id uuid, p_level integer, p_owner boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  ps record;
begin
  select * into c from public.creator_profiles where id = p_creator_id;
  select * into ps from public.creator_privacy_settings where creator_id = p_creator_id;

  return jsonb_build_object(
    'id', c.id,
    'handle', c.handle,
    'display_name', c.display_name,
    'headline', c.headline,
    'avatar_path', c.avatar_path,
    'cover_path', c.cover_path,
    'bio', case when private.vis_ok(ps.bio, 'bio', p_level) then c.bio end,
    'location', case when private.vis_ok(ps.location, 'location', p_level)
                     then jsonb_build_object('city', c.city, 'region', c.region, 'country', c.country) end,
    'seeking_management', c.seeking_management,
    'representation_status', c.representation_status,
    'is_featured', c.is_featured and (c.featured_until is null or c.featured_until > now()),
    'is_discoverable', c.is_discoverable,
    'is_owner_preview', p_owner,
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
          'handle', case when private.vis_ok(ps.social_links, 'social_links', p_level) then sa.handle end,
          'url', case when private.vis_ok(ps.social_links, 'social_links', p_level) then sa.url end,
          'is_primary', sa.is_primary,
          'followers', case when private.vis_ok(ps.follower_counts, 'follower_counts', p_level) then s.followers end,
          'engagement_rate', case when private.vis_ok(ps.engagement, 'engagement', p_level) then s.engagement_rate end,
          'avg_views', case when private.vis_ok(ps.engagement, 'engagement', p_level) then s.avg_views end,
          'avg_likes', case when private.vis_ok(ps.engagement, 'engagement', p_level) then s.avg_likes end,
          'avg_comments', case when private.vis_ok(ps.engagement, 'engagement', p_level) then s.avg_comments end,
          'growth_30d_pct', case when private.vis_ok(ps.growth, 'growth', p_level) then s.growth_30d_pct end,
          'source', s.source,
          'verification_status', s.verification_status,
          'captured_at', s.captured_at,
          'demographics', case when private.vis_ok(ps.demographics, 'demographics', p_level) and s.id is not null then (
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
    'partnerships', case when private.vis_ok(ps.partnerships, 'partnerships', p_level) then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'brand_name', b.brand_name, 'year', b.year, 'description', b.description,
          'link', b.link, 'category', cc.label
        ) order by b.year desc nulls last, b.created_at desc), '[]'::jsonb)
      from public.brand_partnerships b
      left join public.content_categories cc on cc.id = b.category_id
      where b.creator_id = c.id and b.deleted_at is null and private.vis_ok(b.visibility, 'partnerships', p_level)
    ) else '[]'::jsonb end,
    'portfolio', case when private.vis_ok(ps.portfolio, 'portfolio', p_level) then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'description', i.description, 'item_type', i.item_type,
          'url', i.url, 'storage_path', i.storage_path, 'is_featured', i.is_featured, 'platform', pl.label
        ) order by i.is_featured desc, i.sort, i.created_at desc), '[]'::jsonb)
      from public.portfolio_items i
      left join public.platforms pl on pl.id = i.platform_id
      where i.creator_id = c.id and i.deleted_at is null and private.vis_ok(i.visibility, 'portfolio', p_level)
    ) else '[]'::jsonb end,
    'media_kit_path', case when private.vis_ok(ps.media_kit, 'media_kit', p_level) then (
      select m.storage_path from public.media_kits m
      where m.creator_id = c.id and m.is_current and m.storage_path is not null
      limit 1
    ) end
  );
end;
$$;

-- Public profile now delegates to the shared builder at level 0.
create or replace function public.get_public_creator_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  v_owner boolean;
begin
  select cp.id, cp.user_id, cp.is_discoverable into c
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
  return private.creator_profile_json(c.id, 0, v_owner);
end;
$$;

-- ---------- Creator details for a company ----------------------------------
create or replace function public.get_creator_for_company(p_company_id uuid, p_creator_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_level integer := private.company_view_level(p_company_id);
  v_ok boolean;
begin
  if v_level < 0 then
    raise exception 'You don''t have access to creator profiles.' using errcode = '42501';
  end if;

  select true into v_ok
  from public.creator_profiles cp
  join public.profiles p on p.id = cp.user_id
  where cp.id = p_creator_id and cp.is_discoverable and cp.deleted_at is null
    and p.status = 'active' and p.deleted_at is null and p.account_type = 'creator'
    and not private.is_blocked(cp.id, p_company_id);
  if v_ok is null then
    return null;
  end if;

  -- Count at most one view per company per creator per day.
  if not exists (
    select 1 from public.creator_profile_views v
    where v.creator_id = p_creator_id and v.company_id = p_company_id and v.viewed_at > now() - interval '1 day'
  ) then
    insert into public.creator_profile_views (creator_id, company_id, viewer_user_id)
    values (p_creator_id, p_company_id, auth.uid());
    update public.creator_profiles set profile_views_count = profile_views_count + 1 where id = p_creator_id;
  end if;

  return private.creator_profile_json(p_creator_id, v_level, false) || jsonb_build_object(
    'view_level', v_level,
    'saved_list_ids', (
      select coalesce(jsonb_agg(l.id), '[]'::jsonb)
      from public.talent_list_members m
      join public.talent_lists l on l.id = m.list_id
      where l.company_id = p_company_id and m.creator_id = p_creator_id
        and (not l.is_private or l.created_by = auth.uid())
    ),
    'completeness_pct', (select completeness_pct from public.creator_profiles where id = p_creator_id)
  );
end;
$$;

-- ---------- Creator search -------------------------------------------------
create or replace function public.search_creators(
  p_company_id uuid,
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_level integer := private.company_view_level(p_company_id);
  v_adv boolean;
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_q text := nullif(btrim(f ->> 'q'), '');
  v_ids uuid[];
  v_niches text[];
  v_cats text[];
  v_platforms text[];
  v_rep text[];
  v_country text := nullif(f ->> 'country', '');
  v_region text := nullif(btrim(f ->> 'region'), '');
  v_fmin bigint := nullif(f ->> 'followers_min', '')::bigint;
  v_fmax bigint := nullif(f ->> 'followers_max', '')::bigint;
  v_seeking boolean := nullif(f ->> 'seeking', '')::boolean;
  v_emin numeric := nullif(f ->> 'engagement_min', '')::numeric;
  v_emax numeric := nullif(f ->> 'engagement_max', '')::numeric;
  v_gmin numeric := nullif(f ->> 'growth_min', '')::numeric;
  v_verified boolean := nullif(f ->> 'verified_only', '')::boolean;
  v_active_days integer := nullif(f ->> 'active_days', '')::integer;
  v_demo_dim text := nullif(f ->> 'demo_dimension', '');
  v_demo_bucket text := nullif(f ->> 'demo_bucket', '');
  v_demo_min numeric := coalesce(nullif(f ->> 'demo_min', '')::numeric, 1);
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 1000);
  v_result jsonb;
begin
  if v_level < 0 then
    raise exception 'You don''t have access to creator search.' using errcode = '42501';
  end if;
  if not private.check_rate_limit('search:' || auth.uid(), interval '1 hour', 600) then
    raise exception 'You''ve reached the hourly search limit. Please try again shortly.' using errcode = 'P0001';
  end if;

  v_adv := private.has_feature('company', p_company_id, 'advanced_filters');
  if jsonb_typeof(f -> 'ids') = 'array' then
    v_ids := array(select x::uuid from jsonb_array_elements_text(f -> 'ids') x limit 48);
  end if;
  if jsonb_typeof(f -> 'niches') = 'array' then
    v_niches := nullif(array(select jsonb_array_elements_text(f -> 'niches')), '{}');
  end if;
  if jsonb_typeof(f -> 'categories') = 'array' then
    v_cats := nullif(array(select jsonb_array_elements_text(f -> 'categories')), '{}');
  end if;
  if jsonb_typeof(f -> 'platforms') = 'array' then
    v_platforms := nullif(array(select jsonb_array_elements_text(f -> 'platforms')), '{}');
  end if;
  if jsonb_typeof(f -> 'representation') = 'array' then
    v_rep := nullif(array(select jsonb_array_elements_text(f -> 'representation')), '{}');
  end if;
  if not v_adv then
    -- Advanced filters are a plan feature; ignore them otherwise.
    v_emin := null; v_emax := null; v_gmin := null; v_cats := null; v_verified := null;
    v_active_days := null; v_demo_dim := null;
  end if;

  with c as (
    select cp.id, cp.handle, cp.display_name, cp.headline, cp.avatar_path, cp.city, cp.region, cp.country,
           cp.seeking_management, cp.representation_status, cp.completeness_pct, cp.created_at,
           (cp.is_featured and (cp.featured_until is null or cp.featured_until > now())) as featured,
           ps.location as v_location, ps.follower_counts as v_followers, ps.engagement as v_engagement,
           ps.growth as v_growth, ps.demographics as v_demographics,
           coalesce(p.last_active_at, cp.created_at) as active_at
    from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
      and p.status = 'active' and p.deleted_at is null and p.account_type = 'creator'
    join public.creator_privacy_settings ps on ps.creator_id = cp.id
    where cp.is_discoverable and cp.deleted_at is null and cp.handle is not null
      and not private.is_blocked(cp.id, p_company_id)
      and (v_ids is null or cp.id = any (v_ids))
  ),
  acct as (
    select sa.creator_id, pl.key as platform_key, pl.label as platform, sa.is_primary,
           s.id as snapshot_id, s.followers, s.engagement_rate, s.growth_30d_pct, s.source
    from public.social_accounts sa
    join public.platforms pl on pl.id = sa.platform_id
    left join lateral (
      select x.* from public.analytics_snapshots x
      where x.social_account_id = sa.id order by x.captured_at desc, x.created_at desc limit 1
    ) s on true
    where sa.deleted_at is null and sa.creator_id in (select id from c)
  ),
  agg as (
    select c.*,
      (select array_agg(distinct a.platform_key) from acct a where a.creator_id = c.id) as platform_keys,
      (select a.platform from acct a where a.creator_id = c.id
         and (v_platforms is null or a.platform_key = any (v_platforms))
       order by a.is_primary desc, a.followers desc nulls last limit 1) as top_platform,
      case when private.vis_ok(c.v_followers, 'follower_counts', v_level) then
        (select max(a.followers) from acct a where a.creator_id = c.id
           and (v_platforms is null or a.platform_key = any (v_platforms))) end as followers,
      case when private.vis_ok(c.v_followers, 'follower_counts', v_level) then
        (select sum(a.followers) from acct a where a.creator_id = c.id) end as total_followers,
      case when private.vis_ok(c.v_engagement, 'engagement', v_level) then
        (select max(a.engagement_rate) from acct a where a.creator_id = c.id
           and (v_platforms is null or a.platform_key = any (v_platforms))) end as engagement,
      case when private.vis_ok(c.v_growth, 'growth', v_level) then
        (select max(a.growth_30d_pct) from acct a where a.creator_id = c.id
           and (v_platforms is null or a.platform_key = any (v_platforms))) end as growth,
      (select case when bool_or(a.source = 'api_verified') then 'api_verified'
                   when bool_or(a.source = 'admin_verified') then 'admin_verified'
                   when bool_or(a.source is not null) then 'self_reported' end
       from acct a where a.creator_id = c.id) as best_source
    from c
  ),
  filtered as (
    select a.* from agg a
    where (v_q is null or a.display_name ilike '%' || v_q || '%' or a.handle ilike '%' || v_q || '%'
           or a.headline ilike '%' || v_q || '%')
      and (v_niches is null or exists (
            select 1 from public.creator_niches cn join public.niches n on n.id = cn.niche_id
            where cn.creator_id = a.id and n.key = any (v_niches)))
      and (v_platforms is null or a.platform_keys && v_platforms)
      and (v_country is null or (private.vis_ok(a.v_location, 'location', v_level) and a.country = v_country))
      and (v_region is null or (private.vis_ok(a.v_location, 'location', v_level) and a.region ilike v_region))
      and (v_fmin is null or a.followers >= v_fmin)
      and (v_fmax is null or a.followers <= v_fmax)
      and (v_seeking is null or a.seeking_management = v_seeking)
      and (v_rep is null or a.representation_status::text = any (v_rep))
      and (v_emin is null or a.engagement >= v_emin)
      and (v_emax is null or a.engagement <= v_emax)
      and (v_gmin is null or a.growth >= v_gmin)
      and (v_cats is null or exists (
            select 1 from public.creator_categories cc join public.content_categories k on k.id = cc.category_id
            where cc.creator_id = a.id and k.key = any (v_cats)))
      and (v_verified is null or not v_verified or a.best_source in ('admin_verified', 'api_verified'))
      and (v_active_days is null or a.active_at > now() - make_interval(days => v_active_days))
      and (v_demo_dim is null or (
            private.vis_ok(a.v_demographics, 'demographics', v_level) and exists (
              select 1 from acct x join public.audience_demographics d on d.snapshot_id = x.snapshot_id
              where x.creator_id = a.id and d.dimension = v_demo_dim and d.bucket = v_demo_bucket and d.pct >= v_demo_min)))
  ),
  ranked as (
    select f2.*, row_number() over (order by
      case when p_sort = 'followers' then f2.followers end desc nulls last,
      case when p_sort = 'engagement' then f2.engagement end desc nulls last,
      case when p_sort = 'growth' then f2.growth end desc nulls last,
      case when p_sort = 'recent' then f2.active_at end desc nulls last,
      f2.featured desc, f2.completeness_pct desc, f2.created_at desc) as rn
    from filtered f2
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'view_level', v_level,
    'advanced_filters', v_adv,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'handle', r.handle,
          'display_name', r.display_name,
          'headline', r.headline,
          'avatar_path', r.avatar_path,
          'location', case when private.vis_ok(r.v_location, 'location', v_level)
                           then jsonb_build_object('city', r.city, 'region', r.region, 'country', r.country) end,
          'seeking_management', r.seeking_management,
          'representation_status', r.representation_status,
          'is_featured', r.featured,
          'niches', (select coalesce(jsonb_agg(t.label order by t.sort), '[]'::jsonb) from (
                       select n.label, n.sort from public.creator_niches cn join public.niches n on n.id = cn.niche_id
                       where cn.creator_id = r.id order by n.sort limit 3) t),
          'platforms', coalesce(to_jsonb(r.platform_keys), '[]'::jsonb),
          'top_platform', r.top_platform,
          'followers', r.followers,
          'total_followers', r.total_followers,
          'engagement_rate', r.engagement,
          'growth_30d_pct', r.growth,
          'source', r.best_source,
          'completeness_pct', r.completeness_pct,
          'saved', exists (
            select 1 from public.talent_list_members m join public.talent_lists l on l.id = m.list_id
            where l.company_id = p_company_id and m.creator_id = r.id
              and (not l.is_private or l.created_by = auth.uid()))
        ) order by r.rn)
      from ranked r where r.rn > v_offset and r.rn <= v_offset + v_limit
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------- Company submits its profile for review --------------------------
create or replace function public.submit_company_for_review(p_company_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_company public.companies;
begin
  if not private.has_company_permission(p_company_id, 'company.edit') then
    raise exception 'Only company owners and admins can submit for review.' using errcode = '42501';
  end if;
  select * into v_company from public.companies where id = p_company_id for update;
  if v_company.status not in ('draft', 'info_requested') then
    raise exception 'This company has already been submitted or reviewed.' using errcode = 'P0001';
  end if;
  if v_company.description is null or char_length(v_company.description) < 30 then
    raise exception 'Add a company description (at least 30 characters) before submitting.' using errcode = 'P0001';
  end if;
  update public.companies set status = 'submitted' where id = p_company_id;
  insert into public.company_applications (company_id, submitted_by, payload, status)
  values (p_company_id, auth.uid(), to_jsonb(v_company), 'submitted');
end;
$$;

-- ---------- Tell Creator Pro members when a company saves them --------------
create or replace function private.notify_creator_saved()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_company uuid;
begin
  select cp.user_id into v_user from public.creator_profiles cp where cp.id = new.creator_id;
  select l.company_id into v_company from public.talent_lists l where l.id = new.list_id;
  if private.has_feature('user', v_user, 'view_insights') and not exists (
    select 1 from public.talent_list_members m join public.talent_lists l on l.id = m.list_id
    where l.company_id = v_company and m.creator_id = new.creator_id and m.list_id <> new.list_id
  ) then
    insert into public.notifications (user_id, type, title, link)
    values (v_user, 'creator.saved', 'A management company saved your profile', '/creator');
  end if;
  return new;
end;
$$;
create trigger talent_list_members_notify after insert on public.talent_list_members
  for each row execute function private.notify_creator_saved();

-- ---------- Track activity for "recently active" ------------------------------
create or replace function public.touch_last_active()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set last_active_at = now()
  where id = auth.uid() and (last_active_at is null or last_active_at < now() - interval '1 hour');
$$;

-- ---------- Privileges ------------------------------------------------------
revoke execute on function
  public.get_creator_for_company(uuid, uuid),
  public.search_creators(uuid, jsonb, text, integer, integer),
  public.submit_company_for_review(uuid),
  public.touch_last_active()
from public, anon, authenticated;

grant execute on function
  public.get_creator_for_company(uuid, uuid),
  public.search_creators(uuid, jsonb, text, integer, integer),
  public.submit_company_for_review(uuid),
  public.touch_last_active()
to authenticated;

revoke execute on function private.creator_profile_json(uuid, integer, boolean) from public, anon, authenticated;
