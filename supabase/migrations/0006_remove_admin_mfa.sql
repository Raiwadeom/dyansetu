-- ============================================================================
-- Revert: admin no longer requires 2-step verification (authenticator app)
--
-- Undoes 0005_admin_mfa.sql. The admin account signs in with just email and
-- password (or Google, locked to the administrator address) again — no
-- 6-digit code required.
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
  );
$$;
