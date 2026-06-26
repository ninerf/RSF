-- Phase 4: role overhaul (worker/client), property review workflow, notifications.

-- =========================================================================
-- 1. Roles: drop 'user', add 'worker' + 'client'
--    Existing non-admin users ('user') become 'worker'.
-- =========================================================================
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'worker' where role not in ('admin', 'worker', 'client');
alter table public.profiles alter column role set default 'worker';
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'worker', 'client'));

-- Staff helper: admin or worker (the people who review properties). -------
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'worker')
  );
$$;

-- =========================================================================
-- 2. Review workflow columns on results
--    review_status lifecycle:
--      pending       -> freshly scraped, awaiting worker review
--      approved      -> worker approved; eligible for client view if good
--      disapproved   -> rejected (also archived)
--      ready_to_send -> client marked it ready to contact owner
--      flagged       -> client flagged it as wrongly approved
-- =========================================================================
alter table public.results
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'disapproved', 'ready_to_send', 'flagged')),
  add column if not exists availability_status text,        -- owner's availability "on talk"
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists flagged_by uuid references public.profiles (id) on delete set null,
  add column if not exists flag_note text;
create index if not exists results_review_status_idx on public.results (review_status);

-- =========================================================================
-- 3. Notifications (in-app). One row per recipient user.
-- =========================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  result_id uuid references public.results (id) on delete cascade,
  type text not null default 'flag',
  message text not null,
  read boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, read);

alter table public.notifications enable row level security;

-- Each user reads and updates (mark-read) only their own notifications.
create policy "notifications_own_select" on public.notifications
  for select using (recipient_id = auth.uid());
create policy "notifications_own_update" on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
