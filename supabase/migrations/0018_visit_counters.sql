-- ============================================================================
-- Footer visitor counters (DnyanSetu and RaktSetu)
--
-- One running total per site, ticked once per page load — the same rule as
-- the counter on csmnewsdesk.com. Browsers never touch the table directly:
-- register_visit() adds one and hands back the new total, nothing else.
-- ============================================================================

create table if not exists public.site_visits (
  site        text primary key check (site in ('dnyansetu', 'raktsetu')),
  count       bigint not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.site_visits enable row level security;
-- No policies: no direct reads or writes from the browser.
revoke all on public.site_visits from anon, authenticated;

insert into public.site_visits (site) values ('dnyansetu'), ('raktsetu')
on conflict (site) do nothing;

create or replace function public.register_visit(p_site text)
returns bigint language sql volatile security definer set search_path = public as $$
  update public.site_visits
     set count = count + 1, updated_at = now()
   where site = p_site
  returning count;
$$;

revoke execute on function public.register_visit(text) from public;
grant execute on function public.register_visit(text) to anon, authenticated;
