-- =====================================================================
-- TalentLoom · 0600 · Row Level Security
--
-- Rule of thumb: RLS is ON for every public table. A table with no policy
-- for a role is invisible to that role. Companies NEVER read creator tables
-- directly — they go through masking functions added in Phase 3.
-- =====================================================================

-- ---------- 1. Enable RLS everywhere + super-admin full access --------
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t);
    -- MFA-verified super admins can manage every table. Append-only tables are
    -- read-only for admins too (see the end of this file).
    if t not in ('audit_logs', 'impersonation_sessions', 'billing_events') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin())',
        'admin_all_' || t, t
      );
    end if;
  end loop;
end;
$$;

-- service_role (server only) bypasses RLS by design.

-- ---------- 2. Profiles & consents ------------------------------------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_company_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and private.is_active_user())
  with check (id = auth.uid());

create policy consents_select_own on public.consents for select to authenticated
  using (user_id = auth.uid());
create policy consents_insert_own on public.consents for insert to authenticated
  with check (user_id = auth.uid() and private.is_active_user());
create policy consents_revoke_own on public.consents for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- consents: only revoked_at may change
revoke update on public.consents from authenticated;
grant update (revoked_at) on public.consents to authenticated;

-- ---------- 3. Public reference data (read-only for everyone) ---------
do $$
declare
  t text;
begin
  foreach t in array array['niches', 'content_categories', 'support_types', 'industries', 'platforms']
  loop
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (active)',
      'read_active_' || t, t
    );
  end loop;
end;
$$;

create policy plans_read on public.plans for select to anon, authenticated using (is_active and is_public);
create policy plan_prices_read on public.plan_prices for select to anon, authenticated using (active);
create policy features_read on public.features for select to anon, authenticated using (true);
create policy plan_features_read on public.plan_features for select to anon, authenticated using (true);
create policy addon_products_read on public.addon_products for select to anon, authenticated using (enabled);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy settings_public_read on public.platform_settings for select to anon, authenticated using (is_public);
create policy legal_pages_read on public.legal_pages for select to anon, authenticated using (published_at is not null);

-- ---------- 4. Creator-owned data ------------------------------------
create policy creator_profiles_select_own on public.creator_profiles for select to authenticated
  using (user_id = auth.uid());
create policy creator_profiles_update_own on public.creator_profiles for update to authenticated
  using (user_id = auth.uid() and private.is_active_user())
  with check (user_id = auth.uid());

-- Tables with a creator_id column that the creator fully manages.
do $$
declare
  t text;
begin
  foreach t in array array[
    'creator_privacy_settings', 'creator_niches', 'creator_categories', 'creator_industries',
    'creator_support_types', 'social_accounts', 'analytics_evidence', 'portfolio_items',
    'media_kits', 'brand_partnerships'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (creator_id = private.my_creator_id())',
      'owner_select_' || t, t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (creator_id = private.my_creator_id() and private.is_active_user())',
      'owner_insert_' || t, t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (creator_id = private.my_creator_id() and private.is_active_user()) with check (creator_id = private.my_creator_id())',
      'owner_update_' || t, t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (creator_id = private.my_creator_id() and private.is_active_user())',
      'owner_delete_' || t, t);
  end loop;
end;
$$;

-- Creator Pro tools: anyone can READ their own records (so a downgrade never
-- hides data), but creating/editing requires the plan feature.
do $$
declare
  t text;
  f text;
begin
  for t, f in select * from (values ('affiliate_codes', 'affiliate_vault'), ('brand_deals', 'brand_deal_tracker')) v(t, f)
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (creator_id = private.my_creator_id())',
      'owner_select_' || t, t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (creator_id = private.my_creator_id() and private.is_active_user() and private.has_feature(''user'', auth.uid(), %L))',
      'owner_insert_' || t, t, f);
    execute format(
      'create policy %I on public.%I for update to authenticated using (creator_id = private.my_creator_id() and private.is_active_user() and private.has_feature(''user'', auth.uid(), %L)) with check (creator_id = private.my_creator_id())',
      'owner_update_' || t, t, f);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (creator_id = private.my_creator_id() and private.is_active_user())',
      'owner_delete_' || t, t);
  end loop;
end;
$$;

create policy snapshots_owner_select on public.analytics_snapshots for select to authenticated
  using (private.owns_social_account(social_account_id));
create policy snapshots_owner_insert on public.analytics_snapshots for insert to authenticated
  with check (private.owns_social_account(social_account_id) and private.is_active_user());
create policy snapshots_owner_update on public.analytics_snapshots for update to authenticated
  using (private.owns_social_account(social_account_id) and private.is_active_user())
  with check (private.owns_social_account(social_account_id));
create policy snapshots_owner_delete on public.analytics_snapshots for delete to authenticated
  using (private.owns_social_account(social_account_id) and private.is_active_user());

create policy demographics_owner_all on public.audience_demographics for all to authenticated
  using (private.owns_snapshot(snapshot_id))
  with check (private.owns_snapshot(snapshot_id) and private.is_active_user());

create policy verification_select_own on public.verification_requests for select to authenticated
  using (requested_by = auth.uid());
-- Creation goes through request_verification() (Phase 2), which validates ownership.

-- social_connections: no user policies (tokens are server-only).

-- ---------- 5. Company workspace ------------------------------------
create policy companies_member_select on public.companies for select to authenticated
  using (private.is_company_member(id));
create policy companies_member_update on public.companies for update to authenticated
  using (private.has_company_permission(id, 'company.edit'))
  with check (private.has_company_permission(id, 'company.edit'));

create policy company_offices_select on public.company_offices for select to authenticated
  using (private.is_company_member(company_id));
create policy company_offices_write on public.company_offices for all to authenticated
  using (private.has_company_permission(company_id, 'company.edit') and private.has_feature('company', company_id, 'multiple_offices'))
  with check (private.has_company_permission(company_id, 'company.edit') and private.has_feature('company', company_id, 'multiple_offices'));

create policy company_categories_select on public.company_categories for select to authenticated
  using (private.is_company_member(company_id));
create policy company_categories_write on public.company_categories for all to authenticated
  using (private.has_company_permission(company_id, 'company.edit'))
  with check (private.has_company_permission(company_id, 'company.edit'));

create policy company_applications_select on public.company_applications for select to authenticated
  using (private.is_company_member(company_id));
create policy company_applications_insert on public.company_applications for insert to authenticated
  with check (private.has_company_permission(company_id, 'company.edit') and submitted_by = auth.uid() and status = 'submitted');

create policy company_roles_select on public.company_roles for select to authenticated
  using (company_id is null or private.is_company_member(company_id));
create policy company_roles_write on public.company_roles for all to authenticated
  using (company_id is not null and private.has_company_permission(company_id, 'team.manage')
         and private.has_feature('company', company_id, 'custom_roles'))
  with check (company_id is not null and is_system = false
              and private.has_company_permission(company_id, 'team.manage')
              and private.has_feature('company', company_id, 'custom_roles'));

create policy company_role_permissions_select on public.company_role_permissions for select to authenticated
  using (exists (select 1 from public.company_roles r
                 where r.id = role_id and (r.company_id is null or private.is_company_member(r.company_id))));
create policy company_role_permissions_write on public.company_role_permissions for all to authenticated
  using (exists (select 1 from public.company_roles r
                 where r.id = role_id and r.company_id is not null and not r.is_system
                   and private.has_company_permission(r.company_id, 'team.manage')
                   and private.has_feature('company', r.company_id, 'custom_roles')))
  with check (exists (select 1 from public.company_roles r
                 where r.id = role_id and r.company_id is not null and not r.is_system
                   and private.has_company_permission(r.company_id, 'team.manage')
                   and private.has_feature('company', r.company_id, 'custom_roles')));

create policy company_members_select on public.company_members for select to authenticated
  using (private.is_company_member(company_id));
create policy company_members_write on public.company_members for all to authenticated
  using (private.has_company_permission(company_id, 'team.manage'))
  with check (private.has_company_permission(company_id, 'team.manage'));

create policy company_invitations_select on public.company_invitations for select to authenticated
  using (private.has_company_permission(company_id, 'team.manage'));
create policy company_invitations_write on public.company_invitations for all to authenticated
  using (private.has_company_permission(company_id, 'team.manage'))
  with check (private.has_company_permission(company_id, 'team.manage') and invited_by = auth.uid());

-- company_leads: admin only (public submissions go through submit_company_lead()).

-- ---------- 6. Recruiting --------------------------------------------
create policy talent_lists_select on public.talent_lists for select to authenticated
  using (private.is_company_member(company_id) and (not is_private or created_by = auth.uid()));
create policy talent_lists_insert on public.talent_lists for insert to authenticated
  with check (private.has_company_permission(company_id, 'talent.manage') and created_by = auth.uid()
              and (not is_private or private.has_feature('company', company_id, 'private_lists')));
create policy talent_lists_update on public.talent_lists for update to authenticated
  using (private.has_company_permission(company_id, 'talent.manage') and (not is_private or created_by = auth.uid()))
  with check (private.has_company_permission(company_id, 'talent.manage')
              and (not is_private or (created_by = auth.uid() and private.has_feature('company', company_id, 'private_lists'))));
create policy talent_lists_delete on public.talent_lists for delete to authenticated
  using (private.has_company_permission(company_id, 'talent.manage') and (not is_private or created_by = auth.uid()));

create policy talent_list_members_select on public.talent_list_members for select to authenticated
  using (exists (select 1 from public.talent_lists l where l.id = list_id
                 and private.is_company_member(l.company_id) and (not l.is_private or l.created_by = auth.uid())));
create policy talent_list_members_write on public.talent_list_members for all to authenticated
  using (exists (select 1 from public.talent_lists l where l.id = list_id
                 and private.has_company_permission(l.company_id, 'talent.manage') and (not l.is_private or l.created_by = auth.uid())))
  with check (exists (select 1 from public.talent_lists l where l.id = list_id
                 and private.has_company_permission(l.company_id, 'talent.manage') and (not l.is_private or l.created_by = auth.uid())));

create policy pipelines_select on public.pipelines for select to authenticated
  using (private.is_company_member(company_id));
create policy pipelines_write on public.pipelines for all to authenticated
  using (private.has_company_permission(company_id, 'pipeline.manage') and not is_default)
  with check (private.has_company_permission(company_id, 'pipeline.manage') and not is_default);

create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.is_company_member(p.company_id)));
create policy pipeline_stages_write on public.pipeline_stages for all to authenticated
  using (not is_system and exists (select 1 from public.pipelines p where p.id = pipeline_id
         and private.has_company_permission(p.company_id, 'pipeline.manage')
         and private.has_feature('company', p.company_id, 'custom_stages')))
  with check (not is_system and exists (select 1 from public.pipelines p where p.id = pipeline_id
         and private.has_company_permission(p.company_id, 'pipeline.manage')
         and private.has_feature('company', p.company_id, 'custom_stages')));

create policy pipeline_entries_select on public.pipeline_entries for select to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.is_company_member(p.company_id)));
create policy pipeline_entries_write on public.pipeline_entries for all to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_company_permission(p.company_id, 'pipeline.edit')))
  with check (exists (select 1 from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id
              where p.id = pipeline_id and s.id = stage_id
                and private.has_company_permission(p.company_id, 'pipeline.edit')));

create policy pipeline_history_select on public.pipeline_stage_history for select to authenticated
  using (exists (select 1 from public.pipeline_entries e join public.pipelines p on p.id = e.pipeline_id
                 where e.id = entry_id and private.is_company_member(p.company_id)));

create policy internal_notes_select on public.internal_notes for select to authenticated
  using (private.is_company_member(company_id) and (visibility = 'team' or author_id = auth.uid()));
create policy internal_notes_insert on public.internal_notes for insert to authenticated
  with check (private.has_company_permission(company_id, 'notes.write') and author_id = auth.uid()
              and (visibility = 'private' or private.has_feature('company', company_id, 'shared_notes')));
create policy internal_notes_update on public.internal_notes for update to authenticated
  using (author_id = auth.uid() and private.has_company_permission(company_id, 'notes.write'))
  with check (author_id = auth.uid() and private.has_company_permission(company_id, 'notes.write'));
create policy internal_notes_delete on public.internal_notes for delete to authenticated
  using (author_id = auth.uid() and private.is_company_member(company_id));

create policy roster_select on public.roster_members for select to authenticated
  using (private.is_company_member(company_id));
create policy roster_write on public.roster_members for all to authenticated
  using (private.has_company_permission(company_id, 'roster.manage') and private.has_feature('company', company_id, 'roster'))
  with check (private.has_company_permission(company_id, 'roster.manage') and private.has_feature('company', company_id, 'roster'));

create policy profile_views_company_select on public.creator_profile_views for select to authenticated
  using (company_id is not null and private.is_company_member(company_id));
-- Inserts happen inside get_creator_for_company() (Phase 3).

-- ---------- 7. Inquiries & messaging --------------------------------
create policy inquiries_creator_select on public.representation_inquiries for select to authenticated
  using (creator_id = private.my_creator_id());
create policy inquiries_company_select on public.representation_inquiries for select to authenticated
  using (private.has_company_permission(company_id, 'inquiries.view'));
-- Sending and responding go through send_inquiry() / respond_to_inquiry() (Phase 4).

create policy conversations_select on public.conversations for select to authenticated
  using (private.can_view_conversation(id));

create policy participants_own on public.conversation_participants for all to authenticated
  using (user_id = auth.uid() and private.can_view_conversation(conversation_id))
  with check (user_id = auth.uid() and private.can_view_conversation(conversation_id));

create policy messages_select on public.messages for select to authenticated
  using (private.can_view_conversation(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and private.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.status = 'open'
        and not private.is_blocked(c.creator_id, c.company_id)
        and (
          c.creator_id = private.my_creator_id()
          or (
            private.has_company_permission(c.company_id, 'messages.send')
            and private.company_is_approved(c.company_id)
            and not exists (select 1 from public.companies co where co.id = c.company_id and co.outreach_frozen)
          )
        )
    )
  );
-- Messages are immutable for users (no update/delete policies).

create policy blocks_own on public.user_blocks for all to authenticated
  using (blocker_user_id = auth.uid())
  with check (blocker_user_id = auth.uid() and private.is_active_user());

create policy reports_insert_own on public.user_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and reviewed_by is null and resolution is null);
create policy reports_select_own on public.user_reports for select to authenticated
  using (reporter_id = auth.uid());

create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------- 8. Billing (read own; writes are server-only) ------------
create policy billing_customers_own on public.billing_customers for select to authenticated
  using ((owner_type = 'user' and owner_id = auth.uid())
         or (owner_type = 'company' and private.has_company_permission(owner_id, 'billing.view')));
create policy subscriptions_own on public.subscriptions for select to authenticated
  using ((owner_type = 'user' and owner_id = auth.uid())
         or (owner_type = 'company' and private.is_company_member(owner_id)));
create policy overrides_own on public.entitlement_overrides for select to authenticated
  using ((owner_type = 'user' and owner_id = auth.uid())
         or (owner_type = 'company' and private.is_company_member(owner_id)));
create policy usage_own on public.usage_records for select to authenticated
  using ((owner_type = 'user' and owner_id = auth.uid())
         or (owner_type = 'company' and private.is_company_member(owner_id)));
create policy credits_own on public.contact_credit_ledger for select to authenticated
  using (private.is_company_member(company_id));
create policy payments_own on public.payments for select to authenticated
  using ((owner_type = 'user' and owner_id = auth.uid())
         or (owner_type = 'company' and private.has_company_permission(owner_id, 'billing.view')));
-- promo_codes, billing_events, featured_placements: admin only.

-- ---------- 9. Platform ----------------------------------------------
create policy support_requests_own_select on public.support_requests for select to authenticated
  using (requester_id = auth.uid());
create policy support_requests_own_insert on public.support_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'open' and assigned_admin_id is null and private.is_active_user());

create policy support_messages_own_select on public.support_messages for select to authenticated
  using (not is_internal and exists (select 1 from public.support_requests r
         where r.id = request_id and r.requester_id = auth.uid()));
create policy support_messages_own_insert on public.support_messages for insert to authenticated
  with check (author_id = auth.uid() and not is_internal and exists (
    select 1 from public.support_requests r
    where r.id = request_id and r.requester_id = auth.uid() and r.status <> 'closed'));

create policy data_requests_own on public.data_requests for select to authenticated
  using (user_id = auth.uid());
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (private.is_super_admin());
create policy impersonation_sessions_admin_read on public.impersonation_sessions for select to authenticated
  using (private.is_super_admin());
create policy billing_events_admin_read on public.billing_events for select to authenticated
  using (private.is_super_admin());
-- impersonation_sessions, rate_limit_buckets, notification_templates: admin only (policy from step 1).
