-- ============================================================================
-- The main administrator's email becomes a setting
--
-- Until now admin_email() returned a fixed address, so moving the admin to a
-- new email needed a code change. Now it reads app_settings, which only the
-- server (service role) can write — via /api/scholarship-account, after a
-- one-time link sent to smuiqac@gmail.com is opened. Every policy that called
-- admin_email() keeps working unchanged.
-- ============================================================================

create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;
-- No policies: browsers can neither read nor write it.
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values ('admin_email', 'smuiqac@gmail.com')
on conflict (key) do nothing;

create or replace function public.admin_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(coalesce(
    (select value from public.app_settings where key = 'admin_email'),
    'smuiqac@gmail.com'
  ));
$$;
