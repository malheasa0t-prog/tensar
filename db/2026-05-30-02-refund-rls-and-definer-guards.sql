-- Migration: 2026-05-30-02 - refund RLS hardening + SECURITY DEFINER caller guards
--
-- Purpose:
--   1. Prevent authenticated users from inserting refund requests with a forged
--      non-pending status or non-positive amount.
--   2. Add in-body caller checks to internal SECURITY DEFINER RPCs so a future
--      grant drift cannot expose them unintentionally.
--
-- Idempotent:
--   Uses CREATE OR REPLACE for current functions, DROP/CREATE for the target
--   RLS policy, and conditional DO blocks for legacy overloads that may still
--   exist in older databases.

begin;

drop policy if exists refund_requests_insert_own on public.refund_requests;
create policy refund_requests_insert_own
on public.refund_requests for insert
to authenticated
with check (
  auth.uid() = user_id
  and coalesce(status, 'pending') = 'pending'
  and amount > 0
);

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
        v_order.user_id,
        'refund',
        v_refund_amount,
        v_balance_after,
        'استرجاع تلقائي - ' || v_order.service_name,
        'service_order',
        v_order.id
      );
    end if;

    update public.service_orders
    set status = 'refunded', updated_at = now()
    where id = p_order_id
    returning * into v_order;
  elsif v_normalized_status = 'partial' and coalesce(v_order.remains, 0) > 0 then
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
        v_order.user_id,
        'refund',
        v_refund_amount,
        v_balance_after,
        'استرجاع جزئي - ' || coalesce(v_order.remains, 0)::text || ' وحدة لم تنفذ',
        'service_order',
        v_order.id
      );
    end if;
  end if;

  return query select true, v_order.status, v_refund_amount;
end;
$$;

create or replace function public.release_service_order_wallet(
  p_order_id text,
  p_reason text default 'provider_unreachable'
)
returns table(released boolean, refunded_amount numeric, new_balance numeric)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_order public.service_orders%rowtype;
  v_wallet public.wallets%rowtype;
  v_refund numeric := 0;
  v_new_balance numeric := 0;
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
    released := false;
    refunded_amount := 0;
    new_balance := 0;
    return next;
    return;
  end if;

  if v_order.status not in ('pending') or v_order.external_order_id is not null then
    released := false;
    refunded_amount := 0;
    new_balance := coalesce((select balance from public.wallets where user_id = v_order.user_id), 0);
    return next;
    return;
  end if;

  v_refund := greatest(coalesce(v_order.total, v_order.price, 0), 0);

  if v_refund <= 0 then
    update public.service_orders
    set status = 'failed', updated_at = now()
    where id = v_order.id;

    released := true;
    refunded_amount := 0;
    new_balance := coalesce((select balance from public.wallets where user_id = v_order.user_id), 0);
    return next;
    return;
  end if;

  insert into public.wallets (user_id, balance)
  values (v_order.user_id, v_refund)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = now()
  returning * into v_wallet;

  v_new_balance := v_wallet.balance;

  insert into public.wallet_transactions (
    wallet_id,
    user_id,
    amount,
    type,
    reference_type,
    reference_id,
    balance_after,
    description
  )
  values (
    v_wallet.id,
    v_order.user_id,
    v_refund,
    'refund',
    'service_order',
    v_order.id,
    v_new_balance,
    'استرجاع تلقائي بسبب فشل المزود: ' || coalesce(p_reason, 'unknown')
  );

  update public.service_orders
  set status = 'failed', updated_at = now()
  where id = v_order.id;

  insert into public.audit_logs (action, actor_email, details, target_table, target_id)
  values (
    'service_order_wallet_released',
    'system',
    jsonb_build_object('reason', p_reason, 'refunded_amount', v_refund, 'previous_status', v_order.status),
    'service_orders',
    v_order.id
  );

  released := true;
  refunded_amount := v_refund;
  new_balance := v_new_balance;
  return next;
end;
$$;

create or replace function public.merge_service_order_metadata(
  p_order_id text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if v_actor_role <> 'service_role'
     and not public.is_admin_user(v_actor_user_id) then
    raise exception 'Not authorized';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    return;
  end if;

  update public.service_orders
  set metadata = coalesce(metadata, '{}'::jsonb) || p_metadata,
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.admin_set_order_status(
  p_order_id text,
  p_new_status text,
  p_actor_email text default null,
  p_actor_id uuid default null,
  p_reason text default null
)
returns table(applied boolean, previous_status text, current_status text)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_prev_status text;
  v_new_status text := lower(trim(p_new_status));
begin
  if v_actor_role <> 'service_role'
     and not public.is_admin_user(v_actor_user_id) then
    raise exception 'Not authorized';
  end if;

  if v_new_status not in ('pending', 'processing', 'delivered', 'cancelled') then
    raise exception 'INVALID_STATUS:%', v_new_status using errcode = '22023';
  end if;

  select lower(trim(status)) into v_prev_status
  from public.orders
  where id = p_order_id
  for update;

  if v_prev_status is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_prev_status = v_new_status then
    applied := false;
    previous_status := v_prev_status;
    current_status := v_prev_status;
    return next;
    return;
  end if;

  update public.orders
  set status = v_new_status, updated_at = now()
  where id = p_order_id;

  insert into public.audit_logs (action, actor_email, actor_id, details, target_table, target_id)
  values (
    'order_status_changed',
    p_actor_email,
    p_actor_id::text,
    jsonb_build_object('previous_status', v_prev_status, 'new_status', v_new_status, 'reason', p_reason),
    'orders',
    p_order_id
  );

  applied := true;
  previous_status := v_prev_status;
  current_status := v_new_status;
  return next;
end;
$$;

do $migration$
begin
  if to_regprocedure('public.release_service_order_wallet(uuid,text)') is not null then
    execute $sql$
      create or replace function public.release_service_order_wallet(
        p_order_id uuid,
        p_reason text default 'provider_unreachable'
      )
      returns table(released boolean, refunded_amount numeric, new_balance numeric)
      language plpgsql
      security definer
      set search_path = public, auth, pg_temp
      as $body$
      declare
        v_actor_user_id uuid := auth.uid();
        v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
        v_order public.service_orders%rowtype;
        v_refund numeric := 0;
        v_new_balance numeric := 0;
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
          released := false;
          refunded_amount := 0;
          new_balance := 0;
          return next;
          return;
        end if;

        if v_order.status not in ('pending') or v_order.external_order_id is not null then
          released := false;
          refunded_amount := 0;
          new_balance := coalesce((select balance from public.wallets where user_id = v_order.user_id), 0);
          return next;
          return;
        end if;

        v_refund := coalesce(v_order.total, v_order.price, 0);

        insert into public.wallets (user_id, balance)
        values (v_order.user_id, v_refund)
        on conflict (user_id) do update
          set balance = public.wallets.balance + excluded.balance,
              updated_at = now()
        returning balance into v_new_balance;

        insert into public.wallet_transactions (user_id, amount, type, reference_type, reference_id, description)
        values (
          v_order.user_id,
          v_refund,
          'refund',
          'service_order',
          v_order.id,
          'استرجاع تلقائي بسبب فشل المزود: ' || coalesce(p_reason, 'unknown')
        );

        update public.service_orders
        set status = 'failed',
            updated_at = now()
        where id = v_order.id;

        insert into public.audit_logs (action, actor_email, details, target_table, target_id)
        values (
          'service_order_wallet_released',
          'system',
          jsonb_build_object(
            'reason', p_reason,
            'refunded_amount', v_refund,
            'previous_status', v_order.status
          ),
          'service_orders',
          v_order.id
        );

        released := true;
        refunded_amount := v_refund;
        new_balance := v_new_balance;
        return next;
      end;
      $body$;
    $sql$;
  end if;

  if to_regprocedure('public.merge_service_order_metadata(uuid,jsonb)') is not null then
    execute $sql$
      create or replace function public.merge_service_order_metadata(
        p_order_id uuid,
        p_metadata jsonb
      )
      returns void
      language plpgsql
      security definer
      set search_path = public, auth, pg_temp
      as $body$
      declare
        v_actor_user_id uuid := auth.uid();
        v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
      begin
        if v_actor_role <> 'service_role'
           and not public.is_admin_user(v_actor_user_id) then
          raise exception 'Not authorized';
        end if;

        if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
          return;
        end if;

        update public.service_orders
        set metadata = coalesce(metadata, '{}'::jsonb) || p_metadata,
            updated_at = now()
        where id = p_order_id;
      end;
      $body$;
    $sql$;
  end if;

  if to_regprocedure('public.admin_set_order_status(uuid,text,text,uuid,text)') is not null then
    execute $sql$
      create or replace function public.admin_set_order_status(
        p_order_id uuid,
        p_new_status text,
        p_actor_email text default null,
        p_actor_id uuid default null,
        p_reason text default null
      )
      returns table(applied boolean, previous_status text, current_status text)
      language plpgsql
      security definer
      set search_path = public, auth, pg_temp
      as $body$
      declare
        v_actor_user_id uuid := auth.uid();
        v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
        v_prev_status text;
        v_new_status text := lower(trim(p_new_status));
        v_legal boolean;
      begin
        if v_actor_role <> 'service_role'
           and not public.is_admin_user(v_actor_user_id) then
          raise exception 'Not authorized';
        end if;

        if v_new_status not in ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') then
          raise exception 'INVALID_STATUS:%', v_new_status using errcode = '22023';
        end if;

        select lower(trim(status)) into v_prev_status
        from public.orders
        where id = p_order_id
        for update;

        if v_prev_status is null then
          raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
        end if;

        if v_prev_status = v_new_status then
          applied := false;
          previous_status := v_prev_status;
          current_status := v_prev_status;
          return next;
          return;
        end if;

        v_legal := case
          when v_prev_status = 'pending' and v_new_status in ('processing', 'cancelled') then true
          when v_prev_status = 'processing' and v_new_status in ('shipped', 'cancelled') then true
          when v_prev_status = 'shipped' and v_new_status in ('delivered', 'cancelled') then true
          when v_prev_status = 'delivered' and v_new_status in ('refunded') then true
          when v_prev_status = 'cancelled' and v_new_status in ('refunded') then true
          else false
        end;

        if not v_legal then
          raise exception 'ILLEGAL_TRANSITION:%->%', v_prev_status, v_new_status using errcode = '22023';
        end if;

        update public.orders
        set status = v_new_status,
            updated_at = now()
        where id = p_order_id;

        insert into public.audit_logs (action, actor_email, actor_id, details, target_table, target_id)
        values (
          'order_status_changed',
          p_actor_email,
          p_actor_id,
          jsonb_build_object(
            'previous_status', v_prev_status,
            'new_status', v_new_status,
            'reason', p_reason
          ),
          'orders',
          p_order_id
        );

        applied := true;
        previous_status := v_prev_status;
        current_status := v_new_status;
        return next;
      end;
      $body$;
    $sql$;
  end if;
end;
$migration$;

revoke all on function public.sync_service_order_status_tx(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.sync_service_order_status_tx(text, text, text, integer, integer)
  to service_role;

revoke all on function public.release_service_order_wallet(text, text)
  from public, anon, authenticated;
grant execute on function public.release_service_order_wallet(text, text)
  to service_role;

revoke all on function public.merge_service_order_metadata(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.merge_service_order_metadata(text, jsonb)
  to service_role;

revoke all on function public.admin_set_order_status(text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_set_order_status(text, text, text, uuid, text)
  to service_role;

do $migration$
begin
  if to_regprocedure('public.release_service_order_wallet(uuid,text)') is not null then
    revoke execute on function public.release_service_order_wallet(uuid, text)
      from public, anon, authenticated;
    grant execute on function public.release_service_order_wallet(uuid, text)
      to service_role;
  end if;

  if to_regprocedure('public.merge_service_order_metadata(uuid,jsonb)') is not null then
    revoke execute on function public.merge_service_order_metadata(uuid, jsonb)
      from public, anon, authenticated;
    grant execute on function public.merge_service_order_metadata(uuid, jsonb)
      to service_role;
  end if;

  if to_regprocedure('public.admin_set_order_status(uuid,text,text,uuid,text)') is not null then
    revoke execute on function public.admin_set_order_status(uuid, text, text, uuid, text)
      from public, anon, authenticated;
    grant execute on function public.admin_set_order_status(uuid, text, text, uuid, text)
      to service_role;
  end if;
end;
$migration$;

commit;

