-- Phase 3: Search activity logs for real-time monitoring.

create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches (id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warn', 'error', 'debug')),
  message text not null,
  state_code text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index on public.search_logs (search_id, created_at);

alter table public.search_logs enable row level security;

create policy "search_logs_select_auth" on public.search_logs
  for select using (auth.uid() is not null);
