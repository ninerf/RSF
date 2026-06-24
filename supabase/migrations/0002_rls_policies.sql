-- Row Level Security for Zillow Finder
-- Enable RLS on every table, then grant the minimal access each role needs.
-- The service role bypasses RLS, so all admin-only tables simply have no
-- permissive policies for normal users.

-- Helper: is the current auth user an admin? -------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Enable RLS ---------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.api_credentials enable row level security;
alter table public.actor_configs   enable row level security;
alter table public.app_settings    enable row level security;
alter table public.searches        enable row level security;
alter table public.results         enable row level security;
alter table public.result_enrichment enable row level security;
alter table public.result_status   enable row level security;
alter table public.usage_log       enable row level security;

-- profiles : own row; admins read all --------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- api_credentials : admin only (service role bypasses RLS anyway) ----------
create policy "api_credentials_admin_all" on public.api_credentials
  for all using (public.is_admin()) with check (public.is_admin());

-- actor_configs : admin only -----------------------------------------------
create policy "actor_configs_admin_all" on public.actor_configs
  for all using (public.is_admin()) with check (public.is_admin());

-- app_settings : admin only ------------------------------------------------
create policy "app_settings_admin_all" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- usage_log : admin only ---------------------------------------------------
create policy "usage_log_admin_all" on public.usage_log
  for all using (public.is_admin()) with check (public.is_admin());

-- searches : admins do everything; users may read only ---------------------
create policy "searches_select_all_auth" on public.searches
  for select using (auth.uid() is not null);

create policy "searches_admin_write" on public.searches
  for all using (public.is_admin()) with check (public.is_admin());

-- results : all authenticated read; admin write ----------------------------
create policy "results_select_all_auth" on public.results
  for select using (auth.uid() is not null);

create policy "results_admin_write" on public.results
  for all using (public.is_admin()) with check (public.is_admin());

-- result_enrichment : all authenticated read; admin write ------------------
create policy "result_enrichment_select_all_auth" on public.result_enrichment
  for select using (auth.uid() is not null);

create policy "result_enrichment_admin_write" on public.result_enrichment
  for all using (public.is_admin()) with check (public.is_admin());

-- result_status : own rows only --------------------------------------------
create policy "result_status_own" on public.result_status
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
