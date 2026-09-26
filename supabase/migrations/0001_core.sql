-- ============================================================================
-- DnyanSetu — core schema (replaces Firestore + firestore.rules)
--
-- Run in: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Run 0001 first, then 0002_raktsetu.sql.
--
-- Row Level Security is the only thing protecting this data. The anon key in
-- the browser is public by design and grants nothing on its own — every table
-- below has RLS switched on, and anything without a policy is closed.
--
-- The same guarantees firestore.rules gave:
--   * Only one email address can ever hold the admin role.
--   * A user cannot promote themselves by editing their own profile.
--   * Only faculty and admins can publish notes or question papers.
-- ============================================================================

-- ------------------------------------------------------------------ profiles

create table if not exists public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  role                     text not null default 'student' check (role in ('student', 'faculty', 'admin')),
  name                     text not null default '',
  email                    text not null default '',
  phone                    text not null default '',
  pfp                      text,
  cover                    text,
  tracking_id              text,
  status                   text not null default 'active' check (status in ('active', 'deleted')),
  restricted               boolean not null default false,
  details                  jsonb not null default '{}'::jsonb,
  terms_accepted_at        timestamptz,
  terms_version            text,
  -- Set only by scripts/migrate-firebase-to-supabase.mjs.
  legacy_firebase_uid      text unique,
  -- True until a migrated account has set a Supabase password (see
  -- api/legacy-login.js). Cleared automatically by the trigger further down.
  legacy_password_pending  boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_status_idx on public.profiles (status);

-- The single administrator. Change this address and re-run to move the role;
-- nothing else grants it.
create or replace function public.admin_email()
returns text language sql immutable as $$ select 'smuiqac@gmail.com'::text $$;

-- security definer so the policies below can call these without recursing
-- through the profiles policies themselves.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.restricted = false
      and p.status = 'active'
      and lower(p.email) = public.admin_email()
      and lower(coalesce(auth.jwt() ->> 'email', '')) = public.admin_email()
  );
$$;

create or replace function public.can_publish()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty', 'admin')
      and p.restricted = false
      and p.status = 'active'
  );
$$;

-- Every new auth user gets a profile row straight away, whether they came in
-- through email sign-up, Google, or the Firebase migration script. The role
-- always starts as student; complete_onboarding() below is the only way a user
-- picks faculty, and admin is never granted from here.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Once a migrated account has a Supabase password, the old Firebase password
-- must stop working as a way in.
create or replace function public.handle_password_set()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set legacy_password_pending = false where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_password_set on auth.users;
create trigger on_auth_user_password_set
  after update on auth.users
  for each row execute function public.handle_password_set();

-- Privilege fields must survive a self-update untouched. Server code (service
-- role) and security-definer functions (postgres) are trusted; everyone else
-- goes through this check.
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();

  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  -- Fields nobody edits from the browser, admin included.
  if new.email is distinct from old.email
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.terms_version is distinct from old.terms_version
     or new.legacy_firebase_uid is distinct from old.legacy_firebase_uid
     or new.legacy_password_pending is distinct from old.legacy_password_pending
     or new.created_at is distinct from old.created_at then
    raise exception 'These profile fields cannot be changed here.' using errcode = '42501';
  end if;

  if public.is_admin() then
    -- An admin may change role, status and restriction, but still cannot
    -- invent a new admin: the role is pinned to the authorised address.
    if new.role = 'admin' and lower(old.email) <> public.admin_email() then
      raise exception 'Only the authorised address can hold the admin role.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.restricted is distinct from old.restricted then
    raise exception 'You cannot change your own role or status.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- No insert policy (the trigger creates rows) and no delete policy: accounts
-- are retired by setting status to 'deleted', never removed from the browser.

-- Records terms acceptance, and on a brand-new account lets the user pick
-- student or faculty — the same choice the old sign-up form offered. A migrated
-- account keeps its existing role.
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
                   and role <> 'admin'
                   and p_role in ('student', 'faculty')
                  then p_role
                  else role
                end,
         terms_accepted_at = now(),
         terms_version = left(coalesce(p_terms_version, ''), 40)
   where id = auth.uid();
end;
$$;

-- Stamps the account when it opens the notes library, for the admin desk.
create or replace function public.mark_notes_opened()
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set details = details || jsonb_build_object('notesLastOpenedAt', (extract(epoch from now()) * 1000)::bigint)
   where id = auth.uid();
$$;

-- ------------------------------------------------------------- quiz attempts

create table if not exists public.quiz_attempts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  stream_id     text not null,
  year          int not null,
  subject_id    text not null,
  stage         text not null,
  score         int not null,
  total         int not null,
  passed        boolean not null,
  question_ids  text[] not null default '{}',
  legacy_id     text unique,
  created_at    timestamptz not null default now()
);

create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "attempts: read own or admin" on public.quiz_attempts;
create policy "attempts: read own or admin" on public.quiz_attempts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- An attempt is a record of what happened; it is never edited or deleted.
drop policy if exists "attempts: insert own" on public.quiz_attempts;
create policy "attempts: insert own" on public.quiz_attempts
  for insert to authenticated
  with check (user_id = auth.uid());

-- -------------------------------------------------------------------- notes

create table if not exists public.notes (
  id           text primary key default gen_random_uuid()::text,
  stream_id    text not null,
  subject      text not null check (length(subject) > 0),
  semester     text,
  title        text not null check (length(title) > 0),
  description  text not null default '',
  files        jsonb not null default '[]'::jsonb,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  author_name  text not null default 'Faculty',
  created_at   timestamptz not null default now()
);

create index if not exists notes_stream_idx on public.notes (stream_id);
create index if not exists notes_uploader_idx on public.notes (uploaded_by);

alter table public.notes enable row level security;

-- The library is public, so signed-out students can browse and download.
drop policy if exists "notes: public read" on public.notes;
create policy "notes: public read" on public.notes
  for select to anon, authenticated using (true);

drop policy if exists "notes: faculty insert" on public.notes;
create policy "notes: faculty insert" on public.notes
  for insert to authenticated
  with check (public.can_publish() and uploaded_by = auth.uid());

drop policy if exists "notes: owner or admin update" on public.notes;
create policy "notes: owner or admin update" on public.notes
  for update to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

drop policy if exists "notes: owner or admin delete" on public.notes;
create policy "notes: owner or admin delete" on public.notes
  for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- --------------------------------------------------------------- pyq papers

create table if not exists public.pyq_papers (
  id           text primary key,
  stream_id    text not null,
  subject_id   text not null,
  year         int not null,
  session      text not null,
  file         jsonb not null,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.pyq_papers enable row level security;

drop policy if exists "pyq: public read" on public.pyq_papers;
create policy "pyq: public read" on public.pyq_papers
  for select to anon, authenticated using (true);

drop policy if exists "pyq: faculty write" on public.pyq_papers;
create policy "pyq: faculty write" on public.pyq_papers
  for all to authenticated
  using (public.can_publish())
  with check (public.can_publish());

-- ------------------------------------------------------ admin session lock

-- One administrator window at a time. Only the administrator can touch it.
create table if not exists public.admin_sessions (
  id            text primary key,
  session_id    text not null,
  uid           uuid not null,
  claimed_at    bigint not null,
  heartbeat_at  bigint not null
);

alter table public.admin_sessions enable row level security;

drop policy if exists "admin sessions: admin only" on public.admin_sessions;
create policy "admin sessions: admin only" on public.admin_sessions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------------ grants
-- Explicit, rather than relying on the project's default privileges. RLS
-- still decides which rows each grant actually reaches.

grant select on public.notes, public.pyq_papers to anon;
grant select, update on public.profiles to authenticated;
grant select, insert on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.notes, public.pyq_papers, public.admin_sessions to authenticated;

revoke execute on function public.complete_onboarding(text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text) to authenticated;
revoke execute on function public.mark_notes_opened() from public, anon;
grant execute on function public.mark_notes_opened() to authenticated;
