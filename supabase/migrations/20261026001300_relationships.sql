-- =====================================================================
-- TalentLoom · 1300 · Phase 4: relationships
--  - representation inquiries (atomic, plan-limited, rate-limited)
--  - messaging (inbox, unread counts, notifications, block, archive)
--  - recruiting pipeline (auto-advance, history, assignments, roster)
--  - company profiles for signed-in users
-- Every rule lives in the database; the app only calls these functions.
-- =====================================================================

-- ---------- Small helpers ----------------------------------------------
-- Minimal identity for a creator a company is working with.
create or replace function private.creator_card(p_creator_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', cp.id, 'display_name', coalesce(cp.display_name, cp.handle, 'Creator'),
                            'handle', cp.handle, 'avatar_path', cp.avatar_path)
  from public.creator_profiles cp where cp.id = p_creator_id;
$$;

-- Does this company already have a relationship with the creator?
create or replace function private.company_knows_creator(p_company_id uuid, p_creator_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.representation_inquiries i where i.company_id = p_company_id and i.creator_id = p_creator_id)
      or exists (select 1 from public.pipeline_entries e join public.pipelines p on p.id = e.pipeline_id
                 where p.company_id = p_company_id and e.creator_id = p_creator_id)
      or exists (select 1 from public.roster_members r where r.company_id = p_company_id and r.creator_id = p_creator_id)
      or exists (select 1 from public.talent_list_members m join public.talent_lists l on l.id = m.list_id
                 where l.company_id = p_company_id and m.creator_id = p_creator_id);
$$;

create or replace function private.creator_is_reachable(p_creator_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creator_profiles cp join public.profiles p on p.id = cp.user_id
    where cp.id = p_creator_id and cp.deleted_at is null and cp.is_discoverable and p.status = 'active'
  );
$$;

-- Move a creator forward in the company's default pipeline (never backwards,
-- never out of Signed/Passed). Adds them if they aren't on it yet.
create or replace function private.pipeline_advance(p_company_id uuid, p_creator_id uuid, p_stage_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pipeline uuid;
  v_target record;
  v_entry record;
begin
  select id into v_pipeline from public.pipelines where company_id = p_company_id and is_default;
  if v_pipeline is null then return; end if;
  select id, position into v_target from public.pipeline_stages
  where pipeline_id = v_pipeline and name = p_stage_name and is_system;
  if v_target.id is null then return; end if;

  select e.id, s.position, s.kind into v_entry
  from public.pipeline_entries e join public.pipeline_stages s on s.id = e.stage_id
  where e.pipeline_id = v_pipeline and e.creator_id = p_creator_id;

  if v_entry.id is null then
    insert into public.pipeline_entries (pipeline_id, creator_id, stage_id) values (v_pipeline, p_creator_id, v_target.id);
  elsif v_entry.kind = 'open' and v_entry.position < v_target.position then
    update public.pipeline_entries set stage_id = v_target.id where id = v_entry.id;
  end if;
end;
$$;

-- In-app notification (link must be a site-relative path).
create or replace function private.notify(p_user_id uuid, p_type text, p_title text, p_link text, p_payload jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, link, payload)
  select p_user_id, p_type, left(p_title, 200), p_link, coalesce(p_payload, '{}')
  where p_user_id is not null and p_link like '/%';
$$;

-- ---------- Inquiries --------------------------------------------------
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
      raise exception 'Your plan allows contacting % new creator(s) per month, and you''ve reached it.', v_limit
        using errcode = 'P0001', hint = 'plan_limit:contacts.monthly';
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

create or replace function public.mark_inquiry_viewed(p_inquiry_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.representation_inquiries set status = 'viewed'
  where id = p_inquiry_id and status = 'sent' and creator_id = private.my_creator_id();
$$;

create or replace function public.respond_to_inquiry(p_inquiry_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inq record;
  v_creator_name text;
begin
  if auth.uid() is null or not private.is_active_user() then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  select * into v_inq from public.representation_inquiries
  where id = p_inquiry_id and creator_id = private.my_creator_id()
  for update;
  if v_inq.id is null then
    raise exception 'Inquiry not found' using errcode = 'P0002';
  end if;
  if v_inq.status not in ('sent', 'viewed') then
    raise exception 'This inquiry has already been answered or withdrawn.' using errcode = 'P0001';
  end if;
  select coalesce(cp.display_name, cp.handle, 'The creator') into v_creator_name
  from public.creator_profiles cp where cp.id = v_inq.creator_id;

  if p_accept then
    update public.representation_inquiries set status = 'accepted', responded_at = now() where id = v_inq.id;
    update public.conversations set status = 'open' where id = v_inq.conversation_id;
    -- The inquiry becomes the first message of the conversation (no "new message" alert for it).
    perform set_config('talentloom.quiet_messages', 'on', true);
    insert into public.messages (conversation_id, sender_user_id, body, created_at)
    values (v_inq.conversation_id, v_inq.sender_user_id, left(v_inq.subject || E'\n\n' || v_inq.body, 4000), v_inq.created_at);
    perform set_config('talentloom.quiet_messages', 'off', true);
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
    values (v_inq.conversation_id, auth.uid(), now())
    on conflict (conversation_id, user_id) do update set last_read_at = now(), archived_at = null;
    perform private.notify(v_inq.sender_user_id, 'inquiry.accepted',
      v_creator_name || ' accepted your inquiry. You can now message them.',
      '/company/messages/' || v_inq.conversation_id, jsonb_build_object('conversation_id', v_inq.conversation_id));
    perform private.pipeline_advance(v_inq.company_id, v_inq.creator_id, 'Responded');
  else
    update public.representation_inquiries set status = 'declined', responded_at = now() where id = v_inq.id;
    update public.conversations set status = 'closed' where id = v_inq.conversation_id and status = 'pending';
    perform private.notify(v_inq.sender_user_id, 'inquiry.declined', v_creator_name || ' declined your inquiry.',
      '/company/inquiries', jsonb_build_object('inquiry_id', v_inq.id));
  end if;
  return v_inq.conversation_id;
end;
$$;

create or replace function public.withdraw_inquiry(p_inquiry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_inq record;
begin
  select * into v_inq from public.representation_inquiries where id = p_inquiry_id for update;
  if v_inq.id is null or not private.has_company_permission(v_inq.company_id, 'inquiries.send') then
    raise exception 'Inquiry not found' using errcode = 'P0002';
  end if;
  if v_inq.status not in ('sent', 'viewed') then
    raise exception 'Only unanswered inquiries can be withdrawn.' using errcode = 'P0001';
  end if;
  update public.representation_inquiries set status = 'withdrawn' where id = v_inq.id;
  update public.conversations set status = 'closed' where id = v_inq.conversation_id and status = 'pending';
end;
$$;

-- Inquiries a company sent, with creator identity (respects RLS-equivalent checks).
create or replace function public.company_inquiries(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_company_permission(p_company_id, 'inquiries.view') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'subject', i.subject, 'status', i.status, 'created_at', i.created_at,
      'responded_at', i.responded_at, 'conversation_id', i.conversation_id,
      'sender', (select coalesce(p.display_name, p.email) from public.profiles p where p.id = i.sender_user_id),
      'creator', private.creator_card(i.creator_id)) order by i.created_at desc)
    from public.representation_inquiries i where i.company_id = p_company_id
  ), '[]'::jsonb);
end;
$$;

-- Inquiries a creator received, with the company's public details.
create or replace function public.my_inquiries()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'subject', i.subject, 'body', i.body, 'status', i.status, 'created_at', i.created_at,
      'responded_at', i.responded_at, 'conversation_id', i.conversation_id,
      'company', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'logo_path', c.logo_path,
                                    'city', c.city, 'region', c.region, 'country', c.country,
                                    'is_verified_badge', c.is_verified_badge, 'specialties', c.specialties))
    order by (i.status in ('sent', 'viewed')) desc, i.created_at desc), '[]'::jsonb)
  from public.representation_inquiries i
  join public.companies c on c.id = i.company_id
  where i.creator_id = private.my_creator_id() and i.status <> 'withdrawn';
$$;

-- ---------- Messaging -------------------------------------------------
-- Rate limit + keep conversation metadata and alerts in step with messages.
create or replace function private.message_rate_ok()
returns boolean language sql security definer set search_path = '' as $$
  select private.check_rate_limit('message:' || auth.uid(), interval '1 minute', 30);
$$;

create or replace function private.before_message_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.is_privileged() and current_setting('talentloom.quiet_messages', true) is distinct from 'on' then
    new.body := btrim(new.body);
    if not private.message_rate_ok() then
      raise exception 'You''re sending messages too quickly. Please wait a moment.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function private.before_message_insert();

create or replace function private.after_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_conv record;
  v_creator_user uuid;
  v_from_creator boolean;
  v_sender_label text;
  r record;
begin
  select c.*, co.name as company_name into v_conv
  from public.conversations c join public.companies co on co.id = c.company_id
  where c.id = new.conversation_id;
  update public.conversations set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
  where id = new.conversation_id;

  if new.sender_user_id is not null then
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
    values (new.conversation_id, new.sender_user_id, now())
    on conflict (conversation_id, user_id) do update set last_read_at = now();
  end if;

  if current_setting('talentloom.quiet_messages', true) = 'on' then
    return new;
  end if;

  select cp.user_id, coalesce(cp.display_name, cp.handle, 'A creator') into v_creator_user, v_sender_label
  from public.creator_profiles cp where cp.id = v_conv.creator_id;
  v_from_creator := new.sender_user_id = v_creator_user;

  -- Un-archive for everyone in the conversation when something new arrives.
  update public.conversation_participants set archived_at = null
  where conversation_id = new.conversation_id and archived_at is not null;

  for r in
    select v_creator_user as user_id where not v_from_creator
    union
    -- company people involved: inquiry senders and anyone who has written in the thread
    select i.sender_user_id from public.representation_inquiries i
    where v_from_creator and i.conversation_id = new.conversation_id and i.sender_user_id is not null
    union
    select m.sender_user_id from public.messages m
    where v_from_creator and m.conversation_id = new.conversation_id and m.sender_user_id is not null
      and m.sender_user_id <> v_creator_user
  loop
    continue when r.user_id is null or r.user_id = new.sender_user_id;
    continue when not v_from_creator and r.user_id <> v_creator_user;
    continue when v_from_creator and not private.is_company_member_user(v_conv.company_id, r.user_id);
    -- One unread alert per conversation is enough.
    continue when exists (select 1 from public.notifications n where n.user_id = r.user_id and n.type = 'message.new'
                          and n.read_at is null and n.payload ->> 'conversation_id' = new.conversation_id::text);
    perform private.notify(r.user_id, 'message.new',
      'New message from ' || case when v_from_creator then v_sender_label else v_conv.company_name end,
      case when v_from_creator then '/company/messages/' else '/creator/messages/' end || new.conversation_id,
      jsonb_build_object('conversation_id', new.conversation_id));
  end loop;
  return new;
end;
$$;

create or replace function private.is_company_member_user(p_company_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members m
                 where m.company_id = p_company_id and m.user_id = p_user_id and m.status = 'active');
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function private.after_message_insert();

-- Inbox for a creator (p_company_id null) or a company.
create or replace function public.my_inbox(p_company_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_creator uuid;
begin
  if p_company_id is null then
    v_creator := private.my_creator_id();
    if v_creator is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  elsif not private.has_company_permission(p_company_id, 'messages.view') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row order by (row ->> 'last_message_at') desc nulls last)
    from (
      select jsonb_build_object(
        'id', c.id, 'status', c.status, 'last_message_at', c.last_message_at,
        'archived', pa.archived_at is not null,
        'company', jsonb_build_object('name', co.name, 'slug', co.slug, 'logo_path', co.logo_path),
        'creator', private.creator_card(c.creator_id),
        'blocked', private.is_blocked(c.creator_id, c.company_id),
        'last', (select jsonb_build_object('body', left(m.body, 140), 'mine', m.sender_user_id = auth.uid())
                 from public.messages m where m.conversation_id = c.id and m.deleted_at is null
                 order by m.created_at desc limit 1),
        'unread', (select count(*) from public.messages m
                   where m.conversation_id = c.id and m.deleted_at is null
                     and m.sender_user_id is distinct from auth.uid()
                     and m.created_at > coalesce(pa.last_read_at, '-infinity'::timestamptz))
      ) as row
      from public.conversations c
      join public.companies co on co.id = c.company_id
      left join public.conversation_participants pa on pa.conversation_id = c.id and pa.user_id = auth.uid()
      where c.status <> 'pending'
        and ((p_company_id is null and c.creator_id = v_creator) or c.company_id = p_company_id)
        and exists (select 1 from public.messages m where m.conversation_id = c.id)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- One conversation with its messages (newest 300), for either side.
create or replace function public.get_conversation(p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_conv record;
  v_creator_user uuid;
  v_is_creator boolean;
begin
  if not private.can_view_conversation(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  select c.*, co.name as company_name, co.slug as company_slug, co.logo_path as company_logo, co.outreach_frozen
  into v_conv
  from public.conversations c join public.companies co on co.id = c.company_id where c.id = p_conversation_id;
  select cp.user_id into v_creator_user from public.creator_profiles cp where cp.id = v_conv.creator_id;
  v_is_creator := v_creator_user = auth.uid();

  return jsonb_build_object(
    'id', v_conv.id, 'status', v_conv.status, 'company_id', v_conv.company_id,
    'company', jsonb_build_object('name', v_conv.company_name, 'slug', v_conv.company_slug, 'logo_path', v_conv.company_logo),
    'creator', private.creator_card(v_conv.creator_id),
    'viewer_is_creator', v_is_creator,
    'blocked', private.is_blocked(v_conv.creator_id, v_conv.company_id),
    'can_send', v_conv.status = 'open' and not private.is_blocked(v_conv.creator_id, v_conv.company_id)
                and (v_is_creator or (private.has_company_permission(v_conv.company_id, 'messages.send')
                                      and private.company_is_approved(v_conv.company_id) and not v_conv.outreach_frozen)),
    'archived', exists (select 1 from public.conversation_participants pa where pa.conversation_id = v_conv.id
                        and pa.user_id = auth.uid() and pa.archived_at is not null),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'body', case when m.deleted_at is null then m.body else null end, 'created_at', m.created_at,
        'mine', m.sender_user_id = auth.uid(),
        'from_creator', m.sender_user_id = v_creator_user,
        'sender_name', case when m.sender_user_id = v_creator_user then null
                            else (select coalesce(p.display_name, 'Team member') from public.profiles p where p.id = m.sender_user_id) end
      ) order by m.created_at)
      from (select * from public.messages where conversation_id = v_conv.id order by created_at desc limit 300) m
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_view_conversation(p_conversation_id) then return; end if;
  insert into public.conversation_participants (conversation_id, user_id, last_read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and type = 'message.new'
    and payload ->> 'conversation_id' = p_conversation_id::text;
end;
$$;

-- Badge counts for the sidebar.
create or replace function public.my_badges(p_company_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_creator uuid := private.my_creator_id();
  v_messages integer := 0;
begin
  if p_company_id is not null and not private.has_company_permission(p_company_id, 'messages.view') then
    p_company_id := null;
    v_creator := null;
  end if;
  select count(distinct c.id) into v_messages
  from public.conversations c
  left join public.conversation_participants pa on pa.conversation_id = c.id and pa.user_id = auth.uid()
  where ((p_company_id is null and c.creator_id = v_creator) or (p_company_id is not null and c.company_id = p_company_id))
    and exists (select 1 from public.messages m where m.conversation_id = c.id and m.deleted_at is null
                and m.sender_user_id is distinct from auth.uid()
                and m.created_at > coalesce(pa.last_read_at, '-infinity'::timestamptz));
  return jsonb_build_object(
    'messages', v_messages,
    'notifications', (select count(*) from public.notifications n where n.user_id = auth.uid() and n.read_at is null),
    'inquiries', case when p_company_id is null and v_creator is not null then
      (select count(*) from public.representation_inquiries i where i.creator_id = v_creator and i.status = 'sent') else 0 end
  );
end;
$$;

-- ---------- Blocking ---------------------------------------------------
-- When a creator blocks a company: open inquiries are declined (silently) and
-- conversations are blocked. Unblocking re-opens conversations that had been accepted.
create or replace function private.on_block_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_creator uuid;
  v_row record := coalesce(new, old);
begin
  if v_row.blocked_company_id is null then return v_row; end if;
  select cp.id into v_creator from public.creator_profiles cp where cp.user_id = v_row.blocker_user_id;
  if v_creator is null then return v_row; end if;

  if tg_op = 'INSERT' then
    update public.representation_inquiries set status = 'declined', responded_at = now()
    where creator_id = v_creator and company_id = v_row.blocked_company_id and status in ('sent', 'viewed');
    update public.conversations set status = 'blocked'
    where creator_id = v_creator and company_id = v_row.blocked_company_id;
  else
    update public.conversations c
       set status = case when exists (select 1 from public.representation_inquiries i
                                      where i.conversation_id = c.id and i.status = 'accepted') then 'open'::public.conversation_status
                         else 'closed'::public.conversation_status end
     where c.creator_id = v_creator and c.company_id = v_row.blocked_company_id and c.status = 'blocked';
  end if;
  return v_row;
end;
$$;
create trigger user_blocks_change after insert or delete on public.user_blocks
  for each row execute function private.on_block_change();

-- ---------- Pipeline ---------------------------------------------------
create or replace function private.guard_pipeline_entries()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_company uuid;
begin
  if private.is_privileged() then return new; end if;
  select p.company_id into v_company from public.pipelines p where p.id = new.pipeline_id;

  if tg_op = 'INSERT' then
    if not (private.creator_is_reachable(new.creator_id) or private.company_knows_creator(v_company, new.creator_id)) then
      raise exception 'Creator not found' using errcode = 'P0002';
    end if;
  elsif new.creator_id is distinct from old.creator_id or new.pipeline_id is distinct from old.pipeline_id then
    raise exception 'Entries can''t be moved between creators or pipelines' using errcode = '42501';
  end if;

  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    if not private.has_feature('company', v_company, 'team_assignments') then
      raise exception 'Team assignments are part of the Management Agency plan.' using errcode = 'P0001',
        hint = 'plan_limit:team_assignments';
    end if;
    if not private.is_company_member_user(v_company, new.assigned_to) then
      raise exception 'You can only assign active team members.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger pipeline_entries_guard before insert or update on public.pipeline_entries
  for each row execute function private.guard_pipeline_entries();

create or replace function private.after_pipeline_entry_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.stage_kind;
  v_company uuid;
begin
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    insert into public.pipeline_stage_history (entry_id, from_stage_id, to_stage_id, moved_by)
    values (new.id, case when tg_op = 'UPDATE' then old.stage_id end, new.stage_id, auth.uid());

    select s.kind, p.company_id into v_kind, v_company
    from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id where s.id = new.stage_id;
    -- Moving to "Signed" adds the creator to the roster (when the plan includes it).
    if v_kind = 'signed' and private.has_feature('company', v_company, 'roster') then
      insert into public.roster_members (company_id, creator_id) values (v_company, new.creator_id)
      on conflict (company_id, creator_id) do update set status = 'active';
    end if;
  end if;
  return new;
end;
$$;
create trigger pipeline_entries_after after insert or update on public.pipeline_entries
  for each row execute function private.after_pipeline_entry_change();

-- New (non-default) pipelines start with a simple set of stages.
create or replace function private.seed_pipeline_stages()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_default then return new; end if;
  insert into public.pipeline_stages (pipeline_id, name, position, kind, is_system) values
    (new.id, 'To review', 1, 'open', false),
    (new.id, 'Contacted', 2, 'open', false),
    (new.id, 'Interviewing', 3, 'open', false),
    (new.id, 'Signed', 100, 'signed', true),
    (new.id, 'Passed', 101, 'passed', true);
  return new;
end;
$$;
create trigger pipelines_seed_stages after insert on public.pipelines
  for each row execute function private.seed_pipeline_stages();

-- Board data: stages + entries with creator identity and assignee names.
create or replace function public.pipeline_board(p_pipeline_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.pipelines where id = p_pipeline_id;
  if v_company is null or not private.is_company_member(v_company) then
    raise exception 'Pipeline not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'stages', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'kind', s.kind,
                         'position', s.position, 'is_system', s.is_system) order by s.position)
                        from public.pipeline_stages s where s.pipeline_id = p_pipeline_id), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
                         'id', e.id, 'stage_id', e.stage_id, 'updated_at', e.updated_at,
                         'assigned_to', e.assigned_to,
                         'assignee', (select coalesce(p.display_name, p.email) from public.profiles p where p.id = e.assigned_to),
                         'creator', private.creator_card(e.creator_id)) order by e.updated_at desc)
                        from public.pipeline_entries e where e.pipeline_id = p_pipeline_id), '[]'::jsonb)
  );
end;
$$;

-- Where a creator stands with this company (for the creator detail page).
create or replace function public.creator_relationship(p_company_id uuid, p_creator_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'inquiry', (select jsonb_build_object('id', i.id, 'status', i.status, 'created_at', i.created_at,
                                          'responded_at', i.responded_at, 'conversation_id', i.conversation_id)
                from public.representation_inquiries i
                where i.company_id = p_company_id and i.creator_id = p_creator_id
                order by i.created_at desc limit 1),
    'conversation', (select jsonb_build_object('id', c.id, 'status', c.status) from public.conversations c
                     where c.company_id = p_company_id and c.creator_id = p_creator_id),
    'pipelines', coalesce((select jsonb_agg(jsonb_build_object('entry_id', e.id, 'pipeline_id', p.id, 'pipeline', p.name,
                                    'stage_id', e.stage_id, 'stage', s.name, 'assigned_to', e.assigned_to))
                           from public.pipeline_entries e join public.pipelines p on p.id = e.pipeline_id
                           join public.pipeline_stages s on s.id = e.stage_id
                           where p.company_id = p_company_id and e.creator_id = p_creator_id), '[]'::jsonb),
    'roster', (select jsonb_build_object('id', r.id, 'status', r.status, 'signed_at', r.signed_at, 'contract_end', r.contract_end)
               from public.roster_members r where r.company_id = p_company_id and r.creator_id = p_creator_id),
    'blocked', private.is_blocked(p_creator_id, p_company_id),
    'reachable', private.creator_is_reachable(p_creator_id)
  );
end;
$$;

-- Notes with author names (team notes + my private notes).
create or replace function public.creator_notes(p_company_id uuid, p_creator_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'visibility', n.visibility, 'created_at', n.created_at,
                     'mine', n.author_id = auth.uid(),
                     'author', (select coalesce(p.display_name, p.email) from public.profiles p where p.id = n.author_id))
                     order by n.created_at desc)
    from public.internal_notes n
    where n.company_id = p_company_id and n.creator_id = p_creator_id
      and (n.visibility = 'team' or n.author_id = auth.uid())
  ), '[]'::jsonb);
end;
$$;

-- Notes and roster entries can only be about creators the company can see or already works with.
create or replace function private.guard_company_creator_ref()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then return new; end if;
  if tg_op = 'UPDATE' and (new.creator_id is distinct from old.creator_id or new.company_id is distinct from old.company_id) then
    raise exception 'This record can''t be moved' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and not (private.creator_is_reachable(new.creator_id)
                               or private.company_knows_creator(new.company_id, new.creator_id)) then
    raise exception 'Creator not found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
create trigger internal_notes_creator_guard before insert or update on public.internal_notes
  for each row execute function private.guard_company_creator_ref();
create trigger roster_members_creator_guard before insert or update on public.roster_members
  for each row execute function private.guard_company_creator_ref();

create or replace function public.company_roster(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'signed_at', r.signed_at,
                     'contract_end', r.contract_end, 'notes', r.notes, 'creator', private.creator_card(r.creator_id),
                     'conversation_id', (select c.id from public.conversations c
                                         where c.company_id = r.company_id and c.creator_id = r.creator_id and c.status = 'open'))
                     order by r.status, r.signed_at desc)
    from public.roster_members r where r.company_id = p_company_id
  ), '[]'::jsonb);
end;
$$;

-- ---------- Company profile (signed-in users) -------------------------
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
    and auth.uid() is not null and private.is_active_user();
$$;

-- ---------- Realtime: new messages and notifications appear live ------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications;
  end if;
end;
$$;

-- ---------- Privileges --------------------------------------------------
grant execute on function
  private.creator_card(uuid), private.company_knows_creator(uuid, uuid), private.creator_is_reachable(uuid),
  private.is_company_member_user(uuid, uuid), private.message_rate_ok(),
  private.before_message_insert(), private.guard_pipeline_entries(), private.guard_company_creator_ref()
to authenticated, service_role;

revoke execute on function
  private.pipeline_advance(uuid, uuid, text), private.notify(uuid, text, text, text, jsonb)
from public, anon, authenticated;

revoke execute on function
  public.send_inquiry(uuid, uuid, text, text), public.mark_inquiry_viewed(uuid),
  public.respond_to_inquiry(uuid, boolean), public.withdraw_inquiry(uuid),
  public.company_inquiries(uuid), public.my_inquiries(), public.my_inbox(uuid), public.get_conversation(uuid),
  public.mark_conversation_read(uuid), public.my_badges(uuid), public.pipeline_board(uuid),
  public.creator_relationship(uuid, uuid), public.creator_notes(uuid, uuid), public.company_roster(uuid),
  public.get_company_profile(text)
from public, anon;
grant execute on function
  public.send_inquiry(uuid, uuid, text, text), public.mark_inquiry_viewed(uuid),
  public.respond_to_inquiry(uuid, boolean), public.withdraw_inquiry(uuid),
  public.company_inquiries(uuid), public.my_inquiries(), public.my_inbox(uuid), public.get_conversation(uuid),
  public.mark_conversation_read(uuid), public.my_badges(uuid), public.pipeline_board(uuid),
  public.creator_relationship(uuid, uuid), public.creator_notes(uuid, uuid), public.company_roster(uuid),
  public.get_company_profile(text)
to authenticated;

-- Audit inquiries and roster changes.
create trigger audit_inquiries after update of status on public.representation_inquiries
  for each row execute function private.audit_row_change();
create trigger audit_roster after insert or update or delete on public.roster_members
  for each row execute function private.audit_row_change();
