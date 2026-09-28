-- ============================================================================
-- Scholarship admin: any email, approved by the main administrator
--
-- 0011 tied the scholarship admin role to one fixed Gmail address. Now anyone
-- can sign up on the Staff Login -> Admin -> Scholarship admin tab with their
-- own email and password; the account waits (approval_status = 'pending')
-- until the main administrator approves it on the Approvals page, exactly like
-- faculty and staff. Only one scholarship admin can be approved at a time.
--
-- Run after 0012, in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------ drop the fixed address

drop trigger if exists profiles_guard_scholarship on public.profiles;
drop function if exists public.guard_scholarship_role();

-- New accounts all start as students again; the role is picked at onboarding.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Main admin, or an APPROVED scholarship admin that is not blocked.
create or replace function public.is_content_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'scholarship'
      and p.approval_status = 'approved'
      and p.restricted = false
      and p.status = 'active'
  );
$$;
grant execute on function public.is_content_admin() to anon, authenticated;

-- ------------------------------------------------------------- onboarding

-- A brand-new account may pick scholarship too; like faculty/staff it starts
-- pending, so picking it grants nothing until the administrator approves.
create or replace function public.complete_onboarding(p_role text, p_terms_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  update public.profiles
     set role = case
                  when terms_accepted_at is null
                   and legacy_firebase_uid is null
                   and role not in ('admin', 'scholarship')
                   and p_role in ('student', 'faculty', 'staff', 'scholarship')
                  then p_role
                  else role
                end,
         approval_status = case
                              when terms_accepted_at is null
                               and legacy_firebase_uid is null
                               and role not in ('admin', 'scholarship')
                               and p_role in ('faculty', 'staff', 'scholarship')
                              then 'pending'
                              else approval_status
                            end,
         terms_accepted_at = now(),
         terms_version = left(coalesce(p_terms_version, ''), 40)
   where id = auth.uid();
end;
$$;

-- ------------------------------------------------------------- approvals

create or replace function public.submit_id_proof(p_url text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  update public.profiles
     set id_proof_url = p_url,
         id_proof_note = left(coalesce(p_note, ''), 300),
         approval_status = case when approval_status = 'rejected' then 'pending' else approval_status end
   where id = auth.uid()
     and role in ('faculty', 'staff', 'scholarship');
  if not found then
    raise exception 'Only a faculty, staff or scholarship admin account can submit this.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_review_pending(p_user_id uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  -- One scholarship admin at a time: withdraw the current one first.
  if p_approve and exists (
       select 1 from public.profiles target
        where target.id = p_user_id and target.role = 'scholarship')
     and exists (
       select 1 from public.profiles other
        where other.role = 'scholarship' and other.approval_status = 'approved'
          and other.status = 'active' and other.id <> p_user_id) then
    raise exception 'There is already an approved scholarship admin. Withdraw that approval first.' using errcode = 'P0001';
  end if;
  update public.profiles
     set approval_status = case when p_approve then 'approved' else 'rejected' end,
         id_proof_note = case when p_approve then '' else left(coalesce(p_note, ''), 300) end
   where id = p_user_id
     and role in ('faculty', 'staff', 'scholarship');
  if not found then
    raise exception 'That account is not a faculty, staff or scholarship admin sign-up.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.list_pending_approvals()
returns table (id uuid, name text, email text, role text, id_proof_url text, id_proof_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email, p.role, p.id_proof_url, p.id_proof_note, p.created_at
    from public.profiles p
   where public.is_admin()
     and p.role in ('faculty', 'staff', 'scholarship')
     and p.approval_status = 'pending'
   order by p.created_at asc
$$;

revoke execute on function public.submit_id_proof(text, text) from public, anon;
grant execute on function public.submit_id_proof(text, text) to authenticated;
revoke execute on function public.admin_review_pending(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_pending(uuid, boolean, text) to authenticated;
revoke execute on function public.list_pending_approvals() from public, anon;
grant execute on function public.list_pending_approvals() to authenticated;

-- The login page no longer asks whether the account exists.
drop function if exists public.scholarship_admin_exists();
drop function if exists public.scholarship_admin_email();
