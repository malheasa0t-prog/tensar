-- Migration: 2026-05-25-01 — Orange Money SMS operation tracking
-- Adds an auditable operation log for the Android SMS webhook and supports
-- proofless Orange Money deposit requests.

begin;

alter table public.deposits
  drop constraint if exists deposits_method_check;

alter table public.deposits
  add constraint deposits_method_check
  check (method in ('manual', 'gateway', 'bank_transfer', 'cash', 'orange_money'));

create index if not exists idx_deposits_orange_money_phone_amount_pending
  on public.deposits ((metadata->>'orange_money_payer_phone'), amount, created_at desc)
  where method = 'orange_money' and status = 'pending';

create table if not exists public.orange_money_logs (
  id uuid primary key default gen_random_uuid(),
  reference_id text,
  sender text,
  payer_phone text,
  normalized_phone text,
  amount numeric(12,2),
  status text not null default 'received'
    check (status in ('received', 'processed', 'unmatched', 'duplicate', 'ignored', 'failed')),
  target_type text
    check (target_type is null or target_type in ('order', 'service_order', 'deposit', 'direct_wallet_topup')),
  target_id text,
  user_id uuid references auth.users(id) on delete set null,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  sms_text text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_orange_money_logs_reference_id
  on public.orange_money_logs(reference_id)
  where reference_id is not null;

create index if not exists idx_orange_money_logs_status_created_at
  on public.orange_money_logs(status, created_at desc);

create index if not exists idx_orange_money_logs_user_id_created_at
  on public.orange_money_logs(user_id, created_at desc);

create index if not exists idx_orange_money_logs_phone_created_at
  on public.orange_money_logs(normalized_phone, created_at desc);

alter table public.orange_money_logs enable row level security;

revoke all on public.orange_money_logs from anon;
revoke all on public.orange_money_logs from authenticated;
grant select on public.orange_money_logs to authenticated;
grant all on public.orange_money_logs to service_role;

drop policy if exists orange_money_logs_admin_select on public.orange_money_logs;
create policy orange_money_logs_admin_select
on public.orange_money_logs for select
to authenticated
using (public.is_current_admin());

drop policy if exists orange_money_logs_service_manage on public.orange_money_logs;
create policy orange_money_logs_service_manage
on public.orange_money_logs for all
to service_role
using (true)
with check (true);

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

  if nullif(trim(coalesce(p_reference_id, '')), '') is not null then
    select *
      into v_existing_tx
    from public.wallet_transactions
    where reference_id = trim(p_reference_id)
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
    nullif(trim(coalesce(p_reference_id, '')), '')
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

do $$
begin
  if to_regprocedure('public.enable_realtime_for_table(regclass)') is not null then
    perform public.enable_realtime_for_table('public.orange_money_logs'::regclass);
  else
    begin
      alter publication supabase_realtime add table public.orange_money_logs;
    exception
      when duplicate_object or undefined_object or object_not_in_prerequisite_state then null;
    end;
  end if;
end;
$$;

commit;
