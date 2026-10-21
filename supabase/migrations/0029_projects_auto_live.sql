-- Student projects go live straight away; staff can still hide one afterwards.
create or replace function public.guard_student_project()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if public.is_admin() then v_role := 'admin';
  elsif public.is_approved_faculty() then v_role := 'faculty';
  else v_role := 'student';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.added_by := v_role;
    new.status := 'approved';
    if (select count(*) from public.student_projects
        where owner_id = new.owner_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'You can add up to 10 projects a day. Please try again tomorrow.';
    end if;
  else
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    new.added_by := old.added_by;
    -- A student cannot undo a staff decision (e.g. a hidden project).
    if v_role = 'student' then
      new.status := old.status;
    end if;
  end if;
  return new;
end $$;

update public.student_projects set status = 'approved' where status = 'pending';

-- Lift the restriction on this student so she can sign in and use the site again.
update public.profiles set restricted = false, status = 'active'
 where id = (select id from auth.users where lower(email) = 'adibakhatib07@gmail.com');
