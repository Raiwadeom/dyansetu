-- ============================================================================
-- Gmail addresses only
--
-- Every DnyanSetu account (sign-up with email, Continue with Google, or an
-- email change) must be an @gmail.com address. The forms say so first; this
-- trigger is the rule that cannot be skipped (e.g. a work/school Google
-- account, or a direct API call). All 13 accounts were Gmail when added.
-- ============================================================================

create or replace function public.enforce_gmail_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email, '')) !~ '^[a-z0-9.+_-]+@gmail\.com$' then
    raise exception 'Use a proper Gmail ID only (for example yourname@gmail.com).' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_gmail_only() from public, anon, authenticated;

drop trigger if exists enforce_gmail_only on auth.users;
create trigger enforce_gmail_only
  before insert or update of email on auth.users
  for each row execute function public.enforce_gmail_only();
