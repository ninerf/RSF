-- Phase 2: STR-revenue valuation + deal evaluation
-- Adds enrichment columns, deal-eval settings, an STR market cache, and a
-- per-city STR-legality note table.

-- result_enrichment: add annual revenue + deal verdict ---------------------
alter table public.result_enrichment
  add column if not exists str_annual_revenue numeric,
  add column if not exists deal_verdict text;

-- app_settings: deal-evaluation knobs + active STR provider ----------------
alter table public.app_settings
  add column if not exists cost_haircut_pct numeric not null default 25,
  add column if not exists min_monthly_spread numeric not null default 0,
  add column if not exists min_revenue_to_rent_ratio numeric not null default 1.0,
  add column if not exists str_provider text not null default 'apify_airbnb';

-- str_market_cache: cache STR market lookups per (city, state, beds) so the
-- same area isn't paid for once per property. Keyed by provider too.
create table if not exists public.str_market_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  city text not null,
  state text not null,
  beds int not null,
  adr numeric,
  occupancy numeric,
  monthly_revenue numeric,
  annual_revenue numeric,
  comps jsonb,
  raw_json jsonb,
  computed_at timestamptz not null default now(),
  unique (provider, city, state, beds)
);

-- str_legality_notes: optional manual note per US city (display only) ------
create table if not exists public.str_legality_notes (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  note text not null,
  created_at timestamptz not null default now(),
  unique (city, state)
);

-- RLS for the new tables ---------------------------------------------------
alter table public.str_market_cache enable row level security;
alter table public.str_legality_notes enable row level security;

-- str_market_cache: admin-managed (service role writes); all auth users read
-- so the Results UI can surface cached ADR/occupancy.
create policy "str_market_cache_select_all_auth" on public.str_market_cache
  for select using (auth.uid() is not null);
create policy "str_market_cache_admin_write" on public.str_market_cache
  for all using (public.is_admin()) with check (public.is_admin());

-- str_legality_notes: all auth users read; admin write.
create policy "str_legality_notes_select_all_auth" on public.str_legality_notes
  for select using (auth.uid() is not null);
create policy "str_legality_notes_admin_write" on public.str_legality_notes
  for all using (public.is_admin()) with check (public.is_admin());
