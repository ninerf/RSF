-- Add archived column to results for hiding listings from the default view.
alter table public.results
  add column if not exists archived boolean not null default false;
