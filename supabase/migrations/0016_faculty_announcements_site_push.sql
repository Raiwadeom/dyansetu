-- ============================================================================
-- Faculty announcements + DnyanSetu-wide phone notifications
--
-- 1. Approved faculty can post their own home-page announcements (an event,
--    a competition such as Aviskar, an exam notice). They can edit or delete
--    only their own; the administrator can still manage every one.
-- 2. site_push_subscriptions: browsers / installed apps that asked for
--    DnyanSetu notifications (new announcement, scholarship update, new notes).
--    Signed-out visitors may subscribe too. Service role only.
-- 3. push_sent_at markers on announcements, notes and scholarships, claimed by
--    /api/site-push so a notification is sent once (scholarships: at most
--    every 6 hours). Ordinary users can never set or clear them.
-- ============================================================================

-- ------------------------------------------------------------ announcements

alter table public.announcements add column if not exists posted_by uuid references public.profiles (id) on delete set null;
alter table public.announcements add column if not exists author_name text not null default '';
alter table public.announcements add column if not exists category text not null default 'notice';
alter table public.announcements add column if not exists push_sent_at timestamptz;

alter table public.announcements drop constraint if exists announcements_category_check;
alter table public.announcements add constraint announcements_category_check
  check (category in ('notice', 'event', 'competition', 'exam', 'holiday', 'workshop'));

create index if not exists announcements_posted_by_idx on public.announcements (posted_by);

create or replace function public.is_approved_faculty()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty'
      and p.approval_status = 'approved'
      and p.restricted = false
      and p.status = 'active'
  );
$$;
grant execute on function public.is_approved_faculty() to authenticated;

drop policy if exists "announcements: faculty insert own" on public.announcements;
create policy "announcements: faculty insert own" on public.announcements for insert to authenticated
  with check (public.is_approved_faculty() and posted_by = auth.uid() and scholarship_id is null);

drop policy if exists "announcements: faculty update own" on public.announcements;
create policy "announcements: faculty update own" on public.announcements for update to authenticated
  using (public.is_approved_faculty() and posted_by = auth.uid())
  with check (public.is_approved_faculty() and posted_by = auth.uid() and scholarship_id is null);

drop policy if exists "announcements: faculty delete own" on public.announcements;
create policy "announcements: faculty delete own" on public.announcements for delete to authenticated
  using (public.is_approved_faculty() and posted_by = auth.uid());

-- The author's name comes from their profile, never from the form; faculty
-- may post at most 10 announcements a day.
create or replace function public.guard_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.push_sent_at := null;
      new.posted_by := case when public.is_content_admin() then null else auth.uid() end;
      if new.posted_by is not null then
        if (select count(*) from public.announcements a
             where a.posted_by = new.posted_by and a.created_at > now() - interval '1 day') >= 10 then
          raise exception 'You can post at most 10 announcements a day.' using errcode = 'P0001';
        end if;
      end if;
    else
      new.push_sent_at := old.push_sent_at;
      new.posted_by := old.posted_by;
      new.created_at := old.created_at;
    end if;
    if new.posted_by is not null then
      new.author_name := coalesce((select p.name from public.profiles p where p.id = new.posted_by), '');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists announcements_guard on public.announcements;
create trigger announcements_guard before insert or update on public.announcements
  for each row execute function public.guard_announcement();

-- ---------------------------------------------------- notes & scholarships

alter table public.notes add column if not exists push_sent_at timestamptz;
alter table public.scholarships add column if not exists push_sent_at timestamptz;

create or replace function public.guard_push_marker()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then new.push_sent_at := null;
    else new.push_sent_at := old.push_sent_at;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notes_guard_push on public.notes;
create trigger notes_guard_push before insert or update on public.notes
  for each row execute function public.guard_push_marker();
drop trigger if exists scholarships_guard_push on public.scholarships;
create trigger scholarships_guard_push before insert or update on public.scholarships
  for each row execute function public.guard_push_marker();

-- ---------------------------------------------------- site subscriptions

create table if not exists public.site_push_subscriptions (
  id            bigint generated always as identity primary key,
  endpoint      text not null unique,
  keys          jsonb not null,
  user_id       uuid references auth.users (id) on delete set null,
  user_agent    text not null default '',
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

alter table public.site_push_subscriptions enable row level security;
-- No policies: only the service role (the /api functions) reads or writes it.
revoke all on public.site_push_subscriptions from anon, authenticated;
