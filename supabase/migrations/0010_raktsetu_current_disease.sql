-- RaktSetu profile: "Do you currently have any disease or health condition?"
-- Yes/No, and when Yes, the donor writes what it is. A "Yes" keeps the person
-- out of donor matching (they can still post requests); the blood bank still
-- does its own screening before any donation.

alter table public.raktsetu_profiles
  add column if not exists has_current_disease boolean,
  add column if not exists current_disease text not null default ''
    check (length(current_disease) <= 300);

alter table public.raktsetu_profiles drop constraint if exists raktsetu_profiles_disease_detail;
alter table public.raktsetu_profiles add constraint raktsetu_profiles_disease_detail
  check (has_current_disease is not true or length(trim(current_disease)) >= 2);

create or replace function public.raktsetu_is_eligible_donor(p public.raktsetu_profiles)
returns boolean language sql stable as $$
  select p.age between 18 and 65
     and p.weight_kg >= 45
     and p.health_declared
     and p.has_current_disease is not true
     and (p.last_donation_date is null
          or p.last_donation_date <= current_date - public.raktsetu_donation_gap_days())
$$;

-- Admin: every RaktSetu member with their current-disease answer and whether
-- they can donate right now. No phone numbers. Administrator only.
create or replace function public.raktsetu_admin_members()
returns table (
  user_id uuid, name text, email text, blood_group text, city text, age int,
  has_current_disease boolean, current_disease text, eligible boolean, updated_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  return query
    select p.user_id,
           coalesce(nullif(trim(p.display_name), ''), pr.name, '')::text,
           coalesce(pr.email, '')::text,
           p.blood_group, p.city, p.age,
           p.has_current_disease, p.current_disease,
           public.raktsetu_is_eligible_donor(p),
           p.updated_at
      from public.raktsetu_profiles p
      left join public.profiles pr on pr.id = p.user_id
     order by p.has_current_disease is true desc, p.updated_at desc;
end;
$$;

revoke execute on function public.raktsetu_admin_members() from public, anon;
grant execute on function public.raktsetu_admin_members() to authenticated;
