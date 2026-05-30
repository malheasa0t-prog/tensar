-- Migration: 2026-05-29-03 - SECURITY DEFINER hardening.
--
-- Purpose:
--   1. Lock down enable_realtime_for_table if it exists in an older schema.
--   2. Add an in-body caller check to admin_toggle_customer_status.
--   3. Re-assert service-role-only grants for internal service-order RPCs.
--
-- Idempotent:
--   Uses to_regprocedure for optional functions so this migration is safe
--   across schemas where helper functions were already dropped.

begin;

do $$
begin
  if to_regprocedure('public.enable_realtime_for_table(regclass)') is not null then
    revoke execute on function public.enable_realtime_for_table(regclass)
      from public, anon, authenticated;
    grant execute on function public.enable_realtime_for_table(regclass)
      to service_role;
  end if;
end;
$$;

create or replace function public.admin_toggle_customer_status(
  p_target_user_id text
)
returns table(user_id text, previous_status text, current_status text)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_target text := nullif(trim(coalesce(p_target_user_id, '')), '');
  v_profile public.user_profiles%rowtype;
  v_app_user public.app_users%rowtype;
  v_previous text;
  v_next text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.is_admin_user(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if v_target is null then
    raise exception 'Target user is required';
  end if;

  select * into v_profile
  from public.user_profiles
  where user_id::text = v_target
     or id::text = v_target
     or lower(coalesce(email, '')) = lower(v_target)
  limit 1
  for update;

  if found then
    if public.is_admin_role(v_profile.role) then
      raise exception 'Cannot change status of admin';
    end if;

    v_previous := coalesce(v_profile.status, 'active');
    v_next := case when v_previous = 'active' then 'inactive' else 'active' end;

    update public.user_profiles
    set status = v_next, updated_at = now()
    where id = v_profile.id;

    update public.app_users
    set status = v_next, updated_at = now()
    where auth_user_id = v_profile.user_id
       or lower(coalesce(email, '')) = lower(coalesce(v_profile.email, ''));

    user_id := v_profile.user_id::text;
    previous_status := v_previous;
    current_status := v_next;
    return next;
    return;
  end if;

  select * into v_app_user
  from public.app_users
  where id = v_target
     or auth_user_id::text = v_target
     or lower(coalesce(email, '')) = lower(v_target)
  limit 1
  for update;

  if not found then
    raise exception 'Customer not found';
  end if;

  if public.is_admin_role(v_app_user.role) then
    raise exception 'Cannot change status of admin';
  end if;

  v_previous := coalesce(v_app_user.status, 'active');
  v_next := case when v_previous = 'active' then 'inactive' else 'active' end;

  update public.app_users
  set status = v_next, updated_at = now()
  where id = v_app_user.id;

  user_id := coalesce(v_app_user.auth_user_id::text, v_app_user.id);
  previous_status := v_previous;
  current_status := v_next;
  return next;
end;
$$;

revoke all on function public.admin_toggle_customer_status(text)
  from public, anon, authenticated;
grant execute on function public.admin_toggle_customer_status(text)
  to service_role;

do $$
begin
  if to_regprocedure('public.sync_service_order_status_tx(text,text,text,integer,integer)') is not null then
    revoke execute on function public.sync_service_order_status_tx(text, text, text, integer, integer)
      from public, anon, authenticated;
    grant execute on function public.sync_service_order_status_tx(text, text, text, integer, integer)
      to service_role;
  end if;

  if to_regprocedure('public.release_service_order_wallet(text,text)') is not null then
    revoke execute on function public.release_service_order_wallet(text, text)
      from public, anon, authenticated;
    grant execute on function public.release_service_order_wallet(text, text)
      to service_role;
  end if;

  if to_regprocedure('public.release_service_order_wallet(uuid,text)') is not null then
    revoke execute on function public.release_service_order_wallet(uuid, text)
      from public, anon, authenticated;
    grant execute on function public.release_service_order_wallet(uuid, text)
      to service_role;
  end if;

  if to_regprocedure('public.merge_service_order_metadata(text,jsonb)') is not null then
    revoke execute on function public.merge_service_order_metadata(text, jsonb)
      from public, anon, authenticated;
    grant execute on function public.merge_service_order_metadata(text, jsonb)
      to service_role;
  end if;

  if to_regprocedure('public.merge_service_order_metadata(uuid,jsonb)') is not null then
    revoke execute on function public.merge_service_order_metadata(uuid, jsonb)
      from public, anon, authenticated;
    grant execute on function public.merge_service_order_metadata(uuid, jsonb)
      to service_role;
  end if;
end;
$$;

commit;
