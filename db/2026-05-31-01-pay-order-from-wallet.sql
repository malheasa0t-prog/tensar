-- ============================================================================
-- 2026-05-31-01  One-tap wallet payment for physical orders
-- ----------------------------------------------------------------------------
-- Adds a 'wallet_balance' payment method and an atomic RPC that debits the
-- customer's in-app wallet and marks the order paid in a single transaction.
-- Mirrors the safety of create_service_order_tx (row lock + balance check).
-- Called by the checkout pipeline with the service-role client.
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Allow the new payment method on orders.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method = any (array['cash','card','wallet','wallet_balance','bank_transfer','cod']));

-- 2. Atomic wallet debit + order paid.
create or replace function public.pay_order_from_wallet(
  p_order_id text,
  p_user_id uuid,
  p_amount numeric
)
returns table(success boolean, balance_after numeric)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_wallet public.wallets%rowtype;
  v_balance_after numeric;
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  -- Direct (non service-role) callers may only pay from their own wallet.
  if v_role <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_user_id then
      raise exception 'Not authorized';
    end if;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  -- Order must exist, belong to the payer, and not be paid yet.
  perform 1 from public.orders
  where id = p_order_id
    and user_id = p_user_id
    and coalesce(payment_status, 'pending') <> 'paid';
  if not found then
    raise exception 'Order not eligible';
  end if;

  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'Wallet not found';
  end if;
  if v_wallet.balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_balance_after := v_wallet.balance - p_amount;

  update public.wallets
  set balance = v_balance_after,
      total_spent = coalesce(total_spent, 0) + p_amount,
      updated_at = now()
  where id = v_wallet.id;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_after, description, reference_type, reference_id
  )
  values (
    v_wallet.id, p_user_id, 'purchase', p_amount, v_balance_after,
    'دفع طلب من رصيد المحفظة', 'order', p_order_id
  );

  update public.orders
  set payment_status = 'paid', status = 'processing', updated_at = now()
  where id = p_order_id;

  return query select true, v_balance_after;
end;
$$;

revoke all on function public.pay_order_from_wallet(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.pay_order_from_wallet(text, uuid, numeric) to service_role;
