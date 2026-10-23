-- =====================================================================
-- TalentLoom · 0100 · Core types, utilities, identity
-- =====================================================================

-- ---------- Enums ----------------------------------------------------
create type public.account_type as enum ('creator', 'company_member', 'super_admin');
create type public.account_status as enum ('active', 'suspended', 'deleted');
create type public.company_status as enum ('draft', 'submitted', 'info_requested', 'approved', 'rejected', 'suspended');
create type public.analytics_source as enum ('self_reported', 'admin_verified', 'api_verified');
create type public.verification_status as enum ('none', 'pending', 'verified', 'rejected');
create type public.visibility as enum ('public', 'approved_companies', 'private');
create type public.representation_status as enum ('unrepresented', 'represented', 'open_to_switch');
create type public.inquiry_status as enum ('sent', 'viewed', 'accepted', 'declined', 'archived', 'withdrawn');
create type public.conversation_status as enum ('pending', 'open', 'closed', 'blocked');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'complimentary'
);
create type public.owner_type as enum ('user', 'company');
create type public.member_status as enum ('invited', 'active', 'removed');
create type public.stage_kind as enum ('open', 'signed', 'passed');
create type public.note_visibility as enum ('private', 'team');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'declined');

-- ---------- Utility: updated_at -------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Profiles -------------------------------------------------
-- One row per auth user. The ROLE lives here (never in user-editable metadata).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type public.account_type not null default 'creator',
  status public.account_status not null default 'active',
  email text not null,
  display_name text check (char_length(display_name) <= 80),
  age_attested_at timestamptz,
  onboarding_completed_at timestamptz,
  suspended_reason text,
  last_active_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_account_type_idx on public.profiles (account_type);
create index profiles_status_idx on public.profiles (status);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is 'App-level user record. account_type/status may only be changed by super admins or server-side privileged code.';

-- ---------- Consents -------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  consent_type text not null check (consent_type in (
    'terms_of_service', 'privacy_policy', 'age_18_plus', 'creator_data_consent',
    'discoverability', 'analytics_sharing', 'company_standards'
  )),
  document_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consents_user_idx on public.consents (user_id, consent_type);

-- ---------- Permission catalogue (company workspace permissions) ------
create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null,
  scope text not null default 'company' check (scope in ('company'))
);
