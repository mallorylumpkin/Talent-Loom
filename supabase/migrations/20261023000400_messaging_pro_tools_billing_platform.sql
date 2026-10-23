-- =====================================================================
-- TalentLoom · 0400 · Messaging, Creator Pro tools, billing, platform
-- =====================================================================

-- ---------- Inquiries & messaging ------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  status public.conversation_status not null default 'pending',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, creator_id)
);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.representation_inquiries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  sender_user_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 120),
  body text not null check (char_length(body) between 20 and 4000),
  status public.inquiry_status not null default 'sent',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index inquiries_one_open_per_pair
  on public.representation_inquiries (company_id, creator_id) where status in ('sent', 'viewed');
create index inquiries_creator_idx on public.representation_inquiries (creator_id, created_at desc);
create index inquiries_company_idx on public.representation_inquiries (company_id, created_at desc);
create trigger inquiries_updated_at before update on public.representation_inquiries
  for each row execute function public.set_updated_at();

-- Per-user read/archive state for a conversation
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  archived_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_user_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_recent_idx on public.messages (sender_user_id, created_at desc);

create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references public.profiles (id) on delete cascade,
  blocked_company_id uuid references public.companies (id) on delete cascade,
  blocked_user_id uuid references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  constraint block_has_target check (num_nonnulls(blocked_company_id, blocked_user_id) = 1)
);
create unique index user_blocks_company_key on public.user_blocks (blocker_user_id, blocked_company_id)
  where blocked_company_id is not null;
create unique index user_blocks_user_key on public.user_blocks (blocker_user_id, blocked_user_id)
  where blocked_user_id is not null;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('user', 'company', 'message', 'creator_profile', 'conversation')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'impersonation', 'scam', 'inappropriate', 'minor', 'other')),
  details text check (char_length(details) <= 3000),
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_reports_status_idx on public.user_reports (status, created_at);
create trigger user_reports_updated_at before update on public.user_reports
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_templates (
  key text not null,
  channel text not null check (channel in ('in_app', 'email')),
  subject text,
  body text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (key, channel)
);

-- ---------- Creator Pro tools ----------------------------------------
create table public.affiliate_codes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  brand_name text not null check (char_length(brand_name) <= 120),
  product text check (char_length(product) <= 200),
  code text check (char_length(code) <= 80),
  affiliate_link text check (affiliate_link ~* '^https?://'),
  network text check (char_length(network) <= 80),
  commission_rate numeric(6, 2) check (commission_rate between 0 and 100),
  cookie_days smallint check (cookie_days between 0 and 3650),
  starts_on date,
  expires_on date,
  restrictions text check (char_length(restrictions) <= 1000),
  brand_contact text check (char_length(brand_contact) <= 200),
  notes text check (char_length(notes) <= 3000),
  associated_content text check (char_length(associated_content) <= 1000),
  payout_status text not null default 'none' check (payout_status in ('none', 'pending', 'paid', 'disputed')),
  status text not null default 'active' check (status in ('active', 'expired', 'pending')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index affiliate_codes_creator_idx on public.affiliate_codes (creator_id);
create trigger affiliate_codes_updated_at before update on public.affiliate_codes
  for each row execute function public.set_updated_at();

create table public.brand_deals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (id) on delete cascade,
  brand text not null check (char_length(brand) <= 120),
  contact text check (char_length(contact) <= 200),
  opportunity text check (char_length(opportunity) <= 300),
  stage text not null default 'lead' check (stage in (
    'lead', 'contacted', 'negotiating', 'contracted', 'content_in_progress',
    'awaiting_approval', 'published', 'invoiced', 'paid', 'closed'
  )),
  proposed_cents bigint check (proposed_cents >= 0),
  agreed_cents bigint check (agreed_cents >= 0),
  currency char(3) not null default 'USD',
  deliverables jsonb not null default '[]',
  due_date date,
  approval_status text not null default 'not_submitted'
    check (approval_status in ('not_submitted', 'submitted', 'changes_requested', 'approved')),
  publish_date date,
  usage_rights text check (char_length(usage_rights) <= 1000),
  exclusivity_until date,
  invoice_status text not null default 'not_sent' check (invoice_status in ('not_sent', 'sent', 'overdue', 'void')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_deals_creator_idx on public.brand_deals (creator_id, stage);
create trigger brand_deals_updated_at before update on public.brand_deals
  for each row execute function public.set_updated_at();

-- ---------- Billing --------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  audience text not null check (audience in ('creator', 'company')),
  name text not null,
  description text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  sales_led boolean not null default false,       -- "Contact sales" instead of self-serve checkout
  trial_days smallint not null default 0 check (trial_days between 0 and 365),
  stripe_product_id text unique,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  stripe_price_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index plan_prices_one_active on public.plan_prices (plan_id, billing_interval, currency) where active;

create table public.features (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  kind text not null check (kind in ('boolean', 'limit')),
  label text not null,
  audience text not null check (audience in ('creator', 'company')),
  sort integer not null default 0
);

create table public.plan_features (
  plan_id uuid not null references public.plans (id) on delete cascade,
  feature_key text not null references public.features (key) on delete cascade,
  enabled boolean not null default true,
  limit_value integer check (limit_value >= 0),   -- NULL = unlimited
  primary key (plan_id, feature_key)
);

create table public.billing_customers (
  owner_type public.owner_type not null,
  owner_id uuid not null,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  primary key (owner_type, owner_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_type public.owner_type not null,
  owner_id uuid not null,
  plan_id uuid not null references public.plans (id),
  plan_price_id uuid references public.plan_prices (id),
  stripe_subscription_id text unique,
  status public.subscription_status not null,
  collection_method text not null default 'charge_automatically'
    check (collection_method in ('charge_automatically', 'send_invoice', 'none')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,
  is_complimentary boolean not null default false,
  comp_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_owner_idx on public.subscriptions (owner_type, owner_id, created_at desc);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  owner_type public.owner_type not null,
  owner_id uuid not null,
  feature_key text not null references public.features (key) on delete cascade,
  enabled boolean not null default true,
  limit_value integer check (limit_value >= 0),
  expires_at timestamptz,
  granted_by uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index entitlement_overrides_owner_idx on public.entitlement_overrides (owner_type, owner_id, feature_key);

create table public.usage_records (
  owner_type public.owner_type not null,
  owner_id uuid not null,
  feature_key text not null references public.features (key) on delete cascade,
  period_start date not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_type, owner_id, feature_key, period_start)
);

create table public.contact_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  delta integer not null,
  reason text not null,
  source text not null check (source in ('purchase', 'admin', 'usage', 'expiry')),
  stripe_payment_ref text,
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index contact_credit_ledger_company_idx on public.contact_credit_ledger (company_id);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,40}$'),
  stripe_coupon_id text,
  stripe_promotion_code_id text unique,
  percent_off numeric(5, 2) check (percent_off > 0 and percent_off <= 100),
  amount_off_cents integer check (amount_off_cents > 0),
  duration text not null default 'once' check (duration in ('once', 'repeating', 'forever')),
  duration_months smallint,
  applies_to_plan_keys text[] not null default '{}',
  max_redemptions integer,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promo_one_discount check (num_nonnulls(percent_off, amount_off_cents) = 1)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_type public.owner_type not null,
  owner_id uuid not null,
  stripe_invoice_id text unique,
  stripe_payment_intent_id text,
  description text,
  amount_cents integer not null,
  currency char(3) not null default 'USD',
  status text not null check (status in ('draft', 'open', 'paid', 'uncollectible', 'void', 'failed', 'refunded')),
  hosted_invoice_url text,
  invoice_pdf_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_owner_idx on public.payments (owner_type, owner_id, created_at desc);

create table public.billing_events (
  id bigint generated always as identity primary key,
  stripe_event_id text not null unique,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);

create table public.addon_products (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  audience text not null check (audience in ('creator', 'company')),
  amount_cents integer not null check (amount_cents >= 0),
  billing text not null default 'one_time' check (billing in ('one_time', 'monthly')),
  stripe_price_id text,
  enabled boolean not null default false,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.featured_placements (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('creator', 'company')),
  subject_id uuid not null,
  placement text not null check (placement in ('search_boost', 'homepage_spotlight', 'featured_company', 'featured_creator')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  source text not null check (source in ('paid', 'admin')),
  payment_id uuid references public.payments (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint placement_window check (ends_at > starts_at)
);
create index featured_placements_active_idx on public.featured_placements (placement, ends_at);

-- ---------- Platform -------------------------------------------------
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.legal_pages (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  body_md text not null,
  version text not null,
  requires_legal_review boolean not null default true,
  published_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 150),
  category text not null default 'general'
    check (category in ('general', 'account', 'billing', 'verification', 'safety', 'bug', 'data_request')),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  priority smallint not null default 0,
  assigned_admin_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_status_idx on public.support_requests (status, priority desc, created_at);
create trigger support_requests_updated_at before update on public.support_requests
  for each row execute function public.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  attachment_path text,
  is_internal boolean not null default false,       -- admin-only notes
  created_at timestamptz not null default now()
);
create index support_messages_request_idx on public.support_messages (request_id, created_at);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'fulfilled', 'rejected')),
  notes text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  target_user_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 500),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  ended_at timestamptz
);
create index impersonation_sessions_admin_idx on public.impersonation_sessions (admin_id, started_at desc);

-- Insert-only audit trail. No foreign keys on purpose: entries must outlive deleted users.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  impersonator_id uuid,
  action text not null,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}',
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);

create table public.rate_limit_buckets (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
