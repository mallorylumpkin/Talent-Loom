-- =====================================================================
-- TalentLoom · 1500 · Phase 5: admin console
--  - read-only, audited impersonation (enforced in the database)
--  - admin functions: user status / roles, verification review, notices
--  - notification templates actually drive in-app notification text
--  - platform settings actually drive outreach and message limits
--  - support requests notify both sides
-- =====================================================================

-- ---------- Settings helper -------------------------------------------
create or replace function private.setting_int(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select case when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::integer end
                   from public.platform_settings s where s.key = p_key), p_default);
$$;

-- ---------- Impersonation ---------------------------------------------
-- The impersonated browser session is identified by its Supabase session id
-- (JWT claim "session_id"). That session is READ-ONLY forever: every write
-- policy and function that checks is_active_user() refuses it.
alter table public.impersonation_sessions add column auth_session_id uuid;
create index impersonation_sessions_auth_session_idx on public.impersonation_sessions (auth_session_id);

create or replace function private.is_impersonated_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'session_id', '') <> '' and exists (
    select 1 from public.impersonation_sessions s
    where s.target_user_id = auth.uid()
      and s.auth_session_id::text = auth.jwt() ->> 'session_id'
  );
$$;

-- Account is active (ignores impersonation) — for READ checks.
create or replace function private.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null
  );
$$;

-- Used by every WRITE path: active account AND not an impersonation session.
create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_account() and not private.is_impersonated_session();
$$;

-- Read permissions keep working while impersonating; everything else is blocked.
create or replace function private.has_company_permission(p_company_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (case when p_permission in ('inquiries.view', 'messages.view', 'talent.search', 'billing.view', 'analytics.view')
               then private.is_active_account() else private.is_active_user() end)
    and exists (
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
    and auth.uid() is not null and private.is_active_account();
$$;

-- Audit entries made during impersonation record the admin behind it.
create or replace function private.write_audit(
  p_action text, p_target_type text, p_target_id text,
  p_before jsonb default null, p_after jsonb default null, p_metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_impersonator uuid;
begin
  if coalesce(auth.jwt() ->> 'session_id', '') <> '' then
    select s.admin_id into v_impersonator from public.impersonation_sessions s
    where s.target_user_id = auth.uid() and s.auth_session_id::text = auth.jwt() ->> 'session_id'
    order by s.started_at desc limit 1;
  end if;
  insert into public.audit_logs (actor_id, actor_email, impersonator_id, action, target_type, target_id, before, after, metadata)
  values (
    auth.uid(),
    (select p.email from public.profiles p where p.id = auth.uid()),
    v_impersonator,
    p_action, p_target_type, p_target_id, p_before, p_after, coalesce(p_metadata, '{}')
  );
end;
$$;

-- Server-only: record the start / end of an impersonation (called with the service role
-- after the app has verified the caller is an MFA-verified super admin).
create or replace function public.record_impersonation_start(
  p_admin_id uuid, p_target_user_id uuid, p_reason text, p_auth_session_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_admin_email text;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and account_type = 'super_admin' and status = 'active') then
    raise exception 'Only super admins can impersonate' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = p_target_user_id and account_type = 'super_admin') then
    raise exception 'Admins cannot be impersonated' using errcode = '42501';
  end if;
  insert into public.impersonation_sessions (admin_id, target_user_id, reason, auth_session_id)
  values (p_admin_id, p_target_user_id, left(btrim(p_reason), 500), p_auth_session_id)
  returning id into v_id;
  select email into v_admin_email from public.profiles where id = p_admin_id;
  insert into public.audit_logs (actor_id, actor_email, action, target_type, target_id, after, metadata)
  values (p_admin_id, v_admin_email, 'impersonation.start', 'profiles', p_target_user_id::text,
          jsonb_build_object('reason', left(btrim(p_reason), 500), 'session', v_id), jsonb_build_object('read_only', true));
  return v_id;
end;
$$;

create or replace function public.record_impersonation_end(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
begin
  update public.impersonation_sessions set ended_at = coalesce(ended_at, now())
  where id = p_session_id returning * into v_s;
  if v_s.id is null then return; end if;
  insert into public.audit_logs (actor_id, actor_email, action, target_type, target_id, after)
  values (v_s.admin_id, (select email from public.profiles where id = v_s.admin_id), 'impersonation.end', 'profiles',
          v_s.target_user_id::text, jsonb_build_object('session', v_s.id, 'duration_seconds',
          extract(epoch from (v_s.ended_at - v_s.started_at))::integer));
end;
$$;

revoke execute on function public.record_impersonation_start(uuid, uuid, text, uuid), public.record_impersonation_end(uuid)
  from public, anon, authenticated;
grant execute on function public.record_impersonation_start(uuid, uuid, text, uuid), public.record_impersonation_end(uuid)
  to service_role;
grant execute on function private.is_impersonated_session(), private.is_active_account(), private.setting_int(text, integer)
  to anon, authenticated, service_role;

-- ---------- Notification templates drive the text -----------------------
-- Values for {{placeholders}}, worked out from what the notification is about.
create or replace function private.notification_vars(p_type text, p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_inquiry uuid := nullif(p_payload ->> 'inquiry_id', '')::uuid;
  v_conv uuid := nullif(p_payload ->> 'conversation_id', '')::uuid;
  v_company text;
  v_creator text;
  v_sender text;
begin
  if v_inquiry is not null then
    select co.name, coalesce(cp.display_name, cp.handle, 'A creator') into v_company, v_creator
    from public.representation_inquiries i
    join public.companies co on co.id = i.company_id
    join public.creator_profiles cp on cp.id = i.creator_id
    where i.id = v_inquiry;
  elsif v_conv is not null then
    select co.name, coalesce(cp.display_name, cp.handle, 'A creator'),
           (select case when m.sender_user_id = cp.user_id then coalesce(cp.display_name, cp.handle, 'A creator') else co.name end
            from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1)
    into v_company, v_creator, v_sender
    from public.conversations c
    join public.companies co on co.id = c.company_id
    join public.creator_profiles cp on cp.id = c.creator_id
    where c.id = v_conv;
  end if;
  return jsonb_strip_nulls(jsonb_build_object('company', v_company, 'creator', v_creator, 'sender', v_sender))
         || coalesce(p_payload -> 'vars', '{}'::jsonb);
end;
$$;

create or replace function private.notify(p_user_id uuid, p_type text, p_title text, p_link text, p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tpl record;
  v_title text := p_title;
  v_vars jsonb;
  k text;
begin
  if p_user_id is null or p_link not like '/%' then return; end if;
  select t.body, t.enabled into v_tpl from public.notification_templates t
  where t.key = p_type and t.channel = 'in_app';
  if found then
    if not v_tpl.enabled then return; end if;
    v_vars := private.notification_vars(p_type, p_payload);
    v_title := v_tpl.body;
    for k in select jsonb_object_keys(v_vars) loop
      v_title := replace(v_title, '{{' || k || '}}', coalesce(v_vars ->> k, ''));
    end loop;
    if v_title ~ '\{\{[a-z_]+\}\}' then v_title := p_title; end if;  -- unknown placeholder: use the built-in wording
  end if;
  insert into public.notifications (user_id, type, title, link, payload)
  values (p_user_id, p_type, left(v_title, 200), p_link, coalesce(p_payload, '{}'));
end;
$$;
revoke execute on function private.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Saved-profile alert now goes through templates too.
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
    perform private.notify(v_user, 'creator.saved', 'A management company saved your profile', '/creator');
  end if;
  return new;
end;
$$;

-- Admin-triggered notices (company review decisions, etc.).
create or replace function public.admin_notify(p_user_id uuid, p_type text, p_fallback_title text, p_link text, p_vars jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  perform private.notify(p_user_id, p_type, p_fallback_title, p_link, jsonb_build_object('vars', coalesce(p_vars, '{}'::jsonb)));
end;
$$;

insert into public.notification_templates (key, channel, subject, body) values
  ('support.reply',       'in_app', null, 'TalentLoom support replied to “{{subject}}”.'),
  ('support.new',         'in_app', null, 'New support request: {{subject}}'),
  ('analytics.connected', 'in_app', null, 'Your {{platform}} numbers are now verified through your connected account.')
on conflict (key, channel) do nothing;

-- ---------- Settings drive limits -----------------------------------------
create or replace function private.message_rate_ok()
returns boolean language sql security definer set search_path = '' as $$
  select private.check_rate_limit('message:' || auth.uid(), interval '1 minute',
                                  private.setting_int('messages.max_per_minute', 20));
$$;

-- Per-company outreach caps, on top of plan limits.
create or replace function private.enforce_outreach_caps()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_hour integer := private.setting_int('outreach.max_inquiries_per_hour', 10);
  v_day integer := private.setting_int('outreach.max_inquiries_per_day', 40);
begin
  if (select count(*) from public.representation_inquiries i
      where i.company_id = new.company_id and i.created_at > now() - interval '1 hour') >= v_hour then
    raise exception 'Your company has reached its limit of % inquiries per hour. Please try again later.', v_hour using errcode = 'P0001';
  end if;
  if (select count(*) from public.representation_inquiries i
      where i.company_id = new.company_id and i.created_at > now() - interval '1 day') >= v_day then
    raise exception 'Your company has reached its limit of % inquiries per day. Please try again tomorrow.', v_day using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger inquiries_outreach_caps before insert on public.representation_inquiries
  for each row execute function private.enforce_outreach_caps();

-- ---------- Admin: users -------------------------------------------------
create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You can''t change your own account status.' using errcode = 'P0001'; end if;
  if p_status = 'suspended' and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Add a reason (at least 5 characters). The user won''t see internal notes, only that they''re suspended.'
      using errcode = 'P0001';
  end if;
  update public.profiles
     set status = p_status,
         suspended_reason = case when p_status = 'suspended' then left(btrim(p_reason), 500) else null end,
         deleted_at = case when p_status = 'deleted' then coalesce(deleted_at, now()) else null end
   where id = p_user_id;
  if p_status <> 'active' then
    update public.creator_profiles set is_discoverable = false where user_id = p_user_id and is_discoverable;
  end if;
  if p_status = 'deleted' then
    update public.creator_profiles set deleted_at = coalesce(deleted_at, now()) where user_id = p_user_id;
    update public.company_members set status = 'removed' where user_id = p_user_id;
  elsif p_status = 'active' then
    update public.creator_profiles set deleted_at = null where user_id = p_user_id;
  end if;
end;
$$;

-- Make or remove a super admin. There must always be at least one.
create or replace function public.admin_set_super_admin(p_user_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_type public.account_type;
begin
  if not private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You can''t change your own role.' using errcode = 'P0001'; end if;
  select account_type into v_type from public.profiles where id = p_user_id and deleted_at is null and status = 'active';
  if v_type is null then raise exception 'Only active accounts can change role.' using errcode = 'P0001'; end if;

  if p_on then
    if v_type = 'super_admin' then return; end if;
    update public.creator_profiles set is_discoverable = false where user_id = p_user_id;
    update public.company_members set status = 'removed' where user_id = p_user_id and status = 'active';
    update public.profiles set account_type = 'super_admin' where id = p_user_id;
  else
    if v_type <> 'super_admin' then return; end if;
    if (select count(*) from public.profiles where account_type = 'super_admin' and status = 'active' and deleted_at is null) <= 1 then
      raise exception 'There must always be at least one super admin.' using errcode = 'P0001';
    end if;
    update public.profiles
       set account_type = case when exists (select 1 from public.creator_profiles where user_id = p_user_id)
                               then 'creator'::public.account_type else 'company_member'::public.account_type end
     where id = p_user_id;
  end if;
end;
$$;

-- ---------- Admin: verification -----------------------------------------
create or replace function public.admin_review_verification(p_request_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req record;
  v_user uuid;
  v_platform text;
begin
  if not private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into v_req from public.verification_requests where id = p_request_id for update;
  if v_req.id is null or v_req.subject_type <> 'analytics' then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then raise exception 'This request was already decided.' using errcode = 'P0001'; end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tell the creator why (at least 5 characters) so they can fix it.' using errcode = 'P0001';
  end if;

  update public.verification_requests
     set status = case when p_approve then 'verified'::public.verification_status else 'rejected'::public.verification_status end,
         reviewer_id = auth.uid(), decision_notes = nullif(left(btrim(coalesce(p_note, '')), 1000), ''), decided_at = now()
   where id = v_req.id;

  if p_approve then
    update public.analytics_snapshots
       set source = 'admin_verified', verification_status = 'verified', verified_by = auth.uid(), verified_at = now()
     where id = v_req.subject_id;
  else
    update public.analytics_snapshots set verification_status = 'rejected' where id = v_req.subject_id;
  end if;

  select cp.user_id, pl.label into v_user, v_platform
  from public.analytics_snapshots s
  join public.social_accounts sa on sa.id = s.social_account_id
  join public.platforms pl on pl.id = sa.platform_id
  join public.creator_profiles cp on cp.id = sa.creator_id
  where s.id = v_req.subject_id;

  perform private.notify(v_user,
    case when p_approve then 'verification.approved' else 'verification.rejected' end,
    case when p_approve then 'Your ' || v_platform || ' numbers are now verified.'
         else 'Your verification request for ' || v_platform || ' was not approved.' end,
    '/creator/analytics', jsonb_build_object('vars', jsonb_build_object('platform', v_platform)));
end;
$$;

-- ---------- Admin: explicit audit entries (exports, file views) -------
create or replace function public.admin_log(p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_action !~ '^[a-z_]+\.[a-z_]+$' then raise exception 'Invalid action' using errcode = '22023'; end if;
  perform private.write_audit(p_action, p_target_type, p_target_id, null, null, coalesce(p_metadata, '{}'));
end;
$$;

-- ---------- Support --------------------------------------------------------
-- Users open a request with their first message in one step.
create or replace function public.open_support_request(p_subject text, p_category text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not private.is_active_user() then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_subject, ''))) not between 3 and 150 then
    raise exception 'Add a subject (3–150 characters).' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 5000 then
    raise exception 'Describe the issue in at least 10 characters.' using errcode = 'P0001';
  end if;
  if not private.check_rate_limit('support:' || auth.uid(), interval '1 hour', 5) then
    raise exception 'You''ve opened several requests recently. Please add to an existing one.' using errcode = 'P0001';
  end if;
  insert into public.support_requests (requester_id, subject, category)
  values (auth.uid(), btrim(p_subject),
          case when p_category in ('general', 'account', 'billing', 'verification', 'safety', 'bug', 'data_request') then p_category else 'general' end)
  returning id into v_id;
  insert into public.support_messages (request_id, author_id, body) values (v_id, auth.uid(), btrim(p_body));
  return v_id;
end;
$$;

create or replace function private.after_support_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_req record;
begin
  select * into v_req from public.support_requests where id = new.request_id;
  update public.support_requests set updated_at = now(),
    status = case when new.author_id = v_req.requester_id then
                    case when status in ('resolved', 'pending') then 'open' else status end
                  when not new.is_internal then 'pending' else status end
  where id = new.request_id;
  if new.author_id is distinct from v_req.requester_id and not new.is_internal then
    perform private.notify(v_req.requester_id, 'support.reply', 'TalentLoom support replied to your request.',
      case when exists (select 1 from public.creator_profiles cp where cp.user_id = v_req.requester_id)
           then '/creator/support/' else '/company/support/' end || v_req.id,
      jsonb_build_object('vars', jsonb_build_object('subject', v_req.subject), 'request_id', v_req.id));
  end if;
  return new;
end;
$$;
create trigger support_messages_after after insert on public.support_messages
  for each row execute function private.after_support_message();

-- ---------- Admin overview numbers -----------------------------------------
create or replace function public.admin_activity_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'signups_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'inquiries_7d', (select count(*) from public.representation_inquiries where created_at > now() - interval '7 days'),
    'accepted_7d', (select count(*) from public.representation_inquiries where status = 'accepted' and responded_at > now() - interval '7 days'),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'connected_accounts', (select count(*) from public.social_connections where status = 'active'),
    'open_support', (select count(*) from public.support_requests where status in ('open', 'pending')),
    'blocks_7d', (select count(*) from public.user_blocks where created_at > now() - interval '7 days')
  );
end;
$$;

-- ---------- Privileges --------------------------------------------------
revoke execute on function
  public.admin_notify(uuid, text, text, text, jsonb), public.admin_set_user_status(uuid, public.account_status, text),
  public.admin_set_super_admin(uuid, boolean), public.admin_review_verification(uuid, boolean, text),
  public.admin_log(text, text, text, jsonb), public.open_support_request(text, text, text), public.admin_activity_summary()
from public, anon;
grant execute on function
  public.admin_notify(uuid, text, text, text, jsonb), public.admin_set_user_status(uuid, public.account_status, text),
  public.admin_set_super_admin(uuid, boolean), public.admin_review_verification(uuid, boolean, text),
  public.admin_log(text, text, text, jsonb), public.open_support_request(text, text, text), public.admin_activity_summary()
to authenticated;

-- Audit support decisions and settings edits that weren't already covered.
create trigger audit_support_requests after update of status, assigned_admin_id on public.support_requests
  for each row execute function private.audit_row_change();
create trigger audit_notification_templates after update on public.notification_templates
  for each row execute function private.audit_row_change();
create trigger audit_taxonomy_niches after insert or update or delete on public.niches
  for each row execute function private.audit_row_change();
create trigger audit_taxonomy_categories after insert or update or delete on public.content_categories
  for each row execute function private.audit_row_change();
create trigger audit_taxonomy_platforms after insert or update or delete on public.platforms
  for each row execute function private.audit_row_change();

-- Friendlier wording for verification notices (only if still the original text).
update public.notification_templates set body = 'Your {{platform}} numbers are now verified by TalentLoom.'
where key = 'verification.approved' and body = 'Your analytics for {{platform}} are now admin-verified.';

-- Viewing as a user must not change their read/unread state either.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_view_conversation(p_conversation_id) or private.is_impersonated_session() then return; end if;
  insert into public.conversation_participants (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and type = 'message.new'
    and payload ->> 'conversation_id' = p_conversation_id::text;
end;
$$;

create or replace function public.mark_inquiry_viewed(p_inquiry_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.representation_inquiries set status = 'viewed'
  where id = p_inquiry_id and status = 'sent' and creator_id = private.my_creator_id()
    and not private.is_impersonated_session();
$$;

drop policy notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid() and not private.is_impersonated_session())
  with check (user_id = auth.uid());
drop policy notifications_own_delete on public.notifications;
create policy notifications_own_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid() and not private.is_impersonated_session());
drop policy participants_own on public.conversation_participants;
create policy participants_own_select on public.conversation_participants for select to authenticated
  using (user_id = auth.uid() and private.can_view_conversation(conversation_id));
create policy participants_own_write on public.conversation_participants for insert to authenticated
  with check (user_id = auth.uid() and private.can_view_conversation(conversation_id) and private.is_active_user());
create policy participants_own_update on public.conversation_participants for update to authenticated
  using (user_id = auth.uid() and private.can_view_conversation(conversation_id) and private.is_active_user())
  with check (user_id = auth.uid());
