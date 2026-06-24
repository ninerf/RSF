-- Zillow Finder — Phase 1 schema
-- Full schema for all phases; later phases populate the rest.
-- RLS is enabled on every table. Privileged writes go through the service role.

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;
-- Supabase Vault provides encrypted-at-rest secret storage.
create extension if not exists "supabase_vault" with schema vault;

-- =========================================================================
-- profiles : links auth.users -> username + role + permissions
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  can_run_searches boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- api_credentials : provider tokens stored via Vault (vault_secret_id only)
-- =========================================================================
create table if not exists public.api_credentials (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text not null,
  vault_secret_id uuid not null,
  is_paid boolean not null default false,
  monthly_result_limit int,
  results_used int not null default 0,
  calls_used int not null default 0,
  last_reset date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- actor_configs : scraper actor definitions (Apify etc.)
-- =========================================================================
create table if not exists public.actor_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null,
  actor_id text not null,
  source_label text,
  country text,
  input_mode text not null default 'form' check (input_mode in ('url', 'form')),
  input_template jsonb not null default '{}'::jsonb,
  input_fields jsonb not null default '[]'::jsonb,
  result_mapping jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- app_settings : singleton config row
-- =========================================================================
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  global_monthly_result_budget int,
  hard_stop boolean not null default true,
  pipeline_enabled boolean not null default true
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- =========================================================================
-- searches : a single scraper run request
-- =========================================================================
create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  actor_config_id uuid references public.actor_configs (id) on delete set null,
  credential_id uuid references public.api_credentials (id) on delete set null,
  name text,
  input_params jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'aborted')),
  apify_run_id text,
  result_count int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists searches_created_by_idx on public.searches (created_by);
create index if not exists searches_status_idx on public.searches (status);

-- =========================================================================
-- results : normalized property listings
-- =========================================================================
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.searches (id) on delete cascade,
  source text not null,
  country text,
  external_id text not null,
  listing_type text,
  price numeric,
  currency text,
  beds numeric,
  baths numeric,
  area_sqft numeric,
  address text,
  city text,
  state text,
  zip text,
  latitude numeric,
  longitude numeric,
  detail_url text,
  image_url text,
  rent_zestimate numeric,
  days_on_market int,
  available_date text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists results_search_id_idx on public.results (search_id);
create index if not exists results_city_state_idx on public.results (city, state);

-- =========================================================================
-- result_enrichment : computed analytics per result
-- =========================================================================
create table if not exists public.result_enrichment (
  result_id uuid primary key references public.results (id) on delete cascade,
  str_adr numeric,
  str_occupancy numeric,
  str_monthly_revenue numeric,
  arbitrage_spread numeric,
  source text,
  computed_at timestamptz not null default now()
);

-- =========================================================================
-- result_status : per-user triage state on a result
-- =========================================================================
create table if not exists public.result_status (
  result_id uuid not null references public.results (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (result_id, user_id)
);

-- =========================================================================
-- usage_log : per-search credit accounting
-- =========================================================================
create table if not exists public.usage_log (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.searches (id) on delete set null,
  credential_id uuid references public.api_credentials (id) on delete set null,
  results_charged int not null default 0,
  created_at timestamptz not null default now()
);
