-- ============================================================================
-- 2026-05-30-05  Staff permissions foundation
-- ----------------------------------------------------------------------------
-- Adds a granular, per-section staff permission system so an admin can promote
-- a customer to a staff member (employee/technician) and grant/revoke exactly
-- which dashboard sections they may VIEW or MANAGE.
--
-- Security model:
--   * super_admin / admin  -> full panel access (cannot be limited).
--   * employee / technician -> ONLY the sections explicitly granted in
--                              public.staff_permissions.
--   * Enforcement happens at the service-role admin proxy (/api/admin/db). The
--     proxy is the trust boundary; it authorizes the request, then enforces the
--     per-section grant before forwarding the operation.
--
-- IMPORTANT: is_admin_role is tightened to (super_admin, admin) ONLY. Previously
-- it also counted technician/employee, which would have let a staff member with
-- a valid JWT bypass the proxy and query tables directly via RLS
-- (is_current_admin). Staff now have no blanket RLS access; they depend entirely
-- on the proxy + their grants. The privileged money/role RPCs are relaxed to
-- accept the proxy's service-role calls on behalf of staff (they are EXECUTE-
-- granted to service_role only, so staff cannot invoke them directly).
-- ============================================================================

begin;

-- 1) Tighten the admin predicate -----------------------------------------------
create or replace function public.is_admin_role(p_role text)
  returns boolean
  language sql
  immutable
  set search_path to 'public'
as $$
  select lower(coalesce(p_role, '')) in ('super_admin', 'admin');
$$;

-- 2) Panel-staff predicate (admins + granular staff) ---------------------------
create or replace function public.is_panel_staff(p_user_id uuid)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public', 'auth'
as $$
declare
  v_role text;
  v_email text;
begin
  if p_user_id is null then
    return false;
  end if;

  select role into v_role
  from public.user_profiles
  where user_id = p_user_id and coalesce(status, 'active') = 'active'
  limit 1;
  if lower(coalesce(v_role, '')) in ('super_admin', 'admin', 'employee', 'technician') then
    return true;
  end if;

  select lower(coalesce(email, '')) into v_email
  from auth.users where id = p_user_id limit 1;

  if v_email <> '' then
    select role into v_role
    from public.app_users
    where lower(coalesce(email, '')) = v_email and coalesce(status, 'active') = 'active'
    limit 1;
    if lower(coalesce(v_role, '')) in ('super_admin', 'admin', 'employee', 'technician') then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- 3) Shared authz guard for privileged RPCs reached through the proxy ----------
-- Direct authenticated call -> caller must be panel staff. Service-role proxy
-- call (auth.uid() is null) -> trust the proxy but require the recorded actor to
-- be a real staff member, so audit attribution cannot point at a non-staff id.
create or replace function public.assert_panel_rpc_actor(p_actor_id uuid)
  returns void
  language plpgsql
  stable
  security definer
  set search_path to 'public', 'auth'
as $$
begin
  if auth.uid() is not null then
    if not public.is_panel_staff(auth.uid()) then
      raise exception 'Not authorized';
    end if;
  else
    if not public.is_panel_staff(p_actor_id) then
      raise exception 'Not authorized';
    end if;
  end if;
end;
$$;

-- 4) staff_permissions table ---------------------------------------------------
create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  can_view boolean not null default true,
  can_manage boolean not null default false,
  granted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, section)
);
create index if not exists idx_staff_permissions_user on public.staff_permissions(user_id);

drop trigger if exists trg_staff_permissions_updated on public.staff_permissions;
create trigger trg_staff_permissions_updated
  before update on public.staff_permissions
  for each row execute function public.set_updated_at_now();

alter table public.staff_permissions enable row level security;

drop policy if exists staff_perm_self_read on public.staff_permissions;
create policy staff_perm_self_read on public.staff_permissions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists staff_perm_admin_all on public.staff_permissions;
create policy staff_perm_admin_all on public.staff_permissions
  for all to authenticated
  using (public.is_current_admin())
  with check (public.is_current_admin());

-- 5) Management RPC: set/clear a staff member's role ---------------------------
create or replace function public.admin_set_staff_role(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_role text
)
  returns table(user_id uuid, role text)
  language plpgsql
  security definer
  set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_role text := lower(trim(coalesce(p_role, '')));
  v_prev text;
begin
  -- Only full admins may manage staff.
  if auth.uid() is not null then
    if not public.is_admin_user(auth.uid()) then raise exception 'Not authorized'; end if;
  else
    if not public.is_admin_user(p_actor_id) then raise exception 'Not authorized'; end if;
  end if;

  if v_role not in ('employee', 'technician', 'customer', 'user') then
    raise exception 'Unsupported staff role: %', v_role;
  end if;

  select up.role into v_prev from public.user_profiles up where up.user_id = p_target_user_id;
  if lower(coalesce(v_prev, '')) in ('super_admin', 'admin') then
    raise exception 'Cannot modify a privileged account';
  end if;

  update public.user_profiles up
    set role = v_role, updated_at = now()
  where up.user_id = p_target_user_id;

  update public.app_users a
    set role = v_role, updated_at = now()
  from auth.users u
  where u.id = p_target_user_id and lower(a.email) = lower(u.email);

  if v_role in ('customer', 'user') then
    delete from public.staff_permissions sp where sp.user_id = p_target_user_id;
  end if;

  insert into public.audit_logs (action, actor_id, target_table, target_id, details)
  values ('staff_role_set', coalesce(auth.uid(), p_actor_id)::text, 'user_profiles', p_target_user_id::text,
          jsonb_build_object('previous_role', v_prev, 'new_role', v_role));

  user_id := p_target_user_id;
  role := v_role;
  return next;
end;
$$;

-- 6) Management RPC: grant/revoke a single section permission ------------------
create or replace function public.admin_set_staff_permission(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_section text,
  p_can_view boolean,
  p_can_manage boolean
)
  returns table(user_id uuid, section text, can_view boolean, can_manage boolean)
  language plpgsql
  security definer
  set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_section text := lower(trim(coalesce(p_section, '')));
  v_view boolean := coalesce(p_can_view, false) or coalesce(p_can_manage, false);
  v_manage boolean := coalesce(p_can_manage, false);
begin
  if auth.uid() is not null then
    if not public.is_admin_user(auth.uid()) then raise exception 'Not authorized'; end if;
  else
    if not public.is_admin_user(p_actor_id) then raise exception 'Not authorized'; end if;
  end if;

  if v_section = '' then raise exception 'Section required'; end if;
  if v_section = 'staff' then raise exception 'The staff section cannot be delegated'; end if;

  if lower(coalesce((select up.role from public.user_profiles up where up.user_id = p_target_user_id), '')) in ('super_admin', 'admin') then
    raise exception 'Admins already have full access';
  end if;

  if not public.is_panel_staff(p_target_user_id) then
    raise exception 'Target is not a staff member';
  end if;

  if v_view = false and v_manage = false then
    delete from public.staff_permissions sp
    where sp.user_id = p_target_user_id and sp.section = v_section;
  else
    insert into public.staff_permissions (user_id, section, can_view, can_manage, granted_by)
    values (p_target_user_id, v_section, v_view, v_manage, coalesce(auth.uid(), p_actor_id))
    on conflict (user_id, section) do update
      set can_view = excluded.can_view,
          can_manage = excluded.can_manage,
          granted_by = excluded.granted_by,
          updated_at = now();
  end if;

  insert into public.audit_logs (action, actor_id, target_table, target_id, details)
  values ('staff_permission_set', coalesce(auth.uid(), p_actor_id)::text, 'staff_permissions', p_target_user_id::text,
          jsonb_build_object('section', v_section, 'can_view', v_view, 'can_manage', v_manage));

  user_id := p_target_user_id;
  section := v_section;
  can_view := v_view;
  can_manage := v_manage;
  return next;
end;
$$;

-- 7) Relax privileged money/role RPCs to accept proxy calls on behalf of staff -
--    (only the authz preamble changes; bodies are otherwise unchanged).
create or replace function public.admin_approve_deposit(p_admin_user_id uuid, p_deposit_id uuid)
  returns table(deposit_id uuid, wallet_id uuid, transaction_id uuid, new_balance numeric)
  language plpgsql
  security definer
  set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_deposit public.deposits%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_new_balance numeric;
begin
  perform public.assert_panel_rpc_actor(p_admin_user_id);

  select * into v_deposit from public.deposits where id = p_deposit_id for update;
  if not found then raise exception 'Deposit not found'; end if;
  if coalesce(v_deposit.status, '') <> 'pending' then raise exception 'Deposit already processed'; end if;

  insert into public.wallets (user_id, balance, total_deposited)
  values (v_deposit.user_id, v_deposit.amount, v_deposit.amount)
  on conflict (user_id) do update
  set balance = public.wallets.balance + excluded.balance,
      total_deposited = public.wallets.total_deposited + excluded.total_deposited,
      updated_at = now()
  returning * into v_wallet;

  v_new_balance := v_wallet.balance;

  insert into public.wallet_transactions (wallet_id, user_id, type, amount, balance_after, description, reference_type, reference_id)
  values (v_wallet.id, v_deposit.user_id, 'deposit', v_deposit.amount, v_new_balance, 'إيداع رصيد معتمد', 'deposit', v_deposit.id::text)
  returning id into v_tx_id;

  update public.deposits
  set status = 'approved', reviewed_by = p_admin_user_id::text, reviewed_at = now(), updated_at = now()
  where id = v_deposit.id;

  insert into public.notifications (user_id, title, body, type, reference_type, reference_id)
  values (v_deposit.user_id, 'تمت الموافقة على الإيداع',
          'تمت إضافة ' || v_deposit.amount::text || ' د.أ إلى محفظتك.', 'success', 'wallet_transaction', v_tx_id::text);

  insert into public.audit_logs (action, actor_id, target_table, target_id, details)
  values ('deposit_approved', p_admin_user_id::text, 'deposits', v_deposit.id::text,
          jsonb_build_object('amount', v_deposit.amount, 'transaction_id', v_tx_id));

  deposit_id := v_deposit.id;
  wallet_id := v_wallet.id;
  transaction_id := v_tx_id;
  new_balance := v_new_balance;
  return next;
end;
$function$;

create or replace function public.admin_approve_refund(p_admin_user_id uuid, p_request_id uuid)
  returns table(request_id uuid, wallet_id uuid, transaction_id uuid, new_balance numeric)
  language plpgsql
  security definer
  set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_request public.refund_requests%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_new_balance numeric;
  v_order_total numeric;
  v_order_owner uuid;
  v_prior_refunds numeric := 0;
begin
  perform public.assert_panel_rpc_actor(p_admin_user_id);

  select * into v_request from public.refund_requests where id = p_request_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  if coalesce(v_request.status, '') <> 'pending' then raise exception 'Refund already processed'; end if;

  if v_request.order_type in ('product', 'digital') then
    select total, user_id into v_order_total, v_order_owner
    from public.orders where id = v_request.order_id and payment_status = 'paid';
  elsif v_request.order_type = 'service' then
    select total, user_id into v_order_total, v_order_owner
    from public.service_orders where id = v_request.order_id;
  elsif v_request.order_type = 'repair' then
    select user_id into v_order_owner from public.repair_bookings where id = v_request.order_id;
  else
    raise exception 'Unknown refund order_type: %', v_request.order_type;
  end if;

  if v_order_owner is null then raise exception 'Refund order not found or not eligible for refund'; end if;
  if v_order_owner <> v_request.user_id then raise exception 'Refund order does not belong to the requester'; end if;

  if v_order_total is not null then
    select coalesce(sum(amount), 0) into v_prior_refunds
    from public.refund_requests
    where order_id = v_request.order_id and order_type = v_request.order_type
      and status = 'approved' and id <> v_request.id;
    if v_request.amount + v_prior_refunds > v_order_total then
      raise exception 'Refund amount exceeds the refundable order total';
    end if;
  end if;

  insert into public.wallets (user_id, balance)
  values (v_request.user_id, v_request.amount)
  on conflict (user_id) do update
  set balance = public.wallets.balance + excluded.balance, updated_at = now()
  returning * into v_wallet;

  v_new_balance := v_wallet.balance;

  insert into public.wallet_transactions (wallet_id, user_id, type, amount, balance_after, description, reference_type, reference_id)
  values (v_wallet.id, v_request.user_id, 'refund', v_request.amount, v_new_balance,
          'استرجاع رصيد معتمد — ' || coalesce(nullif(trim(v_request.service_name), ''), 'طلب') || ' #' || v_request.order_id,
          'refund', v_request.id::text)
  returning id into v_tx_id;

  update public.refund_requests
  set status = 'approved', reviewed_by = p_admin_user_id, reviewed_at = now(), processed_at = now(), updated_at = now()
  where id = v_request.id;

  insert into public.notifications (user_id, title, body, type, reference_type, reference_id)
  values (v_request.user_id, 'تم استرجاع رصيدك 💰',
          'تمت إعادة ' || v_request.amount::text || ' د.أ إلى محفظتك.', 'success', 'refund', v_request.id::text);

  insert into public.audit_logs (action, actor_id, target_table, target_id, details)
  values ('refund_approved', p_admin_user_id::text, 'refund_requests', v_request.id::text,
          jsonb_build_object('amount', v_request.amount, 'transaction_id', v_tx_id, 'wallet_id', v_wallet.id));

  request_id := v_request.id;
  wallet_id := v_wallet.id;
  transaction_id := v_tx_id;
  new_balance := v_new_balance;
  return next;
end;
$function$;

create or replace function public.admin_set_seller_role(p_admin_user_id uuid, p_target_app_user_id text, p_make_seller boolean)
  returns table(app_user_id text, role text)
  language plpgsql
  security definer
  set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_user public.app_users%rowtype;
  v_new_role text;
begin
  perform public.assert_panel_rpc_actor(p_admin_user_id);

  select * into v_user from public.app_users where id = p_target_app_user_id for update;
  if not found then raise exception 'User not found'; end if;

  if v_user.role not in ('customer', 'user', 'seller') then
    raise exception 'Cannot change role for a privileged account';
  end if;

  v_new_role := case when p_make_seller then 'seller' else 'customer' end;

  update public.app_users set role = v_new_role, updated_at = now() where id = v_user.id;

  if not p_make_seller then
    delete from public.seller_category_discounts where user_id = v_user.id;
  end if;

  insert into public.audit_logs (action, actor_id, target_table, target_id, details)
  values (case when p_make_seller then 'seller_promoted' else 'seller_demoted' end,
          p_admin_user_id::text, 'app_users', v_user.id,
          jsonb_build_object('previous_role', v_user.role, 'new_role', v_new_role));

  app_user_id := v_user.id;
  role := v_new_role;
  return next;
end;
$function$;

-- 8) Grants: management RPCs callable only through the service-role proxy -------
revoke all on function public.admin_set_staff_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_staff_permission(uuid, uuid, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_staff_role(uuid, uuid, text) to service_role;
grant execute on function public.admin_set_staff_permission(uuid, uuid, text, boolean, boolean) to service_role;

revoke all on function public.is_panel_staff(uuid) from anon;
revoke all on function public.assert_panel_rpc_actor(uuid) from public, anon, authenticated;

commit;
