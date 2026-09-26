-- ============================================================================
-- Admin requires 2-step verification (authenticator app)
--
-- Run after 0004. From now on every admin permission — reading the user
-- directory, changing roles, moderation, RaktSetu admin numbers — needs a
-- session whose 6-digit authenticator code was checked in this login
-- ("aal2"). A stolen admin password alone is not enough.
--
-- Lost the phone? Supabase dashboard -> Authentication -> Users ->
-- smuiqac@gmail.com -> remove the MFA factor, then set it up again on the
-- next login.
-- ============================================================================

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
      and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );
$$;
