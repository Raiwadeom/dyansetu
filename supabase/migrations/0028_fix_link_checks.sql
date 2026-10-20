-- Postgres regular expressions allow at most 255 repetitions, so the old link
-- checks ("{4,500}") failed with "invalid repetition count(s)" the moment a
-- link was saved. Same rule (https only, no spaces, up to 500 characters)
-- written with a length check instead. Applied to student_projects and to the
-- Talent Corner link on posts (0022 had the same mistake).
alter table public.student_projects drop constraint if exists student_projects_live_url_check;
alter table public.student_projects drop constraint if exists student_projects_repo_url_check;
alter table public.student_projects drop constraint if exists student_projects_image_url_check;
alter table public.student_projects add constraint student_projects_live_url_check
  check (char_length(live_url) between 12 and 500 and live_url ~* '^https://[^ ]+$');
alter table public.student_projects add constraint student_projects_repo_url_check
  check (repo_url = '' or (char_length(repo_url) between 12 and 500 and repo_url ~* '^https://[^ ]+$'));
alter table public.student_projects add constraint student_projects_image_url_check
  check (image_url = '' or (char_length(image_url) between 12 and 500 and image_url ~* '^https://[^ ]+$'));

alter table public.talent_posts drop constraint if exists talent_posts_link_url_check;
alter table public.talent_posts add constraint talent_posts_link_url_check
  check (link_url = '' or (char_length(link_url) between 12 and 500 and link_url ~* '^https://[^ ]+$'));
