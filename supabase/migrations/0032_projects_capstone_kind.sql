-- Allow the new "Capstone project" type on Student Projects.
-- The kind column only accepted final-year, ojt and mini.

alter table public.student_projects drop constraint if exists student_projects_kind_check;
alter table public.student_projects
  add constraint student_projects_kind_check
  check (kind in ('final-year', 'ojt', 'mini', 'capstone'));
