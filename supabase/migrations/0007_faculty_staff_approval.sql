-- ============================================================================
-- Faculty/staff sign-up with admin approval
--
-- Faculty and staff sign up like students (Sign up -> Log in -> accept terms),
-- but land in a "pending approval" state until the administrator reviews an
-- uploaded photo proving they work at the college (an ID card, appointment
-- letter, etc.) and approves the account. Only then do they reach their full
-- portal (photo, name, about, role, and — faculty only — the notes-upload
-- section that already existed).
--
-- Run after 0006, in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- --------------------------------------------------------------- role + status

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'faculty', 'staff', 'admin'));

alter table public.profiles add column if not exists approval_status text not null default 'approved';
alter table public.profiles drop constraint if exists profiles_approval_status_check;
alter table public.profiles add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

alter table public.profiles add column if not exists id_proof_url text;
alter table public.profiles add column if not exists id_proof_note text;

-- ------------------------------------------------------ onboarding: add staff

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
                   and role <> 'admin'
                   and p_role in ('student', 'faculty', 'staff')
                  then p_role
                  else role
                end,
         -- A brand-new faculty/staff account starts pending; everyone else
         -- (student, admin, or an account that already had a role) is
         -- unaffected by this onboarding step.
         approval_status = case
                              when terms_accepted_at is null
                               and legacy_firebase_uid is null
                               and role <> 'admin'
                               and p_role in ('faculty', 'staff')
                              then 'pending'
                              else approval_status
                            end,
         terms_accepted_at = now(),
         terms_version = left(coalesce(p_terms_version, ''), 40)
   where id = auth.uid();
end;
$$;

-- --------------------------------------------------- publishing needs approval

-- Staff never publish notes (a teaching-only feature); faculty need to be
-- admin-approved first, on top of the existing checks.
create or replace function public.can_publish()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.role = 'faculty' and p.approval_status = 'approved')
      )
      and p.restricted != true
  );
$$;

-- --------------------------------------------------------- ID proof + review

-- The pending account submits their own proof; scoped to their own row so
-- this cannot be used to touch anyone else's record.
create or replace function public.submit_id_proof(p_url text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  update public.profiles
     set id_proof_url = p_url,
         id_proof_note = left(coalesce(p_note, ''), 300),
         -- Resubmitting after a rejection puts the account back in the queue.
         approval_status = case when approval_status = 'rejected' then 'pending' else approval_status end
   where id = auth.uid()
     and role in ('faculty', 'staff');
  if not found then
    raise exception 'Only a faculty or staff account can submit this.' using errcode = '42501';
  end if;
end;
$$;

-- Admin-only review. Approving clears any prior rejection note.
create or replace function public.admin_review_pending(p_user_id uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;
  update public.profiles
     set approval_status = case when p_approve then 'approved' else 'rejected' end,
         id_proof_note = case when p_approve then '' else left(coalesce(p_note, ''), 300) end
   where id = p_user_id
     and role in ('faculty', 'staff');
  if not found then
    raise exception 'That account is not a pending faculty or staff sign-up.' using errcode = 'P0001';
  end if;
end;
$$;

-- Everyone waiting on a decision, for the admin desk. No sensitive data
-- beyond what the directory already exposes to the admin.
create or replace function public.list_pending_approvals()
returns table (id uuid, name text, email text, role text, id_proof_url text, id_proof_note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email, p.role, p.id_proof_url, p.id_proof_note, p.created_at
    from public.profiles p
   where public.is_admin()
     and p.role in ('faculty', 'staff')
     and p.approval_status = 'pending'
   order by p.created_at asc
$$;

revoke execute on function public.submit_id_proof(text, text) from public, anon;
grant execute on function public.submit_id_proof(text, text) to authenticated;
revoke execute on function public.admin_review_pending(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_pending(uuid, boolean, text) to authenticated;
revoke execute on function public.list_pending_approvals() from public, anon;
grant execute on function public.list_pending_approvals() to authenticated;
