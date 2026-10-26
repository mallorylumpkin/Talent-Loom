-- =====================================================================
-- TalentLoom · 1100 · Fix: creating company accounts from the server
--
-- Supabase's admin "create user" saves app_metadata AFTER inserting the
-- user row, so the new-user trigger couldn't see account_type yet and
-- rejected the account as a creator without 18+ confirmation.
--
-- Now trusted server code first registers the email in a protected table
-- (only the service role can write it). The trigger checks that table.
-- =====================================================================

create table private.pending_company_accounts (
  email text primary key,
  created_at timestamptz not null default now()
);
revoke all on private.pending_company_accounts from public, anon, authenticated;
grant all on private.pending_company_accounts to service_role;

create or replace function public.register_pending_company_account(p_email text)
returns void language sql security definer set search_path = '' as $$
  insert into private.pending_company_accounts (email) values (lower(trim(p_email)))
  on conflict (email) do update set created_at = now();
$$;
revoke execute on function public.register_pending_company_account(text) from public, anon, authenticated;
grant execute on function public.register_pending_company_account(text) to service_role;

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type public.account_type := 'creator';
  v_terms_version text := coalesce(new.raw_user_meta_data ->> 'terms_version', 'unversioned');
  v_age_ok boolean := coalesce(new.raw_user_meta_data ->> 'age_18_plus', '') = 'true';
begin
  if new.raw_app_meta_data ->> 'account_type' = 'company_member'
     or exists (
       select 1 from private.pending_company_accounts p
       where p.email = lower(new.email) and p.created_at > now() - interval '10 minutes'
     ) then
    v_type := 'company_member';
    delete from private.pending_company_accounts where email = lower(new.email);
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
