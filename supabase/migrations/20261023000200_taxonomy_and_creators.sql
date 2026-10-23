-- =====================================================================
-- TalentLoom · 0200 · Taxonomy lookups and creator data
-- =====================================================================

-- ---------- Admin-managed lookups -----------------------------------
create table public.niches (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  label text not null,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.content_categories (like public.niches including all);
create table public.support_types (like public.niches including all);
create table public.industries (like public.niches including all);

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  label text not null,
  icon text,
  profile_url_template text,          -- e.g. https://www.tiktok.com/@{handle}
  api_supported boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Creator profile -----------------------------------------
create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  display_name text check (char_length(display_name) <= 80),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 2000),
  city text check (char_length(city) <= 80),
  region text check (char_length(region) <= 80),
  country char(2) check (country ~ '^[A-Z]{2}$'),
  avatar_path text,
  cover_path text,
  seeking_management boolean not null default false,
  representation_status public.representation_status not null default 'unrepresented',
  contact_preference text not null default 'platform_only'
    check (contact_preference in ('platform_only', 'email_after_accept')),
  contact_email text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  is_discoverable boolean not null default false,
  discoverable_consent_at timestamptz,
  is_featured boolean not null default false,
  featured_until timestamptz,
  completeness_pct smallint not null default 0 check (completeness_pct between 0 and 100),
  profile_views_count integer not null default 0,
  last_active_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discoverable_requires_consent check (not is_discoverable or discoverable_consent_at is not null),
  constraint discoverable_requires_handle check (not is_discoverable or handle is not null)
);
create index creator_profiles_discoverable_idx on public.creator_profiles (is_discoverable)
  where deleted_at is null;
create trigger creator_profiles_updated_at before update on public.creator_profiles
  for each row execute function public.set_updated_at();

-- Field-level visibility chosen by the creator
create table public.creator_privacy_settings (
  creator_id uuid primary key references public.creator_profiles (id) on delete cascade,
  bio public.visibility not null default 'public',
  location public.visibility not null default 'public',
  contact public.visibility not null default 'private',
  social_links public.visibility not null default 'public',
  follower_counts public.visibility not null default 'public',
  engagement public.visibility not null default 'approved_companies',
  demographics public.visibility not null default 'approved_companies',
  growth public.visibility not null default 'approved_companies',
  media_kit public.visibility not null default 'approved_companies',
  partnerships public.visibility not null default 'public',
  portfolio public.visibility not null default 'public',
  updated_at timestamptz not null default now()
);
create trigger creator_privacy_updated_at before update on public.creator_privacy_settings
  for each row execute function public.set_updated_at();

create table public.creator_niches (
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  niche_id uuid not null references public.niches (id) on delete cascade,
  primary key (creator_id, niche_id)
);
create table public.creator_categories (
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  category_id uuid not null references public.content_categories (id) on delete cascade,
  primary key (creator_id, category_id)
);
create table public.creator_industries (
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  industry_id uuid not null references public.industries (id) on delete cascade,
  primary key (creator_id, industry_id)
);
create table public.creator_support_types (
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  support_type_id uuid not null references public.support_types (id) on delete cascade,
  primary key (creator_id, support_type_id)
);
create index creator_niches_niche_idx on public.creator_niches (niche_id);
create index creator_categories_cat_idx on public.creator_categories (category_id);

-- ---------- Social accounts & analytics ------------------------------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  platform_id uuid not null references public.platforms (id),
  handle text not null check (char_length(handle) between 1 and 100),
  url text check (url ~* '^https://'),
  connection_type text not null default 'manual' check (connection_type in ('manual', 'oauth')),
  external_account_id text,
  is_primary boolean not null default false,
  display_order smallint not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index social_accounts_unique_handle
  on public.social_accounts (creator_id, platform_id, lower(handle)) where deleted_at is null;
create index social_accounts_creator_idx on public.social_accounts (creator_id) where deleted_at is null;
create trigger social_accounts_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();

-- Future OAuth connections. Tokens live in Supabase Vault (vault_secret_id); never user-readable.
create table public.social_connections (
  social_account_id uuid primary key references public.social_accounts (id) on delete cascade,
  provider text not null,
  scopes text[] not null default '{}',
  vault_secret_id uuid,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  revoked_at timestamptz
);

create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  captured_at date not null default current_date,
  followers bigint check (followers >= 0),
  avg_views bigint check (avg_views >= 0),
  avg_likes bigint check (avg_likes >= 0),
  avg_comments bigint check (avg_comments >= 0),
  engagement_rate numeric(6, 3) check (engagement_rate between 0 and 100),
  growth_30d_pct numeric(7, 2) check (growth_30d_pct between -100 and 10000),
  source public.analytics_source not null default 'self_reported',
  verification_status public.verification_status not null default 'none',
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index analytics_snapshots_account_idx on public.analytics_snapshots (social_account_id, captured_at desc);
create trigger analytics_snapshots_updated_at before update on public.analytics_snapshots
  for each row execute function public.set_updated_at();

create table public.audience_demographics (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.analytics_snapshots (id) on delete cascade,
  dimension text not null check (dimension in ('age', 'gender', 'country', 'city')),
  bucket text not null check (char_length(bucket) between 1 and 60),
  pct numeric(5, 2) not null check (pct between 0 and 100),
  unique (snapshot_id, dimension, bucket)
);

create table public.analytics_evidence (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  snapshot_id uuid references public.analytics_snapshots (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index analytics_evidence_creator_idx on public.analytics_evidence (creator_id);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('analytics', 'company', 'identity')),
  subject_id uuid not null,
  requested_by uuid references public.profiles (id) on delete set null,
  status public.verification_status not null default 'pending',
  priority smallint not null default 0,
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_requests_queue_idx on public.verification_requests (status, priority desc, created_at);
create unique index verification_requests_one_open
  on public.verification_requests (subject_type, subject_id) where status = 'pending';
create trigger verification_requests_updated_at before update on public.verification_requests
  for each row execute function public.set_updated_at();

-- ---------- Portfolio, media kit, partnerships ------------------------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  description text check (char_length(description) <= 1000),
  item_type text not null check (item_type in ('link', 'image', 'video', 'pdf')),
  url text check (url ~* '^https://'),
  storage_path text,
  platform_id uuid references public.platforms (id),
  is_featured boolean not null default false,
  visibility public.visibility not null default 'public',
  sort integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_has_target check (url is not null or storage_path is not null)
);
create index portfolio_items_creator_idx on public.portfolio_items (creator_id) where deleted_at is null;
create trigger portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function public.set_updated_at();

create table public.media_kits (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  storage_path text,
  file_name text,
  version integer not null default 1,
  is_current boolean not null default true,
  custom_page jsonb,
  created_at timestamptz not null default now()
);
create unique index media_kits_one_current on public.media_kits (creator_id) where is_current;

create table public.brand_partnerships (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  brand_name text not null check (char_length(brand_name) <= 120),
  category_id uuid references public.content_categories (id),
  year smallint check (year between 2000 and 2100),
  description text check (char_length(description) <= 1000),
  link text check (link ~* '^https://'),
  visibility public.visibility not null default 'public',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_partnerships_creator_idx on public.brand_partnerships (creator_id) where deleted_at is null;
create trigger brand_partnerships_updated_at before update on public.brand_partnerships
  for each row execute function public.set_updated_at();
