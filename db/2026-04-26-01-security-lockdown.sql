begin;

alter table if exists public.app_users
  drop column if exists password_hash;

revoke execute on function public.admin_adjust_wallet_balance(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.create_service_order_tx(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.admin_adjust_wallet_balance(uuid, uuid, numeric, text) to service_role;
grant execute on function public.create_service_order_tx(uuid, text, integer, text) to service_role;

do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_approve_deposit', 'admin_toggle_customer_status')
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      v_function
    );
    execute format(
      'grant execute on function %s to service_role',
      v_function
    );
  end loop;
end $$;

revoke all on public.app_users from anon;
revoke all on public.audit_logs from anon;
revoke all on public.contact_messages from anon;
revoke all on public.deposits from anon;
revoke all on public.notifications from anon;
revoke all on public.order_items from anon;
revoke all on public.orders from anon;
revoke all on public.repair_bookings from anon;
revoke all on public.service_orders from anon;
revoke all on public.user_profiles from anon;
revoke all on public.wallet_transactions from anon;
revoke all on public.wallets from anon;

drop policy if exists local_admin_open_app_users on public.app_users;
drop policy if exists local_admin_open_audit_logs on public.audit_logs;
drop policy if exists local_admin_open_categories on public.categories;
drop policy if exists local_admin_open_contact_messages on public.contact_messages;
drop policy if exists local_admin_open_coupons on public.coupons;
drop policy if exists local_admin_open_deposits on public.deposits;
drop policy if exists local_admin_open_notifications on public.notifications;
drop policy if exists local_admin_open_order_items on public.order_items;
drop policy if exists local_admin_open_orders on public.orders;
drop policy if exists local_admin_open_products on public.products;
drop policy if exists local_admin_open_repair_bookings on public.repair_bookings;
drop policy if exists local_admin_open_repair_services on public.repair_services;
drop policy if exists local_admin_open_service_orders on public.service_orders;
drop policy if exists local_admin_open_services on public.services;
drop policy if exists local_admin_open_settings on public.settings;
drop policy if exists local_admin_open_user_profiles on public.user_profiles;
drop policy if exists local_admin_open_wallet_transactions on public.wallet_transactions;
drop policy if exists local_admin_open_wallets on public.wallets;

create or replace function public.guard_user_profile_sensitive_fields()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_actor_is_admin boolean := false;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if v_actor_role = 'service_role' then
    return new;
  end if;

  if v_actor_user_id is not null then
    v_actor_is_admin := public.is_admin_user(v_actor_user_id);
  end if;

  if v_actor_is_admin then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if public.is_admin_role(new.role)
      or coalesce(new.status, 'active') <> 'active'
      or nullif(trim(coalesce(new.ban_reason, '')), '') is not null then
      raise exception 'Sensitive profile fields require admin approval';
    end if;

    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.status is distinct from old.status
    or coalesce(new.ban_reason, '') is distinct from coalesce(old.ban_reason, '') then
    raise exception 'Sensitive profile fields require admin approval';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_guard_sensitive_fields on public.user_profiles;
create trigger trg_user_profiles_guard_sensitive_fields
before insert or update on public.user_profiles
for each row
execute function public.guard_user_profile_sensitive_fields();

create or replace function public.admin_adjust_wallet_balance(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_amount numeric,
  p_reason text default null
)
returns table(
  wallet_id uuid,
  new_balance numeric,
  transaction_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_effective_admin_id uuid;
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_new_balance numeric;
begin
  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception 'Amount cannot be zero';
  end if;

  if v_actor_user_id is not null and v_actor_user_id <> p_admin_user_id then
    raise exception 'Actor mismatch';
  end if;

  if v_actor_user_id is null and v_actor_role <> 'service_role' then
    raise exception 'Authentication required';
  end if;

  v_effective_admin_id := coalesce(v_actor_user_id, p_admin_user_id);
  if v_effective_admin_id is null or not public.is_admin_user(v_effective_admin_id) then
    raise exception 'Not authorized';
  end if;

  select *
    into v_wallet
  from public.wallets
  where user_id = p_target_user_id
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (p_target_user_id)
    on conflict (user_id) do nothing;

    select *
      into v_wallet
    from public.wallets
    where user_id = p_target_user_id
    for update;
  end if;

  if v_wallet.balance + p_amount < 0 then
    raise exception 'Insufficient wallet balance';
  end if;

  v_new_balance := v_wallet.balance + p_amount;

  update public.wallets
  set
    balance = v_new_balance,
    total_deposited = case when p_amount > 0 then total_deposited + p_amount else total_deposited end,
    total_spent = case when p_amount < 0 then total_spent + abs(p_amount) else total_spent end,
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
    p_target_user_id,
    'admin_adjustment',
    p_amount,
    v_new_balance,
    coalesce(nullif(trim(p_reason), ''), 'Admin adjustment'),
    v_effective_admin_id::text
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
    p_target_user_id,
    'تحديث على الرصيد',
    case
      when p_amount > 0 then 'تمت إضافة رصيد بقيمة ' || abs(p_amount)::text || ' د.أ'
      else 'تم خصم رصيد بقيمة ' || abs(p_amount)::text || ' د.أ'
    end,
    'info',
    'wallet_transaction',
    v_tx_id::text
  );

  return query
  select v_wallet.id, v_new_balance, v_tx_id;
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
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_effective_user_id uuid;
  v_service public.services%rowtype;
  v_wallet public.wallets%rowtype;
  v_total numeric;
  v_order_id text;
  v_new_balance numeric;
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
    created_at,
    updated_at
  )
  values (
    v_order_id,
    v_effective_user_id,
    v_service.id,
    v_service.name,
    nullif(trim(p_link), ''),
    p_quantity,
    coalesce(v_service.price, 0),
    coalesce(v_service.cost_price, 0),
    v_total,
    'pending',
    'default',
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
    'order',
    v_order_id
  );

  return query
  select v_order_id, v_total, v_new_balance, 'تم إنشاء الطلب بنجاح';
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'deposits',
  'deposits',
  false,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read deposit proofs" on storage.objects;
drop policy if exists "Authenticated users can read own deposit proofs" on storage.objects;
create policy "Authenticated users can read own deposit proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'deposits'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_current_admin()
  )
);

commit;
