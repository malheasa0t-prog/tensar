-- Migration: 2026-05-29-01 — Close the Orange Money wallet double-credit race
--
-- Problem
-- -------
-- `apply_orange_money_wallet_deposit` is meant to be idempotent on
-- `p_reference_id`: it checks `wallet_transactions` for an existing transaction
-- with the same reference and, if found, returns it instead of crediting again.
--
-- That check runs BEFORE the wallet row is locked `FOR UPDATE`, and there is no
-- UNIQUE constraint on `wallet_transactions.reference_id` (a global unique
-- index is not possible because reference ids are legitimately reused across
-- transaction types — e.g. an order id appears on both a payment and a later
-- refund). So two concurrent calls for the SAME Orange Money reference can both
-- read "not found", both insert, and credit the wallet twice. This is reachable
-- in production because two code paths credit the same reference:
--   1. POST /api/webhooks/sms-receiver (matches a pending deposit/order), and
--   2. POST /api/deposits/orange-money (a user claiming a stored SMS), plus
--   duplicate webhook deliveries arriving in parallel.
--
-- Fix
-- ---
-- Take a transaction-scoped advisory lock keyed by the reference id at the very
-- top of the function (when a reference is present). Concurrent calls sharing a
-- reference now serialize, so the existence check below is reliable: the second
-- caller waits for the first to commit, then sees the committed row and returns
-- it without double-crediting. The lock is released automatically on commit.
--
-- Idempotent: this is a `CREATE OR REPLACE FUNCTION`; existing grants are
-- preserved. Re-running the migration is safe.

begin;

create or replace function public.apply_orange_money_wallet_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text,
  p_description text default null
)
returns table(
  wallet_id uuid,
  new_balance numeric,
  transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_tx public.wallet_transactions%rowtype;
  v_wallet public.wallets%rowtype;
  v_new_balance numeric;
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_tx_id uuid;
  v_reference text := nullif(trim(coalesce(p_reference_id, '')), '');
begin
  if v_role <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Serialize concurrent credit attempts that share a reference id so the
  -- idempotency check below cannot race (two callers both seeing "not found"
  -- and both inserting). Transaction-scoped: released automatically on commit.
  if v_reference is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_reference, 0));

    select *
      into v_existing_tx
    from public.wallet_transactions
    where reference_id = v_reference
    order by created_at desc
    limit 1;

    if found then
      select *
        into v_wallet
      from public.wallets
      where id = v_existing_tx.wallet_id;

      wallet_id := v_existing_tx.wallet_id;
      new_balance := v_existing_tx.balance_after;
      transaction_id := v_existing_tx.id;
      return next;
      return;
    end if;
  end if;

  select *
    into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select *
      into v_wallet
    from public.wallets
    where user_id = p_user_id
    for update;
  end if;

  v_new_balance := v_wallet.balance + p_amount;

  update public.wallets
  set
    balance = v_new_balance,
    total_deposited = total_deposited + p_amount,
    updated_at = now()
  where id = v_wallet.id;

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
    p_user_id,
    'deposit',
    p_amount,
    v_new_balance,
    coalesce(nullif(trim(p_description), ''), 'Orange Money deposit'),
    v_reference
  )
  returning id into v_tx_id;

  insert into public.notifications (
    user_id,
    title,
    body,
    type,
    reference_type,
    reference_id
  )
  values (
    p_user_id,
    'تم شحن رصيدك تلقائيًا',
    'تمت إضافة ' || p_amount::text || ' د.أ إلى محفظتك عبر Orange Money.',
    'success',
    'wallet_transaction',
    v_tx_id::text
  );

  wallet_id := v_wallet.id;
  new_balance := v_new_balance;
  transaction_id := v_tx_id;
  return next;
end;
$$;

revoke all on function public.apply_orange_money_wallet_deposit(uuid, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_orange_money_wallet_deposit(uuid, numeric, text, text)
  to service_role;

commit;
