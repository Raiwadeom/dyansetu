-- Feedback hardening: a strict email shape (no ? & % # or quotes, so it can
-- never alter a mailto: link), and the site-wide daily ceiling now stops only
-- anonymous senders, so a flood can never lock out signed-in members.

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
  if v_email <> '' and v_email !~ '^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'That email address does not look right.';
  end if;
  if p_kind not in ('feedback', 'query', 'feature', 'bug') then
    raise exception 'Choose what this message is about.';
  end if;
  if v_uid is not null and (select count(*) from public.feedback where user_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have sent several messages today. Please try again tomorrow.';
  end if;
  if v_email <> '' and (select count(*) from public.feedback where email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have sent several messages today. Please try again tomorrow.';
  end if;
  if v_uid is null and (select count(*) from public.feedback where user_id is null and created_at > now() - interval '1 day') >= 300 then
    raise exception 'We are receiving a lot of messages right now. Please try again later.';
  end if;
  insert into public.feedback (user_id, name, email, kind, message)
  values (v_uid, left(btrim(coalesce(p_name, '')), 80), left(v_email, 120), p_kind, v_msg);
  return true;
end $$;
revoke execute on function public.submit_feedback(text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
