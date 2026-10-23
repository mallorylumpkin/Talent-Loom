-- =====================================================================
-- TalentLoom · 0300 · Management companies, team, recruiting
-- Companies are created by the super admin (contact-sales flow).
-- =====================================================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  logo_path text,
  description text check (char_length(description) <= 3000),
  website text check (website ~* '^https?://'),
  city text,
  region text,
  country char(2) check (country ~ '^[A-Z]{2}$'),
  size_band text check (size_band in ('1', '2-5', '6-15', '16-50', '51-200', '200+')),
  status public.company_status not null default 'draft',
  is_verified_badge boolean not null default false,
  specialties text[] not null default '{}',
  services_description text check (char_length(services_description) <= 3000),
  contact_email text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_featured boolean not null default false,
  outreach_frozen boolean not null default false,
  approved_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_status_idx on public.companies (status) where deleted_at is null;
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

create table public.company_offices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  city text,
  region text,
  country char(2),
  created_at timestamptz not null default now()
);

create table public.company_categories (
  company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.content_categories (id) on delete cascade,
  primary key (company_id, category_id)
);

create table public.company_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  submitted_by uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}',
  status public.company_status not null default 'submitted',
  info_request_message text,
  admin_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  expedited boolean not null default false,
  created_at timestamptz not null default now()
);
create index company_applications_company_idx on public.company_applications (company_id, created_at desc);

-- Roles: company_id NULL = system roles shared by every company (Owner, Admin, Recruiter, Viewer)
create table public.company_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  key text not null check (key ~ '^[a-z_]+$'),
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index company_roles_key on public.company_roles
  (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

create table public.company_role_permissions (
  role_id uuid not null references public.company_roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.company_roles (id),
  office_id uuid references public.company_offices (id) on delete set null,
  status public.member_status not null default 'active',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id) where status = 'active';
create trigger company_members_updated_at before update on public.company_members
  for each row execute function public.set_updated_at();

create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_id uuid not null references public.company_roles (id),
  token_hash text not null unique,          -- sha256 of the emailed token; raw token never stored
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_invitations_company_idx on public.company_invitations (company_id);

-- "Contact sales" requests from the public For Companies page
create table public.company_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 2 and 120),
  website text check (website ~* '^https?://'),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_email text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 40),
  team_size text,
  categories text[] not null default '{}',
  message text check (char_length(message) <= 3000),
  interested_plan text,
  status public.lead_status not null default 'new',
  admin_notes text,
  converted_company_id uuid references public.companies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index company_leads_status_idx on public.company_leads (status, created_at desc);
create trigger company_leads_updated_at before update on public.company_leads
  for each row execute function public.set_updated_at();

-- ---------- Recruiting -----------------------------------------------
create table public.talent_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_private boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index talent_lists_company_idx on public.talent_lists (company_id);
create trigger talent_lists_updated_at before update on public.talent_lists
  for each row execute function public.set_updated_at();

create table public.talent_list_members (
  list_id uuid not null references public.talent_lists (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (list_id, creator_id)
);
create index talent_list_members_creator_idx on public.talent_list_members (creator_id);

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index pipelines_one_default on public.pipelines (company_id) where is_default;

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  position smallint not null,
  kind public.stage_kind not null default 'open',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pipeline_id, position) deferrable initially deferred
);

create table public.pipeline_entries (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages (id),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, creator_id)
);
create index pipeline_entries_stage_idx on public.pipeline_entries (stage_id);
create trigger pipeline_entries_updated_at before update on public.pipeline_entries
  for each row execute function public.set_updated_at();

create table public.pipeline_stage_history (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.pipeline_entries (id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages (id) on delete set null,
  to_stage_id uuid references public.pipeline_stages (id) on delete set null,
  moved_by uuid references public.profiles (id) on delete set null,
  moved_at timestamptz not null default now()
);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  visibility public.note_visibility not null default 'team',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index internal_notes_company_creator_idx on public.internal_notes (company_id, creator_id);
create trigger internal_notes_updated_at before update on public.internal_notes
  for each row execute function public.set_updated_at();

create table public.roster_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  signed_at date not null default current_date,
  contract_end date,
  status text not null default 'active' check (status in ('active', 'ended')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, creator_id)
);
create trigger roster_members_updated_at before update on public.roster_members
  for each row execute function public.set_updated_at();

create table public.creator_profile_views (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  viewer_user_id uuid references public.profiles (id) on delete set null,
  viewed_at timestamptz not null default now()
);
create index creator_profile_views_creator_idx on public.creator_profile_views (creator_id, viewed_at desc);
