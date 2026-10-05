-- ============================================================================
-- Faculty-uploaded previous year question papers
--
-- pyq_papers existed since 0001 but nothing used it. Approved faculty (and
-- the administrator) now upload papers from the same dialog as notes; the
-- Question Papers page lists them by branch next to the college archive.
-- Writes are tightened: a teacher adds their own and may delete only their
-- own; the administrator may delete any.
-- ============================================================================

alter table public.pyq_papers alter column id set default gen_random_uuid()::text;
alter table public.pyq_papers alter column subject_id set default '';
alter table public.pyq_papers add column if not exists subject     text not null default '';
alter table public.pyq_papers add column if not exists semester    text not null default '';
alter table public.pyq_papers add column if not exists author_name text not null default 'Faculty';

alter table public.pyq_papers drop constraint if exists pyq_papers_year_check;
alter table public.pyq_papers add constraint pyq_papers_year_check check (year between 1990 and 2100);
alter table public.pyq_papers drop constraint if exists pyq_papers_session_check;
alter table public.pyq_papers add constraint pyq_papers_session_check check (session in ('Summer', 'Winter'));

create index if not exists pyq_papers_stream_idx on public.pyq_papers (stream_id);
create index if not exists pyq_papers_uploader_idx on public.pyq_papers (uploaded_by);

drop policy if exists "pyq: faculty write" on public.pyq_papers;
drop policy if exists "pyq: faculty insert" on public.pyq_papers;
create policy "pyq: faculty insert" on public.pyq_papers for insert to authenticated
  with check (public.can_publish() and uploaded_by = auth.uid());
drop policy if exists "pyq: owner or admin update" on public.pyq_papers;
create policy "pyq: owner or admin update" on public.pyq_papers for update to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());
drop policy if exists "pyq: owner or admin delete" on public.pyq_papers;
create policy "pyq: owner or admin delete" on public.pyq_papers for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());
