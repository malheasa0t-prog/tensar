-- Migration: 2026-05-30-01 — Make digital service orders idempotent at the DB layer
--
-- Problem
-- -------
-- `/api/orders/create` already uses the shared Idempotency-Key middleware, but
-- when the edge KV binding is absent (or two requests land on different
-- isolates) the DB RPC `create_service_order_tx` can still run twice. Because
-- the RPC debits the wallet before returning, two near-simultaneous submits can
-- create two service orders, debit the wallet twice, and fire the provider
-- order twice.
--
-- Fix
-- ---
-- 1. Persist the request idempotency key on `service_orders`.
-- 2. Add a unique partial index scoped to `(user_id, request_idempotency_key)`.
-- 3. Add a 5-argument RPC overload that:
--    - takes a transaction-scoped advisory lock on `(user_id, key)`,
--    - rejects key reuse with a different request body,
--    - returns the existing order instead of debiting again,
--    - tells the caller whether the provider dispatch still needs to run.
-- 4. Keep the legacy 4-argument signature as a wrapper so older callers do not
--    break immediately.
--
-- Re-runnable: the column and index use IF NOT EXISTS, and the function bodies
-- are `CREATE OR REPLACE`.

begin;

alter table public.service_orders
  add column if not exists request_idempotency_key text;

create unique index if not exists idx_service_orders_user_request_idempotency
  on public.service_orders(user_id, request_idempotency_key)
  where request_idempotency_key is not null;

create or replace function public.create_service_order_tx(
  p_user_id uuid,
  p_service_id text,
  p_quantity integer,
  p_link text default null,
  p_idempotency_key text default null
)
returns table(
  order_id text,
  total numeric,
  new_balance numeric,
  message text,
  provider_dispatch_required boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_effective_user_id uuid;
  v_existing_balance numeric := 0;
  v_existing_order public.service_orders%rowtype;
  v_existing_purchase_tx public.wallet_transactions%rowtype;
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_new_balance numeric;
  v_normalized_link text := nullif(trim(coalesce(p_link, '')), '');
  v_order_id text;
  v_service public.services%rowtype;
  v_total numeric;
  v_wallet public.wallets%rowtype;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  if v_actor_user_id is not null and v_actor_user_id <> p_user_id then
    raise exception 'Actor mismatch';
  end if;

  if v_actor_user_id is null and v_actor_role <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  v_effective_user_id := coalesce(v_actor_user_id, p_user_id);

  if v_idempotency_key is not null then
    perform pg_advisory_xact_lock(
      hashtext(v_effective_user_id::text),
      hashtext(v_idempotency_key)
    );

    select *
      into v_existing_order
    from public.service_orders
    where user_id = v_effective_user_id
      and request_idempotency_key = v_idempotency_key
    order by created_at desc
    limit 1;

    if found then
      if coalesce(v_existing_order.service_id, '') <> coalesce(p_service_id, '')
        or coalesce(v_existing_order.quantity, 0) <> p_quantity
        or coalesce(v_existing_order.link, '') <> coalesce(v_normalized_link, '') then
        raise exception 'Idempotency key reused with different request body';
      end if;

      select *
        into v_existing_purchase_tx
      from public.wallet_transactions
      where reference_id = v_existing_order.id
        and type = 'purchase'
      order by created_at desc
      limit 1;

      if found then
        v_existing_balance := coalesce(v_existing_purchase_tx.balance_after, 0);
      else
        select coalesce(balance, 0)
          into v_existing_balance
        from public.wallets
        where user_id = v_effective_user_id
        limit 1;
      end if;

      order_id := v_existing_order.id;
      total := coalesce(v_existing_order.total, 0);
      new_balance := v_existing_balance;
      message := 'Order already exists';
      provider_dispatch_required := false;
      return next;
      return;
    end if;
  end if;

  select *
    into v_service
  from public.services
  where id = p_service_id
  limit 1;

  if not found then
    raise exception 'Service not found';
  end if;

  if coalesce(v_service.status, 'active') <> 'active' then
    raise exception 'Service is not active';
  end if;

  if p_quantity < coalesce(v_service.min_qty, 1) or p_quantity > coalesce(v_service.max_qty, 999999) then
    raise exception 'Quantity out of range';
  end if;

  v_total := coalesce(v_service.price, 0) * p_quantity;

  select *
    into v_wallet
  from public.wallets
  where user_id = v_effective_user_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if v_wallet.balance < v_total then
    raise exception 'Insufficient wallet balance';
  end if;

  v_order_id := public.generate_prefixed_id('so-');
  v_new_balance := v_wallet.balance - v_total;

  update public.wallets
  set
    balance = v_new_balance,
    total_spent = total_spent + v_total,
    updated_at = now()
  where id = v_wallet.id;

  insert into public.service_orders (
    id,
    user_id,
    service_id,
    service_name,
    link,
    quantity,
    price,
    cost_price,
    total,
    status,
    provider_name,
    request_idempotency_key,
    created_at,
    updated_at
  )
  values (
    v_order_id,
    v_effective_user_id,
    v_service.id,
    v_service.name,
    v_normalized_link,
    p_quantity,
    coalesce(v_service.price, 0),
    coalesce(v_service.cost_price, 0),
    v_total,
    'pending',
    'default',
    v_idempotency_key,
    now(),
    now()
  );

  insert into public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_after,
    description,
    reference_id
  )
  values (
    v_wallet.id,
    v_effective_user_id,
    'purchase',
    -v_total,
    v_new_balance,
    'شراء: ' || v_service.name || ' (×' || p_quantity || ')',
    v_order_id
  );

  insert into public.notifications (
    user_id,
    title,
    body,
    type,
    reference_type,
    reference_id
  )
  values (
    v_effective_user_id,
    'تم إنشاء طلبك بنجاح',
    'طلب ' || v_service.name || ' بكمية ' || p_quantity || ' — المبلغ: ' || v_total::text || ' د.أ',
    'success',
    'service_order',
    v_order_id
  );

  order_id := v_order_id;
  total := v_total;
  new_balance := v_new_balance;
  message := 'Order created successfully';
  provider_dispatch_required := true;
  return next;
end;
$$;

create or replace function public.create_service_order_tx(
  p_user_id uuid,
  p_service_id text,
  p_quantity integer,
  p_link text default null
)
returns table(
  order_id text,
  total numeric,
  new_balance numeric,
  message text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    existing_order.order_id,
    existing_order.total,
    existing_order.new_balance,
    existing_order.message
  from public.create_service_order_tx(
    p_user_id,
    p_service_id,
    p_quantity,
    p_link,
    null
  ) as existing_order;
$$;

revoke execute on function public.create_service_order_tx(uuid, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.create_service_order_tx(uuid, text, integer, text, text)
  to service_role;

revoke execute on function public.create_service_order_tx(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.create_service_order_tx(uuid, text, integer, text)
  to service_role;

commit;
