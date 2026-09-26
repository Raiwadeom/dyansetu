-- ============================================================================
-- RaktSetu — student blood-donation network
--
-- Run after 0001_core.sql, in the Supabase SQL Editor.
--
-- The privacy rules that matter most here:
--   * Nobody can read another user's RaktSetu profile (age, gender, weight,
--     blood group, city, phone). Matching happens server-side only.
--   * A request's contact phone lives in its own table, readable only by the
--     requester and by donors who tapped "I can help" on that request.
--   * Requests are created only through /api/raktsetu/requests (service role),
--     which enforces the rate limit and sends the alerts. The browser has no
--     insert policy on blood_requests at all.
--   * RaktSetu is 18+ only. That is a CHECK constraint, not just a form rule.
-- ============================================================================

-- --------------------------------------------------------------- constants

create or replace function public.raktsetu_blood_groups()
returns text[] language sql immutable as $$
  select array['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']::text[]
$$;

-- Days a donor must wait after a whole-blood donation before donating again.
-- Four months, as agreed for DnyanSetu (NBTC's own minimum is 90 days for men
-- and 120 for women; 120 for everyone covers both).
create or replace function public.raktsetu_donation_gap_days()
returns int language sql immutable as $$ select 120 $$;

-- ---------------------------------------------------------------- profiles

create table if not exists public.raktsetu_profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null default '' check (length(display_name) <= 80),
  -- 18+ only. A younger student keeps full use of DnyanSetu but cannot hold a
  -- RaktSetu profile, so cannot post, respond or receive alerts.
  age                int not null check (age between 18 and 100),
  gender             text not null check (gender in ('male', 'female', 'other', 'prefer_not')),
  weight_kg          numeric(5, 1) not null check (weight_kg between 30 and 250),
  blood_group        text not null check (blood_group = any (public.raktsetu_blood_groups() || 'unknown'::text)),
  city               text not null check (length(trim(city)) between 2 and 60),
  city_key           text generated always as (lower(trim(city))) stored,
  phone              text not null default '' check (length(phone) <= 20),
  -- "I confirm none of the listed conditions apply to me." Re-confirmed on
  -- every save; required to be counted as an eligible donor.
  health_declared    boolean not null default false,
  last_donation_date date,
  notify_push        boolean not null default true,
  notify_email       boolean not null default true,
  notify_all_cities  boolean not null default false,
  consent_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists raktsetu_profiles_match_idx on public.raktsetu_profiles (blood_group, city_key);

-- Eligible to donate right now: 18-65, at least 45 kg, health declaration made,
-- and at least four months since the last donation. The blood bank still does
-- its own screening (haemoglobin, blood pressure) before any donation.
create or replace function public.raktsetu_is_eligible_donor(p public.raktsetu_profiles)
returns boolean language sql stable as $$
  select p.age between 18 and 65
     and p.weight_kg >= 45
     and p.health_declared
     and (p.last_donation_date is null
          or p.last_donation_date <= current_date - public.raktsetu_donation_gap_days())
$$;

create or replace function public.raktsetu_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists raktsetu_profiles_touch on public.raktsetu_profiles;
create trigger raktsetu_profiles_touch
  before update on public.raktsetu_profiles
  for each row execute function public.raktsetu_touch();

alter table public.raktsetu_profiles enable row level security;

drop policy if exists "rs profiles: own only" on public.raktsetu_profiles;
create policy "rs profiles: own only" on public.raktsetu_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------- requests

create table if not exists public.blood_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid references auth.users (id) on delete set null,
  patient_name  text not null check (length(trim(patient_name)) between 2 and 80),
  blood_group   text not null check (blood_group = any (public.raktsetu_blood_groups())),
  units         int not null check (units between 1 and 10),
  hospital      text not null check (length(trim(hospital)) between 2 and 120),
  address       text not null check (length(trim(address)) between 5 and 300),
  city          text not null check (length(trim(city)) between 2 and 60),
  city_key      text generated always as (lower(trim(city))) stored,
  needed_by     timestamptz not null,
  note          text not null default '' check (length(note) <= 500),
  status        text not null default 'open'
                check (status in ('open', 'fulfilled', 'cancelled', 'expired', 'removed')),
  removed_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists blood_requests_open_idx on public.blood_requests (status, needed_by);
create index if not exists blood_requests_requester_idx on public.blood_requests (requester_id, created_at desc);

drop trigger if exists blood_requests_touch on public.blood_requests;
create trigger blood_requests_touch
  before update on public.blood_requests
  for each row execute function public.raktsetu_touch();

-- Rate limit, enforced in the database as well as in the API: at most three
-- requests per requester in any 24 hours.
create or replace function public.raktsetu_rate_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.blood_requests
       where requester_id = new.requester_id
         and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'You can post at most 3 blood requests in 24 hours.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists blood_requests_rate_limit on public.blood_requests;
create trigger blood_requests_rate_limit
  before insert on public.blood_requests
  for each row execute function public.raktsetu_rate_limit();

-- The requester's phone, split out so the open-requests list can never leak it.
create table if not exists public.blood_request_contacts (
  request_id     uuid primary key references public.blood_requests (id) on delete cascade,
  contact_phone  text not null check (length(contact_phone) between 6 and 20)
);

create table if not exists public.request_responses (
  id            bigint generated always as identity primary key,
  request_id    uuid not null references public.blood_requests (id) on delete cascade,
  responder_id  uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  donated_at    date,
  unique (request_id, responder_id)
);

create index if not exists request_responses_responder_idx on public.request_responses (responder_id);

create table if not exists public.blood_request_reports (
  id           bigint generated always as identity primary key,
  request_id   uuid not null references public.blood_requests (id) on delete cascade,
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  reason       text not null check (length(trim(reason)) between 3 and 300),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (request_id, reporter_id)
);

-- Visible to a signed-in user: open, not yet past its needed-by time — plus
-- their own requests, the ones they responded to, and everything for admin.
create or replace function public.raktsetu_can_see_request(r public.blood_requests)
returns boolean language sql stable security definer set search_path = public as $$
  select (r.status = 'open' and r.needed_by > now())
      or r.requester_id = auth.uid()
      or public.is_admin()
      or exists (select 1 from public.request_responses x
                  where x.request_id = r.id and x.responder_id = auth.uid())
$$;

alter table public.blood_requests enable row level security;
alter table public.blood_request_contacts enable row level security;
alter table public.request_responses enable row level security;
alter table public.blood_request_reports enable row level security;

-- Only signed-in users with a RaktSetu profile (so 18+) see requests at all.
drop policy if exists "requests: members read" on public.blood_requests;
create policy "requests: members read" on public.blood_requests
  for select to authenticated
  using (
    exists (select 1 from public.raktsetu_profiles p where p.user_id = auth.uid())
    and public.raktsetu_can_see_request(blood_requests)
  );
-- No insert/update/delete policies: creation goes through the API, status
-- changes through the functions below.

drop policy if exists "contacts: owner or responder" on public.blood_request_contacts;
create policy "contacts: owner or responder" on public.blood_request_contacts
  for select to authenticated
  using (
    exists (select 1 from public.blood_requests r
             where r.id = request_id and r.requester_id = auth.uid())
    or exists (select 1 from public.request_responses x
                where x.request_id = blood_request_contacts.request_id
                  and x.responder_id = auth.uid())
  );

drop policy if exists "responses: own or request owner" on public.request_responses;
create policy "responses: own or request owner" on public.request_responses
  for select to authenticated
  using (
    responder_id = auth.uid()
    or exists (select 1 from public.blood_requests r
                where r.id = request_id and r.requester_id = auth.uid())
  );

drop policy if exists "reports: file own" on public.blood_request_reports;
create policy "reports: file own" on public.blood_request_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (select 1 from public.raktsetu_profiles p where p.user_id = auth.uid())
  );

drop policy if exists "reports: admin read" on public.blood_request_reports;
create policy "reports: admin read" on public.blood_request_reports
  for select to authenticated
  using (public.is_admin() or reporter_id = auth.uid());

-- ---------------------------------------------------------- push subscriptions

-- One row per user per browser. Kept across sign-out on purpose, so alerts
-- still arrive after the tab is closed; removed when the user turns push off
-- or the push service answers 404/410.
create table if not exists public.push_subscriptions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null unique,
  keys          jsonb not null,
  user_agent    text not null default '',
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: own only" on public.push_subscriptions;
create policy "push: own only" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------- email counter

-- Resend's free tier: 100/day, 3,000/month. The API counts every send here and
-- stops before the cap. Service role only — no policies.
create table if not exists public.raktsetu_email_log (
  day   date primary key,
  sent  int not null default 0
);

alter table public.raktsetu_email_log enable row level security;

-- -------------------------------------------------------------- functions
-- Everything a browser may do beyond plain reads goes through one of these, so
-- each rule is written once, in one place.

-- "I can help": records the response and hands back the requester's phone.
create or replace function public.raktsetu_respond(p_request_id uuid)
returns table (contact_phone text, requester_name text)
language plpgsql security definer set search_path = public as $$
declare
  me  public.raktsetu_profiles;
  req public.blood_requests;
begin
  select * into me from public.raktsetu_profiles where user_id = auth.uid();
  if not found then
    raise exception 'Complete your RaktSetu profile first.' using errcode = 'P0001';
  end if;
  if not public.raktsetu_is_eligible_donor(me) then
    raise exception 'You are not currently eligible to donate. Check the eligibility guide on your profile.' using errcode = 'P0001';
  end if;

  select * into req from public.blood_requests where id = p_request_id;
  if not found or req.status <> 'open' or req.needed_by <= now() then
    raise exception 'This request is no longer open.' using errcode = 'P0001';
  end if;
  if req.requester_id = auth.uid() then
    raise exception 'You cannot respond to your own request.' using errcode = 'P0001';
  end if;

  insert into public.request_responses (request_id, responder_id)
  values (p_request_id, auth.uid())
  on conflict (request_id, responder_id) do nothing;

  return query
    select c.contact_phone, req.patient_name
      from public.blood_request_contacts c
     where c.request_id = p_request_id;
end;
$$;

-- For the requester: who offered to help, with the phone each donor chose to
-- share. Nobody else can call this successfully.
create or replace function public.raktsetu_list_responders(p_request_id uuid)
returns table (responder_name text, blood_group text, city text, phone text, responded_at timestamptz, donated_at date)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.blood_requests r
                  where r.id = p_request_id and r.requester_id = auth.uid()) then
    raise exception 'Only the person who posted this request can see who responded.' using errcode = '42501';
  end if;

  return query
    select coalesce(nullif(p.display_name, ''), pr.name, 'Donor'),
           p.blood_group, p.city, p.phone, x.created_at, x.donated_at
      from public.request_responses x
      join public.raktsetu_profiles p on p.user_id = x.responder_id
      left join public.profiles pr on pr.id = x.responder_id
     where x.request_id = p_request_id
     order by x.created_at;
end;
$$;

-- Requester closes their own request.
create or replace function public.raktsetu_set_request_status(p_request_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('fulfilled', 'cancelled') then
    raise exception 'Unsupported status.' using errcode = 'P0001';
  end if;
  update public.blood_requests
     set status = p_status
   where id = p_request_id and requester_id = auth.uid() and status = 'open';
  if not found then
    raise exception 'Only the person who posted an open request can close it.' using errcode = '42501';
  end if;
end;
$$;

-- Donor records that they gave blood; starts the four-month wait.
create or replace function public.raktsetu_mark_donated(p_request_id uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_date is null or p_date > current_date or p_date < current_date - 30 then
    raise exception 'Enter the date you donated (within the last 30 days).' using errcode = 'P0001';
  end if;
  update public.request_responses
     set donated_at = p_date
   where request_id = p_request_id and responder_id = auth.uid();
  if not found then
    raise exception 'You have not responded to this request.' using errcode = '42501';
  end if;
  update public.raktsetu_profiles
     set last_donation_date = greatest(coalesce(last_donation_date, p_date), p_date)
   where user_id = auth.uid();
end;
$$;

-- Admin moderation: remove a request (fake, spam, asks for money).
create or replace function public.raktsetu_admin_remove(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  update public.blood_requests
     set status = 'removed', removed_reason = left(coalesce(p_reason, ''), 300)
   where id = p_request_id;
  update public.blood_request_reports
     set resolved_at = now()
   where request_id = p_request_id and resolved_at is null;
end;
$$;

create or replace function public.raktsetu_admin_dismiss_reports(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  update public.blood_request_reports
     set resolved_at = now()
   where request_id = p_request_id and resolved_at is null;
end;
$$;

-- "Delete my RaktSetu data": profile, push subscriptions, responses, reports
-- and the user's own requests (with their contact numbers). Their DnyanSetu
-- account is untouched.
create or replace function public.raktsetu_delete_my_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where user_id = auth.uid();
  delete from public.request_responses where responder_id = auth.uid();
  delete from public.blood_request_reports where reporter_id = auth.uid();
  delete from public.blood_requests where requester_id = auth.uid();
  delete from public.raktsetu_profiles where user_id = auth.uid();
end;
$$;

-- ---------------------------------------------- server-only (service role)

-- Push goes to everyone opted in within the request's city, plus anyone who
-- asked for all cities. Never the requester.
create or replace function public.raktsetu_push_targets(p_request_id uuid)
returns table (id bigint, endpoint text, keys jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.endpoint, s.keys
    from public.push_subscriptions s
    join public.raktsetu_profiles p on p.user_id = s.user_id
    join public.blood_requests r on r.id = p_request_id
    left join public.profiles pr on pr.id = s.user_id
   where p.notify_push
     and s.user_id is distinct from r.requester_id
     and (p.city_key = r.city_key or p.notify_all_cities)
     and coalesce(pr.restricted, false) = false
$$;

-- Email goes only to eligible donors whose blood group matches exactly, same
-- city first. "Don't know" never matches.
create or replace function public.raktsetu_email_targets(p_request_id uuid)
returns table (user_id uuid, email text, name text, same_city boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id,
         coalesce(nullif(pr.email, ''), u.email),
         coalesce(nullif(p.display_name, ''), pr.name, ''),
         p.city_key = r.city_key
    from public.raktsetu_profiles p
    join public.blood_requests r on r.id = p_request_id
    join auth.users u on u.id = p.user_id
    left join public.profiles pr on pr.id = p.user_id
   where p.notify_email
     and p.blood_group = r.blood_group
     and p.user_id is distinct from r.requester_id
     and public.raktsetu_is_eligible_donor(p)
     and coalesce(pr.restricted, false) = false
     and coalesce(nullif(pr.email, ''), u.email) is not null
   order by (p.city_key = r.city_key) desc, p.updated_at desc
$$;

create or replace function public.raktsetu_log_emails(p_count int)
returns void language sql security definer set search_path = public as $$
  insert into public.raktsetu_email_log (day, sent)
  values ((now() at time zone 'utc')::date, p_count)
  on conflict (day) do update set sent = raktsetu_email_log.sent + excluded.sent
$$;

create or replace function public.raktsetu_email_usage()
returns table (today int, month int)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sent from public.raktsetu_email_log where day = (now() at time zone 'utc')::date), 0),
    coalesce((select sum(sent)::int from public.raktsetu_email_log
               where day >= date_trunc('month', now() at time zone 'utc')::date), 0)
$$;

create or replace function public.raktsetu_expire_requests()
returns int language sql security definer set search_path = public as $$
  with done as (
    update public.blood_requests set status = 'expired'
     where status = 'open' and needed_by <= now()
    returning 1
  )
  select count(*)::int from done
$$;

-- ------------------------------------------------------------------ grants

grant select, insert, update, delete on public.raktsetu_profiles to authenticated;
grant select on public.blood_requests, public.blood_request_contacts, public.request_responses to authenticated;
grant select, insert on public.blood_request_reports to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

do $$
declare fn text;
begin
  -- Callable by signed-in users (each checks auth.uid() itself).
  foreach fn in array array[
    'raktsetu_respond(uuid)',
    'raktsetu_list_responders(uuid)',
    'raktsetu_set_request_status(uuid, text)',
    'raktsetu_mark_donated(uuid, date)',
    'raktsetu_admin_remove(uuid, text)',
    'raktsetu_admin_dismiss_reports(uuid)',
    'raktsetu_delete_my_data()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;

  -- Server only. A browser calling these would learn who matches a request.
  foreach fn in array array[
    'raktsetu_push_targets(uuid)',
    'raktsetu_email_targets(uuid)',
    'raktsetu_log_emails(int)',
    'raktsetu_email_usage()',
    'raktsetu_expire_requests()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;
