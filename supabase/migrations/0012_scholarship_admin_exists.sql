-- Whether the scholarship admin account has been created yet. The login page
-- offers "Create the scholarship admin account" only while this is false;
-- afterwards the password can only be changed (Forgot password).
create or replace function public.scholarship_admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where lower(email) = public.scholarship_admin_email());
$$;
revoke execute on function public.scholarship_admin_exists() from public;
grant execute on function public.scholarship_admin_exists() to anon, authenticated;
