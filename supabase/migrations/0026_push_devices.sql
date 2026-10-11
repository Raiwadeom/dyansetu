-- ============================================================================
-- 0026 — DnyanSetu notifications, rebuilt
--
-- 1. push_devices: every phone / browser that allowed DnyanSetu notifications
--    (signed in or not). A device Google reports as gone is marked dead_at
--    instead of deleted, so if that browser shows up again with the same old
--    subscription the server can tell it to make a fresh one.
-- 2. push_log: one row per notification sent (what, to how many, how many
--    failed), so delivery can be checked in Supabase.
-- 3. Existing subscriptions from site_push_subscriptions are copied over, so
--    nobody has to allow notifications again. The old table is left in place
--    (unused) and can be dropped later.
--
-- Service role only (the /api functions); no policies for anon/authenticated.
-- ============================================================================

create table if not exists public.push_devices (
  id            bigint generated always as identity primary key,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_id       uuid references auth.users (id) on delete set null,
  user_agent    text not null default '',
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_sent_at  timestamptz,
  dead_at       timestamptz
);

create index if not exists push_devices_live_idx on public.push_devices (id) where dead_at is null;

alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;

create table if not exists public.push_log (
  id          bigint generated always as identity primary key,
  kind        text not null,
  ref_id      text not null default '',
  title       text not null default '',
  targets     int  not null default 0,
  sent        int  not null default 0,
  failed      int  not null default 0,
  removed     int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

insert into public.push_devices (endpoint, p256dh, auth, user_id, user_agent, created_at, last_seen_at, last_sent_at)
select s.endpoint, s.keys->>'p256dh', s.keys->>'auth', s.user_id, s.user_agent, s.created_at,
       coalesce(s.last_used_at, s.created_at), s.last_used_at
  from public.site_push_subscriptions s
 where s.keys ? 'p256dh' and s.keys ? 'auth'
on conflict (endpoint) do nothing;
