-- Migration: 2026-05-29-02 — Atomic admin refund approval + guarded seller role RPC
--
-- Problem
-- -------
-- The admin DB proxy was locked to an allowlist (functions/api/admin/dbOperations.js)
-- during a security hardening pass, but the Refunds and Sellers sections were never
-- re-wired:
--
--   * Refunds: public/js/admin/refunds.js read/wrote refund_requests, wallets and
--     wallet_transactions directly through the proxy. None were allowlisted, so the
--     list always came back empty and approve/reject silently failed. Worse, the
--     approve path did an UNSAFE client-side balance read-modify-write (select
--     balance -> add -> update) with no row lock, no idempotency and no
--     status='pending' guard. Merely opening the allowlist would have turned that
--     into a real money double-credit on double-click / concurrent approval.
--
--   * Sellers: public/js/admin/sellers.js wrote app_users.role directly. app_users
--     must NOT be opened to generic proxy mutations — that path is deliberately
--     blocked so a caller cannot set role='super_admin' and escalate.
--
-- Fix
-- ---
-- Two SECURITY DEFINER functions, modeled on the existing public.admin_approve_deposit:
--
--   1. admin_approve_refund(p_admin_user_id uuid, p_request_id uuid)
--      Verifies the caller is an admin, locks the refund_requests row FOR UPDATE,
--      refuses anything that is not status='pending' (idempotent under concurrency),
--      credits the wallet, writes a wallet_transactions row (type 'refund'), flips
--      the request to 'approved', and inserts a notification + audit log — all in one
--      transaction. wallet_transactions.reference_type is used to match the deposit
--      RPC, which is live in production (so the column exists).
--
--   2. admin_set_seller_role(p_admin_user_id uuid, p_target_app_user_id text,
--      p_make_seller boolean)
--      Verifies the caller is an admin, locks the app_users row, and toggles role
--      between 'customer' and 'seller'. It refuses to touch any account that is not
--      already customer/user/seller, so it can never promote an admin away or
--      escalate a user to a privileged role. On demotion it also clears that
--      seller's seller_category_discounts. Audit-logged.
--
-- Both are granted to service_role only and invoked through the secured admin proxy.
-- Idempotent: CREATE OR REPLACE preserves existing grants; re-running is safe.

begin;

-- ============================================================
-- 1. Atomic, idempotent refund approval
-- ============================================================
create or replace function public.admin_approve_refund(
  p_admin_user_id uuid,
  p_request_id uuid
)
returns table(
  request_id uuid,
  wallet_id uuid,
  transaction_id uuid,
  new_balance numeric
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_request public.refund_requests%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_new_balance numeric;
  v_order_total numeric;
  v_order_owner uuid;
  v_prior_refunds numeric := 0;
begin
  if p_admin_user_id is null or not public.is_admin_user(p_admin_user_id) then
    raise exception 'Not authorized';
  end if;

  select * into v_request
  from public.refund_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Refund request not found';
  end if;

  if coalesce(v_request.status, '') <> 'pending' then
    raise exception 'Refund already processed';
  end if;

  -- Re-derive/cap the amount against a REAL, owned order before crediting. The
  -- refund_requests RLS insert policy lets a user create their own request with
  -- an arbitrary `amount`, so the amount must be validated here, not trusted.
  -- product/digital -> orders (must be paid); service -> service_orders;
  -- repair -> repair_bookings (no prepaid total, so ownership only — amount stays
  -- admin-reviewed). Unknown order_type is rejected.
  if v_request.order_type in ('product', 'digital') then
    select total, user_id into v_order_total, v_order_owner
    from public.orders
    where id = v_request.order_id and payment_status = 'paid';
  elsif v_request.order_type = 'service' then
    select total, user_id into v_order_total, v_order_owner
    from public.service_orders
    where id = v_request.order_id;
  elsif v_request.order_type = 'repair' then
    select user_id into v_order_owner
    from public.repair_bookings
    where id = v_request.order_id;
  else
    raise exception 'Unknown refund order_type: %', v_request.order_type;
  end if;

  if v_order_owner is null then
    raise exception 'Refund order not found or not eligible for refund';
  end if;

  if v_order_owner <> v_request.user_id then
    raise exception 'Refund order does not belong to the requester';
  end if;

  -- Where the order carries a monetary total, cap the cumulative approved refunds
  -- (this request + any already-approved ones for the same order) to that total.
  if v_order_total is not null then
    select coalesce(sum(amount), 0) into v_prior_refunds
    from public.refund_requests
    where order_id = v_request.order_id
      and order_type = v_request.order_type
      and status = 'approved'
      and id <> v_request.id;

    if v_request.amount + v_prior_refunds > v_order_total then
      raise exception 'Refund amount exceeds the refundable order total';
    end if;
  end if;

  -- Credit the wallet (create it if the user has none yet). A refund is not a
  -- deposit, so total_deposited is intentionally left untouched.
  insert into public.wallets (user_id, balance)
  values (v_request.user_id, v_request.amount)
  on conflict (user_id) do update
  set
    balance = public.wallets.balance + excluded.balance,
    updated_at = now()
  returning * into v_wallet;

  v_new_balance := v_wallet.balance;

  insert into public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id
  )
  values (
    v_wallet.id,
    v_request.user_id,
    'refund',
    v_request.amount,
    v_new_balance,
    'استرجاع رصيد معتمد — ' || coalesce(nullif(trim(v_request.service_name), ''), 'طلب')
      || ' #' || v_request.order_id,
    'refund',
    v_request.id::text
  )
  returning id into v_tx_id;

  update public.refund_requests
  set
    status = 'approved',
    reviewed_by = p_admin_user_id,
    reviewed_at = now(),
    processed_at = now(),
    updated_at = now()
  where id = v_request.id;

  insert into public.notifications (user_id, title, body, type, reference_type, reference_id)
  values (
    v_request.user_id,
    'تم استرجاع رصيدك 💰',
    'تمت إعادة ' || v_request.amount::text || ' د.أ إلى محفظتك.',
    'success',
    'refund',
    v_request.id::text
  );

  insert into public.audit_logs (action, actor_id, target_table, target_id, details)
  values (
    'refund_approved',
    p_admin_user_id::text,
    'refund_requests',
    v_request.id::text,
    jsonb_build_object('amount', v_request.amount, 'transaction_id', v_tx_id, 'wallet_id', v_wallet.id)
  );

  request_id := v_request.id;
  wallet_id := v_wallet.id;
  transaction_id := v_tx_id;
  new_balance := v_new_balance;
  return next;
end;
$$;

-- ============================================================
-- 2. Guarded seller role toggle (never escalates privileged accounts)
-- ============================================================
create or replace function public.admin_set_seller_role(
  p_admin_user_id uuid,
  p_target_app_user_id text,
  p_make_seller boolean
)
returns table(
  app_user_id text,
  role text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user public.app_users%rowtype;
  v_new_role text;
begin
  if p_admin_user_id is null or not public.is_admin_user(p_admin_user_id) then
    raise exception 'Not authorized';
  end if;

  select * into v_user
  from public.app_users
  where id = p_target_app_user_id
  for update;

  if not found then
    raise exception 'User not found';
  end if;

  -- Only ordinary accounts may be toggled to/from seller. Refuse anything else so
  -- this RPC can never strip an admin or escalate a user to a privileged role.
  if v_user.role not in ('customer', 'user', 'seller') then
    raise exception 'Cannot change role for a privileged account';
  end if;

  v_new_role := case when p_make_seller then 'seller' else 'customer' end;

  update public.app_users
  set role = v_new_role, updated_at = now()
  where id = v_user.id;

  -- Demotion clears the seller's per-category discounts in the same transaction.
  if not p_make_seller then
    delete from public.seller_category_discounts where user_id = v_user.id;
  end if;

  insert into public.audit_logs (action, actor_id, target_table, target_id, details)
  values (
    case when p_make_seller then 'seller_promoted' else 'seller_demoted' end,
    p_admin_user_id::text,
    'app_users',
    v_user.id,
    jsonb_build_object('previous_role', v_user.role, 'new_role', v_new_role)
  );

  app_user_id := v_user.id;
  role := v_new_role;
  return next;
end;
$$;

-- ============================================================
-- Grants — service_role only, mirroring admin_approve_deposit
-- ============================================================
revoke all on function public.admin_approve_refund(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_refund(uuid, uuid) to service_role;

revoke all on function public.admin_set_seller_role(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_seller_role(uuid, text, boolean) to service_role;

commit;
