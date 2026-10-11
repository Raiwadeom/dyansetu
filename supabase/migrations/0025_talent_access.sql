-- ============================================================================
-- Talent Corner — posting needs the administrator's approval
--
-- A student who wants to post first sends a request: a photo of their college
-- ID card plus ticking the community guidelines. The request waits as
-- 'pending' until the administrator approves or rejects it (with a note).
-- Only an approved student may post (talent_can_post() now checks this);
-- reading, liking, commenting and following are unchanged.
-- Students who had already posted before this change are approved as-is.
-- ============================================================================

create table if not exists public.talent_access (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  id_card_url             text,
  guidelines_accepted_at  timestamptz,
  status                  text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note                    text not null default '',
  created_at              timestamptz not null default now(),
  reviewed_at             timestamptz,
  reviewed_by             uuid
);
alter table public.talent_access enable row level security;

-- Students read their own request; the administrator reads all.
-- All writes go through the functions below (no direct insert/update).
drop policy if exists "talent access: own or admin read" on public.talent_access;
create policy "talent access: own or admin read" on public.talent_access for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke all on public.talent_access from anon;
grant select on public.talent_access to authenticated;

-- Existing posters keep posting.
insert into public.talent_access (user_id, status, guidelines_accepted_at, reviewed_at, note)
select distinct author_id, 'approved', now(), now(), 'Approved automatically (posted before approvals started).'
  from public.talent_posts
on conflict (user_id) do nothing;

-- Posting now also needs an approved request.
create or replace function public.talent_can_post()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
      join public.talent_access a on a.user_id = p.id and a.status = 'approved'
    where p.id = auth.uid() and p.role = 'student' and p.status = 'active' and p.restricted = false
  )
$$;

-- A student sends (or re-sends after a rejection) their request.
create or replace function public.talent_request_access(p_id_card_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.status = 'active' and p.restricted = false
  ) then
    raise exception 'Only an active student account can ask to post in the Talent Corner.' using errcode = '42501';
  end if;
  if coalesce(p_id_card_url, '') !~ '^https://res\.cloudinary\.com/' then
    raise exception 'Please upload a photo of your college ID card.' using errcode = 'P0001';
  end if;
  insert into public.talent_access (user_id, id_card_url, guidelines_accepted_at, status, note, created_at, reviewed_at, reviewed_by)
  values (auth.uid(), p_id_card_url, now(), 'pending', '', now(), null, null)
  on conflict (user_id) do update
     set id_card_url = excluded.id_card_url,
         guidelines_accepted_at = now(),
         status = 'pending',
         note = '',
         created_at = now(),
         reviewed_at = null,
         reviewed_by = null
   where public.talent_access.status <> 'approved';
end;
$$;

-- Administrator approves or rejects (a rejection can carry a short note).
create or replace function public.talent_review_access(p_user_id uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  update public.talent_access
     set status = case when p_approve then 'approved' else 'rejected' end,
         note = case when p_approve then '' else left(coalesce(p_note, ''), 300) end,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where user_id = p_user_id;
  if not found then
    raise exception 'That request no longer exists.' using errcode = 'P0001';
  end if;
end;
$$;

-- Waiting requests for the admin desk, oldest first.
create or replace function public.list_talent_requests()
returns table (user_id uuid, name text, email text, stream text, id_card_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.user_id, p.name, p.email, coalesce(p.details->>'stream', ''), a.id_card_url, a.created_at
    from public.talent_access a
    join public.profiles p on p.id = a.user_id
   where public.is_admin() and a.status = 'pending'
   order by a.created_at asc
$$;

revoke execute on function public.talent_request_access(text) from public, anon;
grant execute on function public.talent_request_access(text) to authenticated;
revoke execute on function public.talent_review_access(uuid, boolean, text) from public, anon;
grant execute on function public.talent_review_access(uuid, boolean, text) to authenticated;
revoke execute on function public.list_talent_requests() from public, anon;
grant execute on function public.list_talent_requests() to authenticated;
