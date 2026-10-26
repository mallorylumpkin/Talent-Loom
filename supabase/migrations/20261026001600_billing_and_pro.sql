-- =====================================================================
-- TalentLoom · 1600 · Phase 6: billing (Stripe)
--  - server-only functions the Stripe webhook uses to record
--    subscriptions and invoices (idempotent per Stripe event)
--  - contact credits extend a company's monthly contact allowance
--  - revenue metrics for admins
--  - public company directory switch (platform setting)
-- =====================================================================

create unique index if not exists billing_events_event_key on public.billing_events (stripe_event_id);

-- ---------- Contact credits -------------------------------------------
create or replace function private.contact_credit_balance(p_company_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.delta), 0)::integer from public.contact_credit_ledger l
  where l.company_id = p_company_id and (l.expires_at is null or l.expires_at > now() or l.delta < 0);
$$;
grant execute on function private.contact_credit_balance(uuid) to authenticated, service_role;

create or replace function public.company_credit_balance(p_company_id uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.is_company_member(p_company_id) or private.is_super_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return private.contact_credit_balance(p_company_id);
end;
$$;
revoke execute on function public.company_credit_balance(uuid) from public, anon;
grant execute on function public.company_credit_balance(uuid) to authenticated;

create or replace function public.send_inquiry(p_company_id uuid, p_creator_id uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_company record;
  v_creator_user uuid;
  v_declined_at timestamptz;
  v_limit integer;
  v_used integer;
  v_conv uuid;
  v_id uuid;
begin
  if v_uid is null or not private.is_active_user() then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  if not private.has_company_permission(p_company_id, 'inquiries.send') then
    raise exception 'Your role doesn''t include sending inquiries.' using errcode = '42501';
  end if;
  select c.name, c.status, c.outreach_frozen into v_company from public.companies c
  where c.id = p_company_id and c.deleted_at is null;
  if v_company.status is distinct from 'approved' then
    raise exception 'TalentLoom needs to approve your company before you can contact creators.' using errcode = 'P0001';
  end if;
  if v_company.outreach_frozen then
    raise exception 'Outreach is paused for your company. Please contact TalentLoom support.' using errcode = 'P0001';
  end if;
  if not private.creator_is_reachable(p_creator_id) or private.is_blocked(p_creator_id, p_company_id) then
    raise exception 'This creator isn''t accepting inquiries right now.' using errcode = 'P0001';
  end if;
  if char_length(v_subject) not between 3 and 120 then
    raise exception 'Add a subject (3–120 characters).' using errcode = 'P0001';
  end if;
  if char_length(v_body) not between 20 and 4000 then
    raise exception 'Write a message of at least 20 characters (up to 4,000).' using errcode = 'P0001';
  end if;
  if not private.check_rate_limit('inquiry:' || v_uid, interval '1 hour', 20) then
    raise exception 'You''ve sent a lot of inquiries in the last hour. Please try again later.' using errcode = 'P0001';
  end if;

  -- One inquiry at a time per company, so the monthly limit can't be raced.
  perform pg_advisory_xact_lock(hashtextextended('inquiry:' || p_company_id::text, 0));

  if exists (select 1 from public.representation_inquiries i
             where i.company_id = p_company_id and i.creator_id = p_creator_id and i.status in ('sent', 'viewed')) then
    raise exception 'You already have an open inquiry with this creator.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.conversations c
             where c.company_id = p_company_id and c.creator_id = p_creator_id and c.status = 'open') then
    raise exception 'You''re already talking with this creator. Continue in Messages.' using errcode = 'P0001';
  end if;
  select max(i.responded_at) into v_declined_at from public.representation_inquiries i
  where i.company_id = p_company_id and i.creator_id = p_creator_id and i.status = 'declined';
  if v_declined_at > now() - interval '30 days' then
    raise exception 'This creator declined recently. You can contact them again after %.',
      to_char(v_declined_at + interval '30 days', 'FMMonth FMDD') using errcode = 'P0001';
  end if;

  v_limit := private.feature_limit('company', p_company_id, 'contacts.monthly');
  if v_limit is not null then
    select count(distinct i.creator_id) into v_used from public.representation_inquiries i
    where i.company_id = p_company_id and i.created_at >= date_trunc('month', now())
      and i.creator_id <> p_creator_id;
    if v_used >= v_limit then
      -- Over the plan's monthly allowance: use a purchased / granted contact credit if there is one.
      if private.contact_credit_balance(p_company_id) > 0 then
        insert into public.contact_credit_ledger (company_id, delta, reason, source, created_by)
        values (p_company_id, -1, 'Inquiry to creator ' || p_creator_id, 'usage', v_uid);
      else
        raise exception 'Your plan allows contacting % new creator(s) per month, and you''ve reached it. Contact TalentLoom to add contact credits or upgrade.', v_limit
          using errcode = 'P0001', hint = 'plan_limit:contacts.monthly';
      end if;
    end if;
  end if;

  insert into public.conversations (company_id, creator_id, status)
  values (p_company_id, p_creator_id, 'pending')
  on conflict (company_id, creator_id) do update set status = 'pending'
  returning id into v_conv;

  insert into public.representation_inquiries (company_id, creator_id, sender_user_id, conversation_id, subject, body)
  values (p_company_id, p_creator_id, v_uid, v_conv, v_subject, v_body)
  returning id into v_id;

  select cp.user_id into v_creator_user from public.creator_profiles cp where cp.id = p_creator_id;
  perform private.notify(v_creator_user, 'inquiry.new', v_company.name || ' sent you a representation inquiry',
                         '/creator/inquiries/' || v_id, jsonb_build_object('inquiry_id', v_id));
  perform private.pipeline_advance(p_company_id, p_creator_id, 'Contacted');
  return v_id;
end;
$$;

-- ---------- Owner helpers ---------------------------------------------
-- Who should hear about billing for an owner (the user, or company members who can see billing).
create or replace function private.billing_recipients(p_owner_type public.owner_type, p_owner_id uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p_owner_id where p_owner_type = 'user'
  union
  select m.user_id from public.company_members m
  join public.company_role_permissions rp on rp.role_id = m.role_id and rp.permission_key = 'billing.view'
  where p_owner_type = 'company' and m.company_id = p_owner_id and m.status = 'active';
$$;

-- ---------- Webhook: subscriptions --------------------------------------
create or replace function public.billing_upsert_subscription(
  p_owner_type public.owner_type, p_owner_id uuid, p_stripe_subscription_id text, p_stripe_price_id text,
  p_status text, p_period_start timestamptz, p_period_end timestamptz, p_cancel_at_period_end boolean,
  p_canceled_at timestamptz, p_trial_end timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_price record;
  v_id uuid;
  v_prev_status public.subscription_status;
  v_status public.subscription_status;
  v_plan_name text;
  r uuid;
begin
  v_status := case when p_status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')
                   then p_status::public.subscription_status else 'incomplete'::public.subscription_status end;
  select pp.id, pp.plan_id, pl.name, pl.audience into v_price
  from public.plan_prices pp join public.plans pl on pl.id = pp.plan_id where pp.stripe_price_id = p_stripe_price_id;
  if v_price.id is null then
    raise exception 'Unknown Stripe price %', p_stripe_price_id using errcode = 'P0002';
  end if;
  if (v_price.audience = 'creator') <> (p_owner_type = 'user') then
    raise exception 'Plan audience does not match the owner' using errcode = '22023';
  end if;

  select status into v_prev_status from public.subscriptions where stripe_subscription_id = p_stripe_subscription_id;

  insert into public.subscriptions (owner_type, owner_id, plan_id, plan_price_id, stripe_subscription_id, status,
    collection_method, current_period_start, current_period_end, cancel_at_period_end, canceled_at, trial_end)
  values (p_owner_type, p_owner_id, v_price.plan_id, v_price.id, p_stripe_subscription_id, v_status,
    'charge_automatically', p_period_start, p_period_end, coalesce(p_cancel_at_period_end, false), p_canceled_at, p_trial_end)
  on conflict (stripe_subscription_id) do update set
    plan_id = excluded.plan_id, plan_price_id = excluded.plan_price_id, status = excluded.status,
    current_period_start = coalesce(excluded.current_period_start, public.subscriptions.current_period_start),
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end, canceled_at = excluded.canceled_at, trial_end = excluded.trial_end
  returning id into v_id;

  -- A paid plan replaces any complimentary plan the owner had.
  if v_status in ('active', 'trialing') then
    update public.subscriptions set status = 'canceled', canceled_at = now()
    where owner_type = p_owner_type and owner_id = p_owner_id and id <> v_id and stripe_subscription_id is null
      and status in ('complimentary', 'active', 'trialing');
  end if;

  if v_prev_status is distinct from v_status and v_status in ('active', 'trialing', 'canceled') then
    v_plan_name := case when v_status = 'canceled'
      then (select name from public.plans where key = case p_owner_type when 'user' then 'creator_free' else 'company_pending' end)
      else v_price.name end;
    for r in select * from private.billing_recipients(p_owner_type, p_owner_id) loop
      perform private.notify(r, 'subscription.updated', 'Your plan is now ' || v_plan_name || '.',
        case when p_owner_type = 'user' then '/creator/billing' else '/company/billing' end,
        jsonb_build_object('vars', jsonb_build_object('plan', v_plan_name)));
    end loop;
  end if;
  return v_id;
end;
$$;

-- ---------- Webhook: invoices -------------------------------------------
create or replace function public.billing_record_invoice(
  p_owner_type public.owner_type, p_owner_id uuid, p_stripe_invoice_id text, p_description text,
  p_amount_cents integer, p_currency text, p_status text, p_hosted_url text, p_pdf_url text, p_paid_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  r uuid;
  v_status text := case when p_status in ('draft', 'open', 'paid', 'uncollectible', 'void', 'failed', 'refunded') then p_status else 'open' end;
begin
  insert into public.payments (owner_type, owner_id, stripe_invoice_id, description, amount_cents, currency, status,
                               hosted_invoice_url, invoice_pdf_url, paid_at)
  values (p_owner_type, p_owner_id, p_stripe_invoice_id, left(p_description, 300), p_amount_cents, upper(left(p_currency, 3)),
          v_status, p_hosted_url, p_pdf_url, p_paid_at)
  on conflict (stripe_invoice_id) do update set
    amount_cents = excluded.amount_cents, status = excluded.status, hosted_invoice_url = excluded.hosted_invoice_url,
    invoice_pdf_url = excluded.invoice_pdf_url, paid_at = coalesce(excluded.paid_at, public.payments.paid_at);
  if v_status = 'failed' then
    for r in select * from private.billing_recipients(p_owner_type, p_owner_id) loop
      perform private.notify(r, 'payment.failed', 'Your latest payment failed. Update your card to keep your plan.',
        case when p_owner_type = 'user' then '/creator/billing' else '/company/billing' end);
    end loop;
  end if;
end;
$$;

create or replace function public.billing_notify_trial_ending(p_owner_type public.owner_type, p_owner_id uuid, p_trial_end timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r uuid;
  v_date text := to_char(p_trial_end at time zone 'UTC', 'FMMonth FMDD');
begin
  for r in select * from private.billing_recipients(p_owner_type, p_owner_id) loop
    perform private.notify(r, 'trial.ending', 'Your trial ends on ' || v_date || '.',
      case when p_owner_type = 'user' then '/creator/billing' else '/company/billing' end,
      jsonb_build_object('vars', jsonb_build_object('date', v_date)));
  end loop;
end;
$$;

revoke execute on function
  public.billing_upsert_subscription(public.owner_type, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz),
  public.billing_record_invoice(public.owner_type, uuid, text, text, integer, text, text, text, text, timestamptz),
  public.billing_notify_trial_ending(public.owner_type, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function
  public.billing_upsert_subscription(public.owner_type, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz),
  public.billing_record_invoice(public.owner_type, uuid, text, text, integer, text, text, text, text, timestamptz),
  public.billing_notify_trial_ending(public.owner_type, uuid, timestamptz)
to service_role;

-- ---------- Admin: revenue metrics ---------------------------------------
create or replace function public.admin_revenue_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_paying integer;
  v_canceled integer;
begin
  if not private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select count(*) into v_paying from public.subscriptions where stripe_subscription_id is not null and status in ('active', 'past_due');
  select count(*) into v_canceled from public.subscriptions
  where stripe_subscription_id is not null and status = 'canceled' and canceled_at > now() - interval '30 days';
  return jsonb_build_object(
    'mrr_cents', coalesce((select sum(case pp.billing_interval when 'year' then pp.amount_cents / 12.0 else pp.amount_cents end)
                           from public.subscriptions s join public.plan_prices pp on pp.id = s.plan_price_id
                           where s.stripe_subscription_id is not null and s.status in ('active', 'past_due')), 0)::bigint,
    'paying', v_paying,
    'trialing', (select count(*) from public.subscriptions where status = 'trialing'),
    'past_due', (select count(*) from public.subscriptions where status = 'past_due'),
    'complimentary', (select count(*) from public.subscriptions where status = 'complimentary'),
    'canceled_30d', v_canceled,
    'churn_30d_pct', case when v_paying + v_canceled > 0 then round(v_canceled * 100.0 / (v_paying + v_canceled), 1) else 0 end,
    'revenue_30d_cents', coalesce((select sum(amount_cents) from public.payments where status = 'paid' and paid_at > now() - interval '30 days'), 0),
    'by_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', x.name, 'count', x.n) order by x.n desc) from (
                select pl.name, count(*) as n from public.subscriptions s join public.plans pl on pl.id = s.plan_id
                where s.status in ('active', 'trialing', 'past_due', 'complimentary') group by pl.name) x), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.admin_revenue_summary() from public, anon;
grant execute on function public.admin_revenue_summary() to authenticated;

-- ---------- Public company directory (switch: features.company_directory) -
create or replace function private.company_directory_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.platform_settings where key = 'features.company_directory'), false);
$$;

create or replace function public.get_company_profile(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'slug', c.slug, 'logo_path', c.logo_path, 'description', c.description,
    'services_description', c.services_description, 'website', c.website, 'city', c.city, 'region', c.region,
    'country', c.country, 'size_band', c.size_band, 'specialties', c.specialties,
    'is_verified_badge', c.is_verified_badge, 'approved_at', c.approved_at,
    'categories', coalesce((select jsonb_agg(cc.label order by cc.sort) from public.company_categories x
                            join public.content_categories cc on cc.id = x.category_id where x.company_id = c.id), '[]'::jsonb),
    'roster_size', (select count(*) from public.roster_members r where r.company_id = c.id and r.status = 'active'),
    'blocked', private.is_blocked(private.my_creator_id(), c.id)
  )
  from public.companies c
  where c.slug = lower(p_slug) and c.status = 'approved' and c.deleted_at is null
    and (private.company_directory_on() or (auth.uid() is not null and private.is_active_account()));
$$;

create or replace function public.list_companies(p_query text default null, p_limit integer default 60)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'logo_path', c.logo_path, 'city', c.city,
           'region', c.region, 'country', c.country, 'specialties', c.specialties, 'is_verified_badge', c.is_verified_badge)
         order by c.is_featured desc, c.name), '[]'::jsonb)
  from (select * from public.companies c
        where c.status = 'approved' and c.deleted_at is null
          and (p_query is null or c.name ilike '%' || left(p_query, 60) || '%')
        order by c.is_featured desc, c.name limit least(greatest(p_limit, 1), 100)) c
  where private.company_directory_on() or (auth.uid() is not null and private.is_active_account());
$$;
grant execute on function private.company_directory_on() to anon, authenticated, service_role;
grant execute on function public.get_company_profile(text), public.list_companies(text, integer) to anon, authenticated;

-- ---------- Creator insights (Creator Pro: view_insights) ----------------
create or replace function public.my_profile_insights()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_creator uuid := private.my_creator_id();
begin
  if v_creator is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not private.has_feature('user', auth.uid(), 'view_insights') then
    return jsonb_build_object('locked', true,
      'views_30d', (select count(distinct (company_id, viewed_at::date)) from public.creator_profile_views
                    where creator_id = v_creator and viewed_at > now() - interval '30 days'));
  end if;
  return jsonb_build_object(
    'locked', false,
    'views_30d', (select count(distinct (company_id, viewed_at::date)) from public.creator_profile_views
                  where creator_id = v_creator and viewed_at > now() - interval '30 days'),
    'viewers', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'slug', x.slug, 'last', x.last) order by x.last desc)
                from (select c.name, c.slug, max(v.viewed_at) as last from public.creator_profile_views v
                      join public.companies c on c.id = v.company_id and c.status = 'approved'
                      where v.creator_id = v_creator and v.viewed_at > now() - interval '90 days'
                      group by c.name, c.slug order by max(v.viewed_at) desc limit 20) x), '[]'::jsonb),
    'savers', coalesce((select jsonb_agg(distinct jsonb_build_object('name', c.name, 'slug', c.slug))
                from public.talent_list_members m join public.talent_lists l on l.id = m.list_id
                join public.companies c on c.id = l.company_id and c.status = 'approved'
                where m.creator_id = v_creator and not l.is_private), '[]'::jsonb),
    'inquiries_total', (select count(*) from public.representation_inquiries where creator_id = v_creator)
  );
end;
$$;
revoke execute on function public.my_profile_insights() from public, anon;
grant execute on function public.my_profile_insights() to authenticated;

-- ---------- Company reports (company_analytics) ----------------------------
create or replace function public.company_report(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_company_permission(p_company_id, 'analytics.view') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not private.has_feature('company', p_company_id, 'company_analytics') then
    return jsonb_build_object('locked', true);
  end if;
  return jsonb_build_object(
    'locked', false,
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', m.month, 'sent', m.sent, 'accepted', m.accepted) order by m.month)
               from (select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*) as sent,
                            count(*) filter (where status = 'accepted') as accepted
                     from public.representation_inquiries where company_id = p_company_id and created_at > now() - interval '12 months'
                     group by 1) m), '[]'::jsonb),
    'stages', coalesce((select jsonb_agg(jsonb_build_object('stage', s.name, 'kind', s.kind, 'count', s.n) order by s.position)
               from (select st.name, st.kind, st.position, count(e.id) as n from public.pipelines p
                     join public.pipeline_stages st on st.pipeline_id = p.id
                     left join public.pipeline_entries e on e.stage_id = st.id
                     where p.company_id = p_company_id and p.is_default group by st.name, st.kind, st.position) s), '[]'::jsonb),
    'team', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'inquiries', t.n) order by t.n desc)
               from (select coalesce(pr.display_name, pr.email) as name, count(*) as n from public.representation_inquiries i
                     join public.profiles pr on pr.id = i.sender_user_id
                     where i.company_id = p_company_id and i.created_at > now() - interval '90 days' group by 1) t), '[]'::jsonb),
    'roster_active', (select count(*) from public.roster_members where company_id = p_company_id and status = 'active'),
    'views_30d', (select count(*) from public.creator_profile_views where company_id = p_company_id and viewed_at > now() - interval '30 days')
  );
end;
$$;
revoke execute on function public.company_report(uuid) from public, anon;
grant execute on function public.company_report(uuid) to authenticated;
