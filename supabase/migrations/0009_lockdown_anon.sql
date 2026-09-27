-- ============================================================================
-- Defence in depth. Row Level Security already blocks these, but signed-out
-- visitors (anon) never need to write anything, and trigger functions are
-- never meant to be called directly.
-- ============================================================================

revoke insert, update, delete, truncate on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_password_set() from public, anon, authenticated;
revoke execute on function public.raktsetu_auto_hide() from public, anon, authenticated;
