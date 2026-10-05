-- ============================================================================
-- Optional PDF on an announcement
--
-- The administrator, the scholarship admin and approved faculty can attach
-- one PDF (uploaded to Cloudinary through /api/sign-upload) to an
-- announcement; the home page then shows a Download button for it. The
-- existing announcement policies already cover these columns.
-- ============================================================================

alter table public.announcements add column if not exists pdf_url  text not null default '';
alter table public.announcements add column if not exists pdf_name text not null default '';

alter table public.announcements drop constraint if exists announcements_pdf_url_check;
alter table public.announcements add constraint announcements_pdf_url_check
  check (pdf_url = '' or pdf_url ~* '^https://res\.cloudinary\.com/');

alter table public.announcements drop constraint if exists announcements_pdf_name_check;
alter table public.announcements add constraint announcements_pdf_name_check
  check (length(pdf_name) <= 200);
