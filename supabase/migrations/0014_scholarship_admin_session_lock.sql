-- ============================================================================
-- Scholarship admin: open in one place at a time, like the main admin
--
-- The lock lives in admin_sessions (0001). The main admin keeps row 'current';
-- the approved scholarship admin may read/write only row 'scholarship'.
-- Run after 0013, in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

drop policy if exists "admin sessions: scholarship admin row" on public.admin_sessions;
create policy "admin sessions: scholarship admin row" on public.admin_sessions
  for all to authenticated
  using (id = 'scholarship' and public.is_content_admin())
  with check (id = 'scholarship' and public.is_content_admin());
