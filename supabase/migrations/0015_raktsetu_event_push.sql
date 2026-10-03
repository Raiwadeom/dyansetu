-- ============================================================================
-- RaktSetu — push for request events, not just new requests
--
--   * A donor taps "I can help"      → the requester gets a push.
--   * The requester closes a request → everyone who offered to help gets a
--     push, so nobody travels to the hospital for blood no longer needed.
--
-- Each marker below is set once, atomically, by the API before it sends, so
-- calling the endpoint again can never push the same event twice.
-- ============================================================================

alter table public.request_responses
  add column if not exists requester_notified_at timestamptz;

alter table public.blood_requests
  add column if not exists close_notified_at timestamptz;

-- Every browser of one account that still wants push (account switch on,
-- account not restricted). Service role only.
create or replace function public.raktsetu_user_push_targets(p_user_ids uuid[])
returns table (id bigint, endpoint text, keys jsonb)
language sql stable security definer set search_path = public as $$
  select s.id, s.endpoint, s.keys
    from public.push_subscriptions s
    join public.raktsetu_profiles p on p.user_id = s.user_id
    left join public.profiles pr on pr.id = s.user_id
   where s.user_id = any (p_user_ids)
     and p.notify_push
     and coalesce(pr.restricted, false) = false
$$;

revoke all on function public.raktsetu_user_push_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.raktsetu_user_push_targets(uuid[]) to service_role;
