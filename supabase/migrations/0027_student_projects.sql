-- ============================================================================
-- Student Projects — final-year, OJT and mini projects shared with everyone
--
-- Anyone (signed in or not) can read APPROVED projects. A signed-in, active
-- student may add one; it stays "pending" until the administrator or an
-- approved faculty member approves it. Faculty and the administrator add
-- projects that are approved straight away. The owner, the administrator and
-- approved faculty may edit or delete. Blocking an account hides its projects.
-- ============================================================================

create or replace function public.projects_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_approved_faculty()
$$;
grant execute on function public.projects_staff() to authenticated;

create or replace function public.projects_can_post()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active' and p.restricted = false
      and ((p.role = 'student') or (p.role = 'faculty' and p.approval_status = 'approved'))
  )
$$;
grant execute on function public.projects_can_post() to authenticated;

create table if not exists public.student_projects (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  added_by     text not null default 'student' check (added_by in ('student', 'faculty', 'admin')),
  kind         text not null default 'final-year' check (kind in ('final-year', 'ojt', 'mini')),
  title        text not null check (char_length(btrim(title)) between 3 and 100),
  description  text not null check (char_length(btrim(description)) between 20 and 400),
  students     text not null check (char_length(btrim(students)) between 2 and 200),
  stream       text not null check (char_length(stream) between 1 and 40),
  class_name   text not null default '' check (char_length(class_name) <= 40),
  academic_year text not null default '' check (char_length(academic_year) <= 12),
  guide        text not null default '' check (char_length(guide) <= 80),
  tech         text not null default '' check (char_length(tech) <= 120),
  live_url     text not null check (char_length(live_url) between 12 and 500 and live_url ~* '^https://[^ ]+$'),
  repo_url     text not null default '' check (repo_url = '' or (char_length(repo_url) between 12 and 500 and repo_url ~* '^https://[^ ]+$')),
  image_url    text not null default '' check (image_url = '' or (char_length(image_url) between 12 and 500 and image_url ~* '^https://[^ ]+$')),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now()
);

create index if not exists student_projects_status_idx on public.student_projects (status, created_at desc);
create index if not exists student_projects_owner_idx on public.student_projects (owner_id);

alter table public.student_projects enable row level security;

drop policy if exists "projects: read" on public.student_projects;
create policy "projects: read" on public.student_projects for select to anon, authenticated
  using (
    (status = 'approved' and public.talent_member_ok(owner_id))
    or owner_id = auth.uid()
    or public.projects_staff()
  );

drop policy if exists "projects: insert" on public.student_projects;
create policy "projects: insert" on public.student_projects for insert to authenticated
  with check (owner_id = auth.uid() and public.projects_can_post());

drop policy if exists "projects: update" on public.student_projects;
create policy "projects: update" on public.student_projects for update to authenticated
  using (owner_id = auth.uid() or public.projects_staff())
  with check (owner_id = auth.uid() or public.projects_staff());

drop policy if exists "projects: delete" on public.student_projects;
create policy "projects: delete" on public.student_projects for delete to authenticated
  using (owner_id = auth.uid() or public.projects_staff());

grant select on public.student_projects to anon, authenticated;
grant insert, update, delete on public.student_projects to authenticated;

-- Who added it and whether it needs review are decided here, never by the page.
create or replace function public.guard_student_project()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if public.is_admin() then v_role := 'admin';
  elsif public.is_approved_faculty() then v_role := 'faculty';
  else v_role := 'student';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.added_by := v_role;
    new.status := case when v_role = 'student' then 'pending' else 'approved' end;
    if (select count(*) from public.student_projects
        where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'You can add up to 10 projects a day. Please try again tomorrow.';
    end if;
  else
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    new.added_by := old.added_by;
    -- A student's edit goes back for review; staff decisions stand.
    if v_role = 'student' then
      new.status := 'pending';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_student_project on public.student_projects;
create trigger guard_student_project before insert or update on public.student_projects
  for each row execute function public.guard_student_project();
revoke execute on function public.guard_student_project() from public, anon, authenticated;

revoke insert, update, delete, truncate on public.student_projects from anon;
revoke truncate on public.student_projects from authenticated;
