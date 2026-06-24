-- Phase 3: STR-focused state-level search, owner classification, sub-runs.

-- 1. search_state_runs: one sub-run per state within a parent search
create table if not exists public.search_state_runs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches (id) on delete cascade,
  state_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  apify_run_id text,
  result_count int not null default 0,
  new_result_count int not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz
);
create index on public.search_state_runs (search_id);
create index on public.search_state_runs (state_code, finished_at desc);

-- 2. Owner/contact columns on results
alter table public.results
  add column if not exists owner_name text,
  add column if not exists owner_type text check (owner_type in ('owner', 'management')),
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists broker_name text;

-- 3. app_settings additions
alter table public.app_settings
  add column if not exists default_search_mode text not null default 'states',
  add column if not exists skip_states_within_days int not null default 7,
  add column if not exists str_cache_ttl_days int not null default 30,
  add column if not exists management_keywords text[] not null default
    '{LLC,Inc,Corp,Realty,Properties,Management,Group,Capital,Investments,Partners,Homes}';

-- 4. search_mode on searches
alter table public.searches
  add column if not exists search_mode text not null default 'url'
    check (search_mode in ('states', 'url'));

-- 5. Zillow state region IDs (for building search URLs)
create table if not exists public.zillow_state_regions (
  state_code text primary key,
  state_name text not null,
  zillow_region_id int not null
);

-- Seed region IDs (Zillow's internal IDs for state-level searches)
insert into public.zillow_state_regions (state_code, state_name, zillow_region_id) values
  ('AL', 'Alabama', 4),
  ('AK', 'Alaska', 5),
  ('AZ', 'Arizona', 7),
  ('AR', 'Arkansas', 6),
  ('CA', 'California', 9),
  ('CO', 'Colorado', 10),
  ('CT', 'Connecticut', 11),
  ('DE', 'Delaware', 12),
  ('FL', 'Florida', 14),
  ('GA', 'Georgia', 16),
  ('HI', 'Hawaii', 17),
  ('ID', 'Idaho', 18),
  ('IL', 'Illinois', 19),
  ('IN', 'Indiana', 20),
  ('IA', 'Iowa', 21),
  ('KS', 'Kansas', 22),
  ('KY', 'Kentucky', 23),
  ('LA', 'Louisiana', 24),
  ('ME', 'Maine', 26),
  ('MD', 'Maryland', 25),
  ('MA', 'Massachusetts', 27),
  ('MI', 'Michigan', 28),
  ('MN', 'Minnesota', 29),
  ('MS', 'Mississippi', 31),
  ('MO', 'Missouri', 30),
  ('MT', 'Montana', 32),
  ('NE', 'Nebraska', 33),
  ('NV', 'Nevada', 36),
  ('NH', 'New Hampshire', 34),
  ('NJ', 'New Jersey', 37),
  ('NM', 'New Mexico', 38),
  ('NY', 'New York', 39),
  ('NC', 'North Carolina', 40),
  ('ND', 'North Dakota', 41),
  ('OH', 'Ohio', 42),
  ('OK', 'Oklahoma', 43),
  ('OR', 'Oregon', 44),
  ('PA', 'Pennsylvania', 45),
  ('RI', 'Rhode Island', 46),
  ('SC', 'South Carolina', 47),
  ('SD', 'South Dakota', 48),
  ('TN', 'Tennessee', 49),
  ('TX', 'Texas', 50),
  ('UT', 'Utah', 51),
  ('VT', 'Vermont', 53),
  ('VA', 'Virginia', 52),
  ('WA', 'Washington', 54),
  ('WV', 'West Virginia', 56),
  ('WI', 'Wisconsin', 55),
  ('WY', 'Wyoming', 57)
on conflict (state_code) do nothing;

-- 6. RLS
alter table public.search_state_runs enable row level security;
alter table public.zillow_state_regions enable row level security;

create policy "search_state_runs_select_auth" on public.search_state_runs
  for select using (auth.uid() is not null);
create policy "zillow_state_regions_select_auth" on public.zillow_state_regions
  for select using (auth.uid() is not null);
