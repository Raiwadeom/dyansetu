-- ============================================================================
-- Lock the approval fields added in 0007.
--
-- Without this, the "update own row" policy would let a pending faculty/staff
-- account mark itself approved with a direct table write. Only the security
-- definer RPCs (which run as the function owner) and the admin may change
-- approval_status / id_proof_url / id_proof_note.
-- ============================================================================

create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();

  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if new.email is distinct from old.email
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.terms_version is distinct from old.terms_version
     or new.legacy_firebase_uid is distinct from old.legacy_firebase_uid
     or new.legacy_password_pending is distinct from old.legacy_password_pending
     or new.created_at is distinct from old.created_at then
    raise exception 'These profile fields cannot be changed here.' using errcode = '42501';
  end if;

  if public.is_admin() then
    if new.role = 'admin' and lower(old.email) <> public.admin_email() then
      raise exception 'Only the authorised address can hold the admin role.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.restricted is distinct from old.restricted
     or new.approval_status is distinct from old.approval_status
     or new.id_proof_url is distinct from old.id_proof_url
     or new.id_proof_note is distinct from old.id_proof_note then
    raise exception 'You cannot change your own role or status.' using errcode = '42501';
  end if;

  return new;
end;
$$;
