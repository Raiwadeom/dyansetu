-- ============================================================================
-- RaktSetu — misuse protection, consent records, retention, admin log
--
-- Run after 0002_raktsetu.sql, in the Supabase SQL Editor. Safe to re-run.
--
--   * Payment words (UPI, GPay, ₹, account number …) are refused in requests.
--   * "I can help" is limited to 10 reveals per person per 24 hours, so
--     nobody can harvest phone numbers.
--   * A request reported by 3 different people is hidden until reviewed.
--   * Requests from accounts less than a day old carry a "new member" flag.
--   * Each RaktSetu profile records which version of the consent it agreed to.
--   * Contact numbers of closed requests are erased after 30 days; profiles
--     untouched for 12 months are deleted (run daily by /api/cron/daily).
--   * Every moderation action is written to an admin log.
-- ============================================================================

-- --------------------------------------------------------------- columns

alter table public.raktsetu_profiles add column if not exists consent_version text;

alter table public.blood_requests add column if not exists new_member boolean not null default false;
alter table public.blood_requests add column if not exists under_review boolean not null default false;

-- ------------------------------------------------------ payment-word filter

-- Kept in one place; the API and the form check the same words first so the
-- user sees a friendly message, but this is what actually refuses them.
create or replace function public.raktsetu_has_payment_words(p_text text)
returns boolean language sql immutable as $$
  select coalesce(p_text, '') ~* (
    '(\mupi\M|\mg ?pay\M|google ?pay|\mphone ?pe\M|paytm|₹|\mrupees?\M|\mrs\.? ?[0-9]|\minr\M|\mifsc\M|'
    || '\maccount ?(no|number|num)\M|bank ?details|\mpayments?\M|send ?money|transfer ?money|'
    || 'processing ?fee|service ?charge|donation ?fee|\mprice\M|cost of blood)'
  )
$$;

create or replace function public.raktsetu_block_payment_words()
returns trigger language plpgsql as $$
begin
  if public.raktsetu_has_payment_words(new.patient_name || ' ' || new.hospital || ' ' || new.address || ' ' || new.note) then
    raise exception 'Requests cannot mention money, payment or bank details. Blood is never paid for through RaktSetu.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists blood_requests_no_payment on public.blood_requests;
create trigger blood_requests_no_payment
  before insert or update of patient_name, hospital, address, note on public.blood_requests
  for each row execute function public.raktsetu_block_payment_words();

-- --------------------------------------------------------- visibility rule

-- Same as before, plus: a request under review is hidden from everyone except
-- its owner, the admin, and donors who already responded.
create or replace function public.raktsetu_can_see_request(r public.blood_requests)
returns boolean language sql stable security definer set search_path = public as $$
  select (r.status = 'open' and r.needed_by > now() and not r.under_review)
      or r.requester_id = auth.uid()
      or public.is_admin()
      or exists (select 1 from public.request_responses x
                  where x.request_id = r.id and x.responder_id = auth.uid())
$$;

-- ------------------------------------------------------- auto-hide on reports

create or replace function public.raktsetu_auto_hide()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct reporter_id) from public.blood_request_reports
       where request_id = new.request_id and resolved_at is null) >= 3 then
    update public.blood_requests set under_review = true where id = new.request_id and not under_review;
  end if;
  return new;
end;
$$;

drop trigger if exists blood_request_reports_auto_hide on public.blood_request_reports;
create trigger blood_request_reports_auto_hide
  after insert on public.blood_request_reports
  for each row execute function public.raktsetu_auto_hide();

-- ------------------------------------------------------------- admin log

create table if not exists public.raktsetu_admin_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  request_id  uuid,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.raktsetu_admin_log enable row level security;

drop policy if exists "admin log: admin read" on public.raktsetu_admin_log;
create policy "admin log: admin read" on public.raktsetu_admin_log
  for select to authenticated using (public.is_admin());
-- Written only by the functions below; no insert policy.

grant select on public.raktsetu_admin_log to authenticated;

-- ------------------------------------------------- "I can help" with a limit

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
  if not found or req.status <> 'open' or req.needed_by <= now() or req.under_review then
    raise exception 'This request is no longer open.' using errcode = 'P0001';
  end if;
  if req.requester_id = auth.uid() then
    raise exception 'You cannot respond to your own request.' using errcode = 'P0001';
  end if;

  -- Anti-harvesting: at most 10 new contact reveals in 24 hours.
  if not exists (select 1 from public.request_responses
                  where request_id = p_request_id and responder_id = auth.uid())
     and (select count(*) from public.request_responses
           where responder_id = auth.uid() and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have offered help on 10 requests in the last 24 hours. Please try again tomorrow.' using errcode = 'P0001';
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

-- ------------------------------------------------ moderation, now logged

create or replace function public.raktsetu_admin_remove(p_request_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  update public.blood_requests
     set status = 'removed', under_review = false, removed_reason = left(coalesce(p_reason, ''), 300)
   where id = p_request_id;
  update public.blood_request_reports
     set resolved_at = now()
   where request_id = p_request_id and resolved_at is null;
  insert into public.raktsetu_admin_log (admin_id, action, request_id, reason)
  values (auth.uid(), 'remove_request', p_request_id, left(coalesce(p_reason, ''), 300));
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
  -- Reviewed and found fine: show it again.
  update public.blood_requests set under_review = false where id = p_request_id;
  insert into public.raktsetu_admin_log (admin_id, action, request_id)
  values (auth.uid(), 'dismiss_reports', p_request_id);
end;
$$;

-- ------------------------------------------------------------- retention

-- Run daily by /api/cron/daily. Returns what it removed.
create or replace function public.raktsetu_retention()
returns table (contacts_erased int, profiles_deleted int)
language plpgsql security definer set search_path = public as $$
declare
  n_contacts int;
  n_profiles int;
  stale uuid[];
begin
  delete from public.blood_request_contacts c
   using public.blood_requests r
   where r.id = c.request_id
     and (r.status <> 'open' or r.needed_by <= now())
     and greatest(r.updated_at, r.needed_by) < now() - interval '30 days';
  get diagnostics n_contacts = row_count;

  select coalesce(array_agg(user_id), '{}') into stale
    from public.raktsetu_profiles
   where updated_at < now() - interval '12 months';

  delete from public.push_subscriptions where user_id = any (stale);
  delete from public.raktsetu_profiles where user_id = any (stale);
  get diagnostics n_profiles = row_count;

  return query select n_contacts, n_profiles;
end;
$$;

revoke execute on function public.raktsetu_retention() from public, anon, authenticated;
grant execute on function public.raktsetu_retention() to service_role;

-- Push/email targets must skip hidden requests too (a request can be hidden
-- before a re-send; today alerts go out only at creation, but keep it safe).
create or replace function public.raktsetu_push_targets(p_request_id uuid)
returns table (id bigint, endpoint text, keys jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.endpoint, s.keys
    from public.push_subscriptions s
    join public.raktsetu_profiles p on p.user_id = s.user_id
    join public.blood_requests r on r.id = p_request_id
    left join public.profiles pr on pr.id = s.user_id
   where p.notify_push
     and not r.under_review
     and s.user_id is distinct from r.requester_id
     and (p.city_key = r.city_key or p.notify_all_cities)
     and coalesce(pr.restricted, false) = false
$$;

revoke execute on function public.raktsetu_push_targets(uuid) from public, anon, authenticated;
grant execute on function public.raktsetu_push_targets(uuid) to service_role;
