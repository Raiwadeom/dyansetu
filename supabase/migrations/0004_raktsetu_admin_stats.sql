-- ============================================================================
-- RaktSetu — admin overview numbers
--
-- Run after 0003. Returns counts only (no names, phones or other personal
-- data), and only to the DnyanSetu administrator.
-- ============================================================================

create or replace function public.raktsetu_admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'members',          (select count(*) from public.raktsetu_profiles),
    'eligible_donors',  (select count(*) from public.raktsetu_profiles p where public.raktsetu_is_eligible_donor(p)),
    'push_browsers',    (select count(*) from public.push_subscriptions),
    'requests_open',    (select count(*) from public.blood_requests where status = 'open' and needed_by > now() and not under_review),
    'requests_hidden',  (select count(*) from public.blood_requests where under_review and status = 'open'),
    'requests_fulfilled', (select count(*) from public.blood_requests where status = 'fulfilled'),
    'requests_total',   (select count(*) from public.blood_requests),
    'responses_total',  (select count(*) from public.request_responses),
    'donations_recorded', (select count(*) from public.request_responses where donated_at is not null),
    'reports_pending',  (select count(*) from public.blood_request_reports where resolved_at is null),
    'emails_today',     (select coalesce(sent, 0) from public.raktsetu_email_log where day = (now() at time zone 'utc')::date),
    'emails_month',     (select coalesce(sum(sent), 0) from public.raktsetu_email_log
                          where day >= date_trunc('month', now() at time zone 'utc')::date),
    'donors_by_group',  (select coalesce(jsonb_object_agg(blood_group, n), '{}'::jsonb)
                           from (select blood_group, count(*) n from public.raktsetu_profiles
                                  group by blood_group) g)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.raktsetu_admin_stats() from public, anon;
grant execute on function public.raktsetu_admin_stats() to authenticated;
