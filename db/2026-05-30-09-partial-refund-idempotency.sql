-- ============================================================================
-- 2026-05-30-09  Make the partial-refund branch idempotent
-- ----------------------------------------------------------------------------
-- sync_service_order_status_tx credited the wallet in the `partial` branch but
-- left status = 'partial' and recorded nothing, so a re-entrant call with
-- expected='partial', new='partial' (the equal-status guard passes) double-paid
-- the partial refund. The cron caller currently excludes 'partial', but any
-- manual/admin re-sync was a latent double-credit.
--
-- Fix: guard the partial branch on a persisted metadata marker and set that
-- marker right after crediting. The failed/cancelled branch already self-guards
-- by moving the order to terminal 'refunded'. Logic otherwise unchanged.
-- Idempotent: plain create-or-replace.
-- ============================================================================

create or replace function public.sync_service_order_status_tx(
  p_order_id text,
  p_expected_status text,
  p_new_status text,
  p_start_count integer default null,
  p_remains integer default null
)
returns table(
  applied boolean,
  final_status text,
  refund_amount numeric
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_order public.service_orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_normalized_status text := lower(trim(coalesce(p_new_status, '')));
  v_refund_amount numeric := 0;
  v_effective_start_count integer := case when p_start_count is null then null else greatest(p_start_count, 0) end;
  v_effective_remains integer := case when p_remains is null then null else greatest(p_remains, 0) end;
  v_balance_after numeric;
begin
  if v_actor_role <> 'service_role'
     and not public.is_admin_user(v_actor_user_id) then
    raise exception 'Not authorized';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Service order not found';
  end if;

  if coalesce(v_order.status, '') <> trim(coalesce(p_expected_status, '')) then
    return query select false, v_order.status, 0::numeric;
    return;
  end if;

  update public.service_orders
  set
    status = v_normalized_status,
    start_count = case when p_start_count is null then start_count else v_effective_start_count end,
    remains = case when p_remains is null then remains else v_effective_remains end,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  if v_normalized_status in ('failed', 'cancelled') then
    v_refund_amount := greatest(coalesce(v_order.total, 0), 0);

    if v_refund_amount > 0 then
      select * into v_wallet
      from public.wallets
      where user_id = v_order.user_id
      for update;

      if not found then
        raise exception 'Wallet not found';
      end if;

      v_balance_after := v_wallet.balance + v_refund_amount;

      update public.wallets
      set
        balance = v_balance_after,
        total_spent = greatest(0, total_spent - v_refund_amount),
        updated_at = now()
      where id = v_wallet.id;

      insert into public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, reference_type, reference_id
      )
      values (
        v_wallet.id, v_order.user_id, 'refund', v_refund_amount, v_balance_after,
        'استرجاع تلقائي - ' || v_order.service_name, 'service_order', v_order.id
      );
    end if;

    update public.service_orders
    set status = 'refunded', updated_at = now()
    where id = p_order_id
    returning * into v_order;

  elsif v_normalized_status = 'partial'
        and coalesce(v_order.remains, 0) > 0
        and not coalesce((v_order.metadata ->> 'partial_refunded')::boolean, false) then
    select * into v_wallet
    from public.wallets
    where user_id = v_order.user_id
    for update;

    if not found then
      raise exception 'Wallet not found';
    end if;

    v_refund_amount := greatest(coalesce(v_order.price, 0) * coalesce(v_order.remains, 0), 0);

    if v_refund_amount > 0 then
      v_balance_after := v_wallet.balance + v_refund_amount;

      update public.wallets
      set balance = v_balance_after, updated_at = now()
      where id = v_wallet.id;

      insert into public.wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description, reference_type, reference_id
      )
      values (
        v_wallet.id, v_order.user_id, 'refund', v_refund_amount, v_balance_after,
        'استرجاع جزئي - ' || coalesce(v_order.remains, 0)::text || ' وحدة لم تنفذ',
        'service_order', v_order.id
      );

      -- Persist the marker so a re-entrant 'partial' call cannot double-pay.
      update public.service_orders
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'partial_refunded', true,
            'partial_refunded_amount', v_refund_amount,
            'partial_refunded_at', now()
          ),
          updated_at = now()
      where id = p_order_id
      returning * into v_order;
    end if;
  end if;

  return query select true, v_order.status, v_refund_amount;
end;
$$;

revoke all on function public.sync_service_order_status_tx(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.sync_service_order_status_tx(text, text, text, integer, integer) to service_role;
