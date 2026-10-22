-- ============================================================================
-- Feedback: queries, feature requests, bug reports and general feedback
--
-- Anyone (signed in or not) can send one from the bottom of the landing page
-- through submit_feedback(); the browser never writes to the table directly.
-- Only the administrator can read, mark or delete them.
-- ============================================================================

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  name       text not null default '' check (char_length(name) <= 80),
  email      text not null default '' check (char_length(email) <= 120),
  kind       text not null default 'feedback' check (kind in ('feedback', 'query', 'feature', 'bug')),
  message    text not null check (char_length(btrim(message)) between 10 and 1000),
  status     text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

drop policy if exists "feedback: admin read" on public.feedback;
create policy "feedback: admin read" on public.feedback for select to authenticated using (public.is_admin());
drop policy if exists "feedback: admin update" on public.feedback;
create policy "feedback: admin update" on public.feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "feedback: admin delete" on public.feedback;
create policy "feedback: admin delete" on public.feedback for delete to authenticated using (public.is_admin());

grant select, delete on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;

create or replace function public.submit_feedback(p_name text, p_email text, p_kind text, p_message text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_msg   text := btrim(coalesce(p_message, ''));
begin
  if char_length(v_msg) < 10 or char_length(v_msg) > 1000 then
    raise exception 'Please write between 10 and 1000 characters.';
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address does not look right.';
  end if;
  if p_kind not in ('feedback', 'query', 'feature', 'bug') then
    raise exception 'Choose what this message is about.';
  end if;
  -- Flood guard: a few per person per day, and a ceiling for the whole site.
  if v_uid is not null and (select count(*) from public.feedback
      where user_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have sent several messages today. Please try again tomorrow.';
  end if;
  if v_email <> '' and (select count(*) from public.feedback
      where email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have sent several messages today. Please try again tomorrow.';
  end if;
  if (select count(*) from public.feedback where created_at > now() - interval '1 day') >= 300 then
    raise exception 'We are receiving a lot of messages right now. Please try again later.';
  end if;
  insert into public.feedback (user_id, name, email, kind, message)
  values (v_uid, left(btrim(coalesce(p_name, '')), 80), left(v_email, 120), p_kind, v_msg);
  return true;
end $$;
revoke execute on function public.submit_feedback(text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text) to anon, authenticated;
