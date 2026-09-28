-- ============================================================================
-- Scholarships and home-page announcements, editable by the administrator
--
-- Until now both lived in the code (src/data/resources.js, NOTICE_BOARD in
-- App.jsx), so every change needed a developer. Now the administrator edits
-- them from the "Scholarships & Notices" admin page. Everyone (signed in or
-- not) can read them; only the administrator can write.
-- The code keeps its copy as a fallback if these tables cannot be reached.
-- ============================================================================

-- ------------------------------------------------ scholarship admin account

-- The scholarship in-charge: a second fixed account that can edit only the
-- scholarships and announcements. Change the address here to move the role.
create or replace function public.scholarship_admin_email()
returns text language sql immutable as $$ select 'smuscholarship2007p@gmail.com'::text $$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'faculty', 'staff', 'admin', 'scholarship'));

-- Main admin, or the scholarship admin signed in with that exact address.
create or replace function public.is_content_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'scholarship'
      and p.restricted = false
      and p.status = 'active'
      and lower(p.email) = public.scholarship_admin_email()
      and lower(coalesce(auth.jwt() ->> 'email', '')) = public.scholarship_admin_email()
  );
$$;
grant execute on function public.is_content_admin() to anon, authenticated;

-- New accounts: that one address becomes the scholarship admin, everyone
-- else starts as a student exactly as before.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    case when lower(coalesce(new.email, '')) = public.scholarship_admin_email() then 'scholarship' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- If the account already exists, give it the role now.
update public.profiles set role = 'scholarship', approval_status = 'approved'
 where lower(email) = public.scholarship_admin_email() and role <> 'admin';

-- Onboarding must not turn the scholarship admin back into a student.
create or replace function public.complete_onboarding(p_role text, p_terms_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  update public.profiles
     set role = case
                  when terms_accepted_at is null
                   and legacy_firebase_uid is null
                   and role not in ('admin', 'scholarship')
                   and p_role in ('student', 'faculty', 'staff')
                  then p_role
                  else role
                end,
         approval_status = case
                              when terms_accepted_at is null
                               and legacy_firebase_uid is null
                               and role not in ('admin', 'scholarship')
                               and p_role in ('faculty', 'staff')
                              then 'pending'
                              else approval_status
                            end,
         terms_accepted_at = now(),
         terms_version = left(coalesce(p_terms_version, ''), 40)
   where id = auth.uid();
end;
$$;

-- The main admin cannot hand the scholarship role to any other address.
create or replace function public.guard_scholarship_role()
returns trigger language plpgsql as $$
begin
  if new.role = 'scholarship' and lower(new.email) <> public.scholarship_admin_email() then
    raise exception 'Only the scholarship admin address can hold that role.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_scholarship on public.profiles;
create trigger profiles_guard_scholarship before insert or update on public.profiles
  for each row execute function public.guard_scholarship_role();

-- ------------------------------------------------------------------- tables

create table if not exists public.scholarships (
  id              text primary key check (id ~ '^[a-z0-9-]{2,80}$'),
  name            text not null check (length(trim(name)) between 2 and 200),
  name_mr         text not null default '',
  provider        text not null default '',
  provider_mr     text not null default '',
  categories      text[] not null default '{}',
  amount          text not null default '',
  amount_mr       text not null default '',
  time_window     text not null default '',
  time_window_mr  text not null default '',
  eligibility     text not null default '',
  eligibility_mr  text not null default '',
  -- [{ "en": "...", "mr": "..." }, ...] — the documents list, in order.
  documents       jsonb not null default '[]'::jsonb check (jsonb_typeof(documents) = 'array'),
  note            text not null default '',
  note_mr         text not null default '',
  portal          text not null default '' check (portal = '' or portal ~* '^https?://'),
  opens_on        date,
  closes_on       date,
  active          boolean not null default true,
  sort            int not null default 100,
  updated_at      timestamptz not null default now(),
  check (opens_on is null or closes_on is null or closes_on >= opens_on)
);

create table if not exists public.announcements (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) between 3 and 300),
  title_mr        text not null default '' check (length(title_mr) <= 300),
  notice_date     date not null default current_date,
  href            text not null default '' check (href = '' or href ~* '^(https?://|/)'),
  -- Hidden from the home page after this day (optional).
  expires_on      date,
  -- Set when the announcement was made from a scholarship's dates; one each.
  scholarship_id  text references public.scholarships (id) on delete cascade,
  created_at      timestamptz not null default now()
);

create unique index if not exists announcements_one_per_scholarship
  on public.announcements (scholarship_id) where scholarship_id is not null;

drop trigger if exists scholarships_touch on public.scholarships;
create trigger scholarships_touch before update on public.scholarships
  for each row execute function public.raktsetu_touch();

alter table public.scholarships enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "scholarships: read all" on public.scholarships;
create policy "scholarships: read all" on public.scholarships for select to anon, authenticated using (true);
drop policy if exists "scholarships: admin writes" on public.scholarships;
create policy "scholarships: admin writes" on public.scholarships for all to authenticated
  using (public.is_content_admin()) with check (public.is_content_admin());

drop policy if exists "announcements: read all" on public.announcements;
create policy "announcements: read all" on public.announcements for select to anon, authenticated using (true);
drop policy if exists "announcements: admin writes" on public.announcements;
create policy "announcements: admin writes" on public.announcements for all to authenticated
  using (public.is_content_admin()) with check (public.is_content_admin());

grant select on public.scholarships, public.announcements to anon, authenticated;
grant insert, update, delete on public.scholarships, public.announcements to authenticated;
revoke insert, update, delete, truncate on public.scholarships, public.announcements from anon;
