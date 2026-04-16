-- ============================================================
-- TechZone - Complete Supabase schema
-- Dynamic-first Supabase schema compatible with the current web application codebase
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- Generic helpers
-- ============================================================

create or replace function public.generate_prefixed_id(p_prefix text)
returns text
language sql
volatile
as $$
  select coalesce(p_prefix, '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_admin_role(p_role text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_role, '')) in ('super_admin', 'admin', 'technician', 'employee');
$$;

-- ============================================================
-- Core tables
-- ============================================================

create table if not exists public.settings (
  id bigint primary key default 1,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_singleton_id_check check (id = 1),
  constraint settings_data_is_object check (jsonb_typeof(data) = 'object')
);

create table if not exists public.app_users (
  id text primary key default public.generate_prefixed_id('app-'),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  role text not null default 'customer'
    check (role in ('customer', 'user', 'admin', 'super_admin', 'technician', 'employee')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'banned')),
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'customer'
    check (role in ('customer', 'user', 'admin', 'super_admin', 'technician', 'employee')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'banned')),
  ban_reason text,
  country text,
  bio text,
  preferred_language text not null default 'ar',
  preferred_currency text not null default 'JOD',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0.00 check (balance >= 0),
  reserved numeric(12,2) not null default 0.00 check (reserved >= 0),
  total_deposited numeric(12,2) not null default 0.00,
  total_spent numeric(12,2) not null default 0.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit', 'purchase', 'refund', 'admin_adjustment')),
  amount numeric(12,2) not null check (amount <> 0),
  balance_after numeric(12,2) not null,
  description text,
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key default public.generate_prefixed_id('cat-'),
  parent_id text references public.categories(id) on delete set null,
  name text not null,
  slug text,
  icon text,
  image text,
  description text,
  sort_order integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'hidden', 'draft', 'archived')),
  show_in_navbar boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key default public.generate_prefixed_id('prd-'),
  category_id text references public.categories(id) on delete set null,
  name text not null,
  slug text,
  brand text,
  sku text,
  product_type text not null default 'physical'
    check (product_type in ('physical', 'accessory', 'service', 'subscription', 'digital')),
  price numeric(12,2) not null default 0.00 check (price >= 0),
  discount_price numeric(12,2) check (discount_price is null or (discount_price >= 0 and discount_price <= price)),
  quantity integer not null default 0 check (quantity >= 0),
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  sold integer not null default 0 check (sold >= 0),
  status text not null default 'active'
    check (status in ('active', 'draft', 'out_of_stock', 'archived')),
  description text,
  specs jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  low_stock_alert integer not null default 5 check (low_stock_alert >= 0),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key default public.generate_prefixed_id('srv-'),
  category_id text references public.categories(id) on delete set null,
  subcategory_id text references public.categories(id) on delete set null,
  name text not null,
  slug text,
  provider_service_id text,
  price numeric(12,2) not null default 0.00 check (price >= 0),
  cost_price numeric(12,2) not null default 0.00 check (cost_price >= 0),
  min_qty integer not null default 1 check (min_qty > 0),
  max_qty integer not null default 1000 check (max_qty >= min_qty),
  description text,
  speed text,
  guarantee text,
  image text,
  status text not null default 'active'
    check (status in ('active', 'draft', 'paused', 'archived')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key default public.generate_prefixed_id('ord-'),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  status text not null default 'pending'
    check (status in ('pending', 'awaiting_delivery', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'failed', 'refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  payment_method text not null default 'cod'
    check (payment_method in ('cash', 'card', 'wallet', 'bank_transfer', 'cod')),
  delivery_method text not null default 'delivery'
    check (delivery_method in ('delivery', 'pickup')),
  subtotal numeric(12,2) not null default 0.00 check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0.00 check (discount_amount >= 0),
  shipping_fee numeric(12,2) not null default 0.00 check (shipping_fee >= 0),
  tax_amount numeric(12,2) not null default 0.00 check (tax_amount >= 0),
  total numeric(12,2) not null default 0.00 check (total >= 0),
  coupon_code text,
  notes text,
  shipping_address jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  qty integer not null check (qty > 0),
  price numeric(12,2) not null check (price >= 0),
  line_total numeric(12,2) generated always as ((qty::numeric) * price) stored,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.repair_services (
  id text primary key default public.generate_prefixed_id('rep-'),
  name text not null,
  slug text,
  category text,
  description text,
  price numeric(12,2) not null default 0.00 check (price >= 0),
  duration text,
  icon text,
  image text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.repair_bookings (
  id text primary key default public.generate_prefixed_id('bk-'),
  user_id uuid references auth.users(id) on delete set null,
  service_id text references public.repair_services(id) on delete set null,
  service_name text,
  name text not null,
  email text,
  phone text,
  device text not null,
  description text not null,
  preferred_date timestamptz,
  mode text not null default 'delivery'
    check (mode in ('delivery', 'pickup', 'onsite')),
  address text,
  status text not null default 'pending'
    check (status in ('pending', 'received', 'diagnosing', 'waiting_approval', 'in_progress', 'ready', 'completed', 'cancelled', 'rejected', 'confirmed')),
  admin_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id text primary key default public.generate_prefixed_id('msg-'),
  name text not null,
  email text,
  phone text,
  service_type text,
  subject text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'open', 'replied', 'closed', 'archived')),
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'محادثة مباشرة',
  status text not null default 'open'
    check (status in ('open', 'closed')),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  last_message_sender_role text not null default 'customer'
    check (last_message_sender_role in ('customer', 'admin')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null
    check (sender_role in ('customer', 'admin')),
  sender_name text not null,
  body text not null,
  is_read_by_customer boolean not null default false,
  is_read_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.service_orders (
  id text primary key default public.generate_prefixed_id('so-'),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id text references public.services(id) on delete set null,
  service_name text not null,
  link text,
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0),
  cost_price numeric(12,2) not null default 0.00 check (cost_price >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded')),
  external_order_id text,
  provider_name text default 'default',
  start_count integer,
  remains integer,
  admin_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id text references public.service_orders(id) on delete set null,
  name text not null,
  role text,
  text text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  product text,
  status text not null default 'active'
    check (status in ('active', 'pending', 'rejected', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id text primary key default public.generate_prefixed_id('cpn-'),
  code text not null,
  description text,
  type text not null check (type in ('percentage', 'fixed')),
  value numeric(12,2) not null check (value > 0),
  min_order numeric(12,2) not null default 0.00 check (min_order >= 0),
  max_discount numeric(12,2),
  max_uses integer,
  used_count integer not null default 0 check (used_count >= 0),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'manual' check (method in ('manual', 'gateway', 'bank_transfer', 'cash')),
  proof_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  reference_type text,
  reference_id text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key default public.generate_prefixed_id('log-'),
  action text not null,
  actor_id text,
  actor_email text,
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create unique index if not exists idx_app_users_email_unique
  on public.app_users ((lower(email)))
  where email is not null;

create index if not exists idx_app_users_role on public.app_users(role);
create index if not exists idx_app_users_status on public.app_users(status);
create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_status on public.user_profiles(status);
create index if not exists idx_wallet_transactions_user_id on public.wallet_transactions(user_id, created_at desc);
create index if not exists idx_wallet_transactions_reference_id on public.wallet_transactions(reference_id);
create index if not exists idx_categories_parent on public.categories(parent_id, sort_order);
create index if not exists idx_categories_status on public.categories(status, sort_order);
create unique index if not exists idx_categories_slug_unique
  on public.categories ((lower(slug)))
  where slug is not null;
create index if not exists idx_products_category_status on public.products(category_id, status);
create index if not exists idx_products_product_type on public.products(product_type, status);
create index if not exists idx_products_sold on public.products(sold desc);
create unique index if not exists idx_products_slug_unique
  on public.products ((lower(slug)))
  where slug is not null;
create index if not exists idx_services_category_status on public.services(category_id, status, sort_order);
create index if not exists idx_services_subcategory_status on public.services(subcategory_id, status, sort_order);
create unique index if not exists idx_services_slug_unique
  on public.services ((lower(slug)))
  where slug is not null;
create index if not exists idx_orders_user_id on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status, created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id, id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_repair_services_status on public.repair_services(status, sort_order);
create unique index if not exists idx_repair_services_slug_unique
  on public.repair_services ((lower(slug)))
  where slug is not null;
create index if not exists idx_repair_bookings_user_id on public.repair_bookings(user_id, created_at desc);
create index if not exists idx_repair_bookings_service_id on public.repair_bookings(service_id);
create index if not exists idx_repair_bookings_status on public.repair_bookings(status, created_at desc);
create index if not exists idx_repair_bookings_email on public.repair_bookings((lower(email)));
create index if not exists idx_repair_bookings_phone on public.repair_bookings(phone);
create index if not exists idx_contact_messages_status on public.contact_messages(status, created_at desc);
create index if not exists idx_support_conversations_user_id on public.support_conversations(user_id, last_message_at desc);
create index if not exists idx_support_conversations_status on public.support_conversations(status, last_message_at desc);
create index if not exists idx_support_chat_messages_conversation_id on public.support_chat_messages(conversation_id, created_at asc);
create index if not exists idx_service_orders_user_id on public.service_orders(user_id, created_at desc);
create index if not exists idx_service_orders_status on public.service_orders(status, created_at desc);
create index if not exists idx_service_orders_service_id on public.service_orders(service_id);
create index if not exists idx_reviews_status on public.reviews(status, sort_order, created_at desc);
create unique index if not exists idx_reviews_unique_order
  on public.reviews(order_id)
  where order_id is not null;
create unique index if not exists idx_coupons_code_unique
  on public.coupons ((lower(code)));
create index if not exists idx_coupons_status on public.coupons(status, expires_at);
create index if not exists idx_deposits_user_id on public.deposits(user_id, created_at desc);
create index if not exists idx_deposits_status on public.deposits(status, created_at desc);
create index if not exists idx_notifications_user_id on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs(action, created_at desc);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id, created_at desc);

-- ============================================================
-- updated_at triggers
-- ============================================================

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_wallets_updated_at on public.wallets;
create trigger trg_wallets_updated_at
before update on public.wallets
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
before update on public.services
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_repair_services_updated_at on public.repair_services;
create trigger trg_repair_services_updated_at
before update on public.repair_services
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_repair_bookings_updated_at on public.repair_bookings;
create trigger trg_repair_bookings_updated_at
before update on public.repair_bookings
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_contact_messages_updated_at on public.contact_messages;
create trigger trg_contact_messages_updated_at
before update on public.contact_messages
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_support_conversations_updated_at on public.support_conversations;
create trigger trg_support_conversations_updated_at
before update on public.support_conversations
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_service_orders_updated_at on public.service_orders;
create trigger trg_service_orders_updated_at
before update on public.service_orders
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
before update on public.coupons
for each row execute function public.set_updated_at_now();

drop trigger if exists trg_deposits_updated_at on public.deposits;
create trigger trg_deposits_updated_at
before update on public.deposits
for each row execute function public.set_updated_at_now();
-- ============================================================
-- Auth, admin, and business logic helpers
-- ============================================================

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_role text;
  v_email text;
begin
  if p_user_id is null then
    return false;
  end if;

  select role
    into v_role
  from public.user_profiles
  where user_id = p_user_id
    and coalesce(status, 'active') = 'active'
  limit 1;

  if public.is_admin_role(v_role) then
    return true;
  end if;

  select lower(coalesce(email, ''))
    into v_email
  from auth.users
  where id = p_user_id
  limit 1;

  if v_email <> '' then
    select role
      into v_role
    from public.app_users
    where lower(coalesce(email, '')) = v_email
      and coalesce(status, 'active') = 'active'
    limit 1;

    if public.is_admin_role(v_role) then
      return true;
    end if;
  end if;

  select role
    into v_role
  from public.app_users
  where auth_user_id = p_user_id
    and coalesce(status, 'active') = 'active'
  limit 1;

  return public.is_admin_role(v_role);
end;
$$;

create or replace function public.is_current_admin()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select public.is_admin_user(auth.uid());
$$;

create or replace function public.can_view_order_item(p_order_id text)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        o.user_id = auth.uid()
        or public.is_admin_user(auth.uid())
      )
  );
$$;

create or replace function public.can_view_repair_booking(
  p_user_id uuid,
  p_email text,
  p_phone text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_profile_phone text;
  v_auth_email text;
begin
  if public.is_admin_user(auth.uid()) then
    return true;
  end if;

  if auth.uid() is not null and p_user_id = auth.uid() then
    return true;
  end if;

  v_auth_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_auth_email <> '' and lower(coalesce(p_email, '')) = v_auth_email then
    return true;
  end if;

  select phone
    into v_profile_phone
  from public.user_profiles
  where user_id = auth.uid()
  limit 1;

  if coalesce(v_profile_phone, '') <> '' and coalesce(p_phone, '') = v_profile_phone then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.sync_legacy_app_user_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_name text;
begin
  select lower(coalesce(email, ''))
    into v_email
  from auth.users
  where id = new.user_id;

  v_name := coalesce(nullif(trim(new.full_name), ''), 'User-' || right(replace(new.user_id::text, '-', ''), 6));

  update public.app_users
  set
    auth_user_id = new.user_id,
    full_name = v_name,
    phone = new.phone,
    role = new.role,
    status = new.status,
    updated_at = now()
  where v_email <> ''
    and lower(coalesce(email, '')) = v_email;

  if not exists (select 1 from public.app_users where auth_user_id = new.user_id) then
    insert into public.app_users (
      auth_user_id,
      full_name,
      email,
      phone,
      role,
      status,
      created_at,
      updated_at
    )
    values (
      new.user_id,
      v_name,
      nullif(v_email, ''),
      new.phone,
      new.role,
      new.status,
      now(),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_sync_app_users on public.user_profiles;
create trigger trg_user_profiles_sync_app_users
after insert or update on public.user_profiles
for each row execute function public.sync_legacy_app_user_from_profile();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_full_name text;
  v_role text;
  v_email text;
begin
  v_email := lower(coalesce(new.email, ''));

  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(v_email, '@', 1), ''),
    'User-' || right(replace(new.id::text, '-', ''), 6)
  );

  if exists (select 1 from public.user_profiles where public.is_admin_role(role)) then
    v_role := 'customer';
  else
    v_role := 'super_admin';
  end if;

  insert into public.user_profiles (
    user_id,
    full_name,
    phone,
    role,
    status,
    preferred_language,
    preferred_currency,
    created_at,
    updated_at
  )
  values (
    new.id,
    v_full_name,
    nullif(trim(new.phone), ''),
    v_role,
    'active',
    'ar',
    'JOD',
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    full_name = coalesce(nullif(excluded.full_name, ''), public.user_profiles.full_name),
    phone = coalesce(excluded.phone, public.user_profiles.phone),
    updated_at = now();

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.app_users (
    auth_user_id,
    full_name,
    email,
    phone,
    role,
    status,
    created_at,
    updated_at
  )
  values (
    new.id,
    v_full_name,
    nullif(v_email, ''),
    nullif(trim(new.phone), ''),
    v_role,
    'active',
    now(),
    now()
  )
  on conflict (auth_user_id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    status = excluded.status,
    updated_at = now();

  insert into public.notifications (user_id, title, body, type, reference_type)
  values (
    new.id,
    'مرحباً بك في TechZone',
    case when v_role = 'super_admin'
      then 'تم إنشاء حسابك كمدير أول بشكل تلقائي لأن هذا أول حساب في النظام.'
      else 'تم إنشاء حسابك بنجاح ويمكنك الآن متابعة الطلبات والخدمات من لوحة المستخدم.'
    end,
    'success',
    'welcome'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.user_profiles (
  user_id,
  full_name,
  phone,
  role,
  status,
  preferred_language,
  preferred_currency,
  created_at,
  updated_at
)
select
  au.id,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(lower(coalesce(au.email, '')), '@', 1), ''),
    'User-' || right(replace(au.id::text, '-', ''), 6)
  ),
  nullif(trim(au.phone), ''),
  'customer',
  'active',
  'ar',
  'JOD',
  coalesce(au.created_at, now()),
  now()
from auth.users au
on conflict (user_id) do update
set
  full_name = coalesce(nullif(excluded.full_name, ''), public.user_profiles.full_name),
  phone = coalesce(excluded.phone, public.user_profiles.phone),
  updated_at = now();

insert into public.wallets (user_id)
select au.id
from auth.users au
on conflict (user_id) do nothing;

insert into public.app_users (
  auth_user_id,
  full_name,
  email,
  phone,
  role,
  status,
  created_at,
  updated_at
)
select
  au.id,
  coalesce(
    nullif(trim(up.full_name), ''),
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(lower(coalesce(au.email, '')), '@', 1), ''),
    'User-' || right(replace(au.id::text, '-', ''), 6)
  ),
  nullif(lower(coalesce(au.email, '')), ''),
  coalesce(up.phone, nullif(trim(au.phone), '')),
  coalesce(up.role, 'customer'),
  coalesce(up.status, 'active'),
  coalesce(au.created_at, now()),
  now()
from auth.users au
left join public.user_profiles up on up.user_id = au.id
where not exists (
  select 1 from public.app_users existing where existing.auth_user_id = au.id
);

do $$
declare
  v_admin_user uuid;
begin
  if not exists (select 1 from public.user_profiles where public.is_admin_role(role)) then
    select au.id
      into v_admin_user
    from auth.users au
    where lower(coalesce(au.email, '')) = 'admin@techzone.local'
    order by au.created_at asc
    limit 1;

    if v_admin_user is null then
      select au.id
        into v_admin_user
      from auth.users au
      order by au.created_at asc
      limit 1;
    end if;

    if v_admin_user is not null then
      update public.user_profiles
      set role = 'super_admin', status = 'active', updated_at = now()
      where user_id = v_admin_user;

      update public.app_users
      set role = 'super_admin', status = 'active', updated_at = now()
      where auth_user_id = v_admin_user;
    end if;
  end if;
end $$;

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
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_new_balance numeric;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'Amount cannot be zero';
  end if;

  if not public.is_admin_user(p_admin_user_id) then
    raise exception 'Not authorized';
  end if;

  select *
    into v_wallet
  from public.wallets
  where user_id = p_target_user_id
  for update;

  if not found then
    insert into public.wallets (user_id) values (p_target_user_id)
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
    p_admin_user_id::text
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
  v_service public.services%rowtype;
  v_wallet public.wallets%rowtype;
  v_total numeric;
  v_order_id text;
  v_new_balance numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than 0';
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
  where user_id = p_user_id
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
    p_user_id,
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
    p_user_id,
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
    p_user_id,
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
-- ============================================================
-- Row level security
-- ============================================================

alter table public.settings enable row level security;
alter table public.app_users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.repair_services enable row level security;
alter table public.repair_bookings enable row level security;
alter table public.contact_messages enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_chat_messages enable row level security;
alter table public.service_orders enable row level security;
alter table public.reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.deposits enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- settings

drop policy if exists settings_read_public on public.settings;
create policy settings_read_public
on public.settings for select
using (true);

drop policy if exists settings_admin_all on public.settings;
create policy settings_admin_all
on public.settings for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- app_users

drop policy if exists app_users_admin_read on public.app_users;
create policy app_users_admin_read
on public.app_users for select
using (public.is_current_admin());

drop policy if exists app_users_admin_manage on public.app_users;
create policy app_users_admin_manage
on public.app_users for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- user_profiles

drop policy if exists user_profiles_select_own_or_admin on public.user_profiles;
create policy user_profiles_select_own_or_admin
on public.user_profiles for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists user_profiles_insert_own_or_admin on public.user_profiles;
create policy user_profiles_insert_own_or_admin
on public.user_profiles for insert
with check (auth.uid() = user_id or public.is_current_admin());

drop policy if exists user_profiles_update_own_or_admin on public.user_profiles;
create policy user_profiles_update_own_or_admin
on public.user_profiles for update
using (auth.uid() = user_id or public.is_current_admin())
with check (auth.uid() = user_id or public.is_current_admin());

drop policy if exists user_profiles_delete_admin on public.user_profiles;
create policy user_profiles_delete_admin
on public.user_profiles for delete
using (public.is_current_admin());

-- wallets

drop policy if exists wallets_select_own_or_admin on public.wallets;
create policy wallets_select_own_or_admin
on public.wallets for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists wallets_admin_manage on public.wallets;
create policy wallets_admin_manage
on public.wallets for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- wallet_transactions

drop policy if exists wallet_transactions_select_own_or_admin on public.wallet_transactions;
create policy wallet_transactions_select_own_or_admin
on public.wallet_transactions for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists wallet_transactions_admin_manage on public.wallet_transactions;
create policy wallet_transactions_admin_manage
on public.wallet_transactions for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- categories

drop policy if exists categories_public_read_active on public.categories;
create policy categories_public_read_active
on public.categories for select
using (status = 'active' or public.is_current_admin());

drop policy if exists categories_admin_manage on public.categories;
create policy categories_admin_manage
on public.categories for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- products

drop policy if exists products_public_read_active on public.products;
create policy products_public_read_active
on public.products for select
using (status = 'active' or public.is_current_admin());

drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage
on public.products for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- services

drop policy if exists services_public_read_active on public.services;
create policy services_public_read_active
on public.services for select
using (status = 'active' or public.is_current_admin());

drop policy if exists services_admin_manage on public.services;
create policy services_admin_manage
on public.services for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- orders

drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin
on public.orders for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists orders_insert_own_or_admin on public.orders;
create policy orders_insert_own_or_admin
on public.orders for insert
with check (
  public.is_current_admin()
  or (auth.uid() is not null and auth.uid() = user_id)
);

drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin
on public.orders for update
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists orders_delete_admin on public.orders;
create policy orders_delete_admin
on public.orders for delete
using (public.is_current_admin());

-- order_items

drop policy if exists order_items_select_related on public.order_items;
create policy order_items_select_related
on public.order_items for select
using (public.can_view_order_item(order_id) or public.is_current_admin());

drop policy if exists order_items_insert_related_or_admin on public.order_items;
create policy order_items_insert_related_or_admin
on public.order_items for insert
with check (public.can_view_order_item(order_id) or public.is_current_admin());

drop policy if exists order_items_update_admin on public.order_items;
create policy order_items_update_admin
on public.order_items for update
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists order_items_delete_admin on public.order_items;
create policy order_items_delete_admin
on public.order_items for delete
using (public.is_current_admin());

-- repair_services

drop policy if exists repair_services_public_read_active on public.repair_services;
create policy repair_services_public_read_active
on public.repair_services for select
using (status = 'active' or public.is_current_admin());

drop policy if exists repair_services_admin_manage on public.repair_services;
create policy repair_services_admin_manage
on public.repair_services for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- repair_bookings

drop policy if exists repair_bookings_select_owner_or_admin on public.repair_bookings;
create policy repair_bookings_select_owner_or_admin
on public.repair_bookings for select
using (public.can_view_repair_booking(user_id, email, phone));

drop policy if exists repair_bookings_insert_public on public.repair_bookings;
create policy repair_bookings_insert_public
on public.repair_bookings for insert
to anon, authenticated
with check (
  (
    public.is_current_admin()
    or coalesce(status, 'pending') = 'pending'
  )
  and (
    user_id is null
    or user_id = auth.uid()
    or public.is_current_admin()
  )
);

drop policy if exists repair_bookings_update_admin on public.repair_bookings;
create policy repair_bookings_update_admin
on public.repair_bookings for update
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists repair_bookings_delete_admin on public.repair_bookings;
create policy repair_bookings_delete_admin
on public.repair_bookings for delete
using (public.is_current_admin());

-- contact_messages

drop policy if exists contact_messages_insert_public on public.contact_messages;
create policy contact_messages_insert_public
on public.contact_messages for insert
to anon, authenticated
with check (
  public.is_current_admin()
  or coalesce(status, 'new') = 'new'
);

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read
on public.contact_messages for select
using (public.is_current_admin());

drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update
on public.contact_messages for update
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists contact_messages_admin_delete on public.contact_messages;
create policy contact_messages_admin_delete
on public.contact_messages for delete
using (public.is_current_admin());

-- support_conversations

drop policy if exists support_conversations_select_own_or_admin on public.support_conversations;
create policy support_conversations_select_own_or_admin
on public.support_conversations for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists support_conversations_insert_own_or_admin on public.support_conversations;
create policy support_conversations_insert_own_or_admin
on public.support_conversations for insert
to authenticated
with check (auth.uid() = user_id or public.is_current_admin());

drop policy if exists support_conversations_update_own_or_admin on public.support_conversations;
create policy support_conversations_update_own_or_admin
on public.support_conversations for update
using (auth.uid() = user_id or public.is_current_admin())
with check (auth.uid() = user_id or public.is_current_admin());

drop policy if exists support_conversations_delete_admin on public.support_conversations;
create policy support_conversations_delete_admin
on public.support_conversations for delete
using (public.is_current_admin());

-- support_chat_messages

drop policy if exists support_chat_messages_select_own_or_admin on public.support_chat_messages;
create policy support_chat_messages_select_own_or_admin
on public.support_chat_messages for select
using (
  exists (
    select 1
    from public.support_conversations conversations
    where conversations.id = conversation_id
      and (conversations.user_id = auth.uid() or public.is_current_admin())
  )
);

drop policy if exists support_chat_messages_insert_own_or_admin on public.support_chat_messages;
create policy support_chat_messages_insert_own_or_admin
on public.support_chat_messages for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.support_conversations conversations
    where conversations.id = conversation_id
      and (
        (sender_role = 'customer' and conversations.user_id = auth.uid())
        or public.is_current_admin()
      )
  )
);

drop policy if exists support_chat_messages_update_own_or_admin on public.support_chat_messages;
create policy support_chat_messages_update_own_or_admin
on public.support_chat_messages for update
using (
  exists (
    select 1
    from public.support_conversations conversations
    where conversations.id = conversation_id
      and (conversations.user_id = auth.uid() or public.is_current_admin())
  )
)
with check (
  exists (
    select 1
    from public.support_conversations conversations
    where conversations.id = conversation_id
      and (conversations.user_id = auth.uid() or public.is_current_admin())
  )
);

drop policy if exists support_chat_messages_delete_admin on public.support_chat_messages;
create policy support_chat_messages_delete_admin
on public.support_chat_messages for delete
using (public.is_current_admin());

-- service_orders

drop policy if exists service_orders_select_own_or_admin on public.service_orders;
create policy service_orders_select_own_or_admin
on public.service_orders for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists service_orders_insert_own_or_admin on public.service_orders;
create policy service_orders_insert_own_or_admin
on public.service_orders for insert
with check (auth.uid() = user_id or public.is_current_admin());

drop policy if exists service_orders_update_admin on public.service_orders;
create policy service_orders_update_admin
on public.service_orders for update
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists service_orders_delete_admin on public.service_orders;
create policy service_orders_delete_admin
on public.service_orders for delete
using (public.is_current_admin());

-- reviews

drop policy if exists reviews_public_read_active on public.reviews;
create policy reviews_public_read_active
on public.reviews for select
using (status = 'active' or public.is_current_admin());

drop policy if exists reviews_insert_authenticated on public.reviews;
create policy reviews_insert_authenticated
on public.reviews for insert
to authenticated
with check (
  (user_id is null or user_id = auth.uid())
  and (
    public.is_current_admin()
    or coalesce(status, 'pending') = 'pending'
  )
);

drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update
on public.reviews for update
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists reviews_admin_delete on public.reviews;
create policy reviews_admin_delete
on public.reviews for delete
using (public.is_current_admin());

-- coupons

drop policy if exists coupons_public_read_active on public.coupons;
create policy coupons_public_read_active
on public.coupons for select
using (
  (status = 'active' and (expires_at is null or expires_at > now()))
  or public.is_current_admin()
);

drop policy if exists coupons_admin_manage on public.coupons;
create policy coupons_admin_manage
on public.coupons for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- deposits

drop policy if exists deposits_select_own_or_admin on public.deposits;
create policy deposits_select_own_or_admin
on public.deposits for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists deposits_insert_own on public.deposits;
create policy deposits_insert_own
on public.deposits for insert
to authenticated
with check (auth.uid() = user_id and coalesce(status, 'pending') = 'pending');

drop policy if exists deposits_update_admin on public.deposits;
create policy deposits_update_admin
on public.deposits for update
using (public.is_current_admin())
with check (public.is_current_admin());

drop policy if exists deposits_delete_admin on public.deposits;
create policy deposits_delete_admin
on public.deposits for delete
using (public.is_current_admin());

-- notifications

drop policy if exists notifications_select_own_or_admin on public.notifications;
create policy notifications_select_own_or_admin
on public.notifications for select
using (auth.uid() = user_id or public.is_current_admin());

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin
on public.notifications for insert
with check (public.is_current_admin());

drop policy if exists notifications_update_own_or_admin on public.notifications;
create policy notifications_update_own_or_admin
on public.notifications for update
using (auth.uid() = user_id or public.is_current_admin())
with check (auth.uid() = user_id or public.is_current_admin());

drop policy if exists notifications_delete_admin on public.notifications;
create policy notifications_delete_admin
on public.notifications for delete
using (public.is_current_admin());

-- audit_logs

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
on public.audit_logs for select
using (public.is_current_admin());

drop policy if exists audit_logs_admin_manage on public.audit_logs;
create policy audit_logs_admin_manage
on public.audit_logs for all
using (public.is_current_admin())
with check (public.is_current_admin());

-- Grants
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

grant select on public.settings to anon;
grant select on public.categories to anon;
grant select on public.products to anon;
grant select on public.services to anon;
grant select on public.repair_services to anon;
grant select on public.reviews to anon;
grant select on public.coupons to anon;
grant insert on public.contact_messages to anon;
grant insert on public.repair_bookings to anon;

-- Optional richer realtime payloads
alter table public.settings replica identity full;
alter table public.wallets replica identity full;
alter table public.wallet_transactions replica identity full;
alter table public.categories replica identity full;
alter table public.products replica identity full;
alter table public.services replica identity full;
alter table public.orders replica identity full;
alter table public.order_items replica identity full;
alter table public.repair_services replica identity full;
alter table public.repair_bookings replica identity full;
alter table public.contact_messages replica identity full;
alter table public.support_conversations replica identity full;
alter table public.support_chat_messages replica identity full;
alter table public.service_orders replica identity full;
alter table public.coupons replica identity full;
alter table public.deposits replica identity full;
alter table public.notifications replica identity full;
-- ============================================================
-- Seed data
-- ============================================================

insert into public.settings (id, data)
values (
  1,
  $json$
  {
    "company": {
      "name": "TechZone",
      "slogan": "متجرك الذكي للأجهزة التقنية وخدمات الصيانة الاحترافية.",
      "phone": "+962790000000",
      "email": "info@techzone.local",
      "address": "عمّان - الأردن"
    },
    "social": {
      "whatsapp": "https://wa.me/962790000000",
      "instagram": "https://instagram.com/techzone.jo",
      "facebook": "https://facebook.com/techzone.jo",
      "youtube": "https://youtube.com/@techzonejo",
      "telegram": "https://t.me/techzonejo",
      "tiktok": "",
      "x": "",
      "snapchat": "",
      "linkedin": ""
    },
    "homepage": {
      "marquee": {
        "enabled": true,
        "items": [
          "عروض خاصة على اللابتوبات والأجهزة المكتبية",
          "خدمة صيانة وتجميع احترافية مع متابعة واضحة",
          "إكسسوارات أصلية وتجهيزات ألعاب بأسعار منافسة"
        ]
      },
      "promoBanners": [
        {
          "title": "عروض اللابتوبات",
          "subtitle": "أجهزة للعمل والدراسة والألعاب",
          "image": "https://placehold.co/1200x360/png?text=TechZone+Laptops",
          "href": "/products"
        },
        {
          "title": "إكسسوارات الألعاب",
          "subtitle": "ماوسات ولوحات مفاتيح وسماعات",
          "image": "https://placehold.co/1200x360/png?text=Gaming+Accessories",
          "href": "/accessories"
        },
        {
          "title": "خدمات الصيانة",
          "subtitle": "فحص وصيانة وترقية باحترافية",
          "image": "https://placehold.co/1200x360/png?text=Repair+Services",
          "href": "/services"
        }
      ]
    },
    "hero": {
      "trustBadge": "متجر وصيانة احترافية في الأردن تخدم آلاف العملاء",
      "title": "عالمك التقني",
      "titleHighlight": "يبدأ من هنا",
      "description": "نوفر لك أجهزة كمبيوتر، لابتوبات، إكسسوارات، وخدمات صيانة وتجميع احترافية ضمن تجربة شراء واضحة وسريعة."
    },
    "trustBar": [
      { "icon": "truck", "title": "توصيل سريع", "subtitle": "داخل عمّان وخارجها" },
      { "icon": "shield-check", "title": "ضمان موثوق", "subtitle": "على المنتجات والخدمات المؤهلة" },
      { "icon": "headphones", "title": "دعم متواصل", "subtitle": "فريق جاهز للإجابة والمتابعة" }
    ],
    "stats": [
      { "value": 12000, "suffix": "+", "label": "عميل نشط", "hint": "أفراد وشركات يثقون بنا", "icon": "user", "accent": "#22c55e", "glow": "rgba(34,197,94,0.24)" },
      { "value": 34000, "suffix": "+", "label": "طلبات منجزة", "hint": "عمليات بيع وخدمة مستمرة", "icon": "shopping-bag", "accent": "#38bdf8", "glow": "rgba(56,189,248,0.24)" },
      { "value": 24, "suffix": "h", "label": "متوسط الصيانة", "hint": "تشخيص وفحص أسرع", "icon": "clock", "accent": "#f59e0b", "glow": "rgba(245,158,11,0.22)" },
      { "value": 98, "suffix": "%", "label": "رضا العملاء", "hint": "تجربة موثوقة بعد كل طلب", "icon": "shield-check", "accent": "#34d399", "glow": "rgba(52,211,153,0.22)" }
    ],
    "customBuild": {
      "badge": "⚙️ تجميع احترافي",
      "title": "صمم جهاز أحلامك",
      "titleHighlight": "",
      "description": "نقدم خدمة تجميع أجهزة الكمبيوتر حسب الطلب مع أفضل القطع وتركيب احترافي وفحص شامل قبل التسليم.",
      "features": [
        "استشارة مجانية لاختيار القطع",
        "تركيب احترافي وترتيب نظيف للكيابل",
        "تثبيت النظام والتعريفات الأساسية",
        "فحص شامل للحرارة والأداء"
      ],
      "ctaLabel": "اطلب تجميعة الآن",
      "ctaHref": "/services"
    },
    "serviceFeatures": [
      { "icon": "zap", "title": "استجابة سريعة", "subtitle": "تشخيص أولي واضح وسريع" },
      { "icon": "shield-check", "title": "قطع أصلية", "subtitle": "جودة أعلى واعتمادية أفضل" },
      { "icon": "phone", "title": "متابعة واضحة", "subtitle": "تحديثات مستمرة على حالة الطلب" }
    ],
    "paymentMethods": [
      { "value": "cod", "label": "الدفع عند الاستلام" },
      { "value": "bank_transfer", "label": "تحويل بنكي" },
      { "value": "wallet", "label": "محفظة" }
    ],
    "deliveryMethods": [
      { "value": "delivery", "label": "توصيل" },
      { "value": "pickup", "label": "استلام من المحل" }
    ],
    "serviceTypes": [
      { "value": "صيانة عاجلة", "label": "صيانة عاجلة" },
      { "value": "تجميعة مخصصة", "label": "تجميعة مخصصة" },
      { "value": "ترقية جهاز", "label": "ترقية جهاز" },
      { "value": "تنصيب برمجيات", "label": "تنصيب برمجيات" }
    ],
    "navigation": {
      "headerBefore": [
        { "href": "/", "label": "الرئيسية" },
        { "href": "/products", "label": "المنتجات" },
        { "href": "/accessories", "label": "الإكسسوارات" }
      ],
      "headerAfter": [
        { "href": "/services", "label": "خدمات الصيانة" },
        { "href": "/contact", "label": "تواصل معنا" }
      ],
      "footerQuick": [
        { "href": "/", "label": "الرئيسية" },
        { "href": "/products", "label": "المنتجات" },
        { "href": "/accessories", "label": "الإكسسوارات" },
        { "href": "/subscriptions", "label": "الشحن والاشتراكات" },
        { "href": "/services", "label": "الصيانة" }
      ],
      "footerSupport": [
        { "href": "/dashboard", "label": "حسابي" },
        { "href": "/checkout", "label": "إتمام الشراء" },
        { "href": "/contact", "label": "التواصل" }
      ],
      "footerBar": [
        { "href": "/products", "label": "المنتجات" },
        { "href": "/contact", "label": "التواصل" }
      ],
      "mobilePrimary": [
        { "href": "/products", "label": "تسوق" },
        { "href": "/services", "label": "الصيانة" },
        { "href": "/subscriptions", "label": "الاشتراكات" },
        { "href": "/contact", "label": "التواصل" }
      ]
    },
    "categoryNavVisibility": {}
  }
  $json$::jsonb
)
on conflict (id) do update
set
  data = case
    when coalesce(public.settings.data, '{}'::jsonb) = '{}'::jsonb then excluded.data
    else public.settings.data
  end,
  updated_at = now();

insert into public.categories (
  id,
  parent_id,
  name,
  slug,
  icon,
  image,
  description,
  sort_order,
  status,
  show_in_navbar,
  metadata
)
values
  ('cat-computers', null, 'أجهزة الكمبيوتر', 'computers', 'monitor', 'https://placehold.co/640x480/png?text=Computers', 'الفئة الرئيسية للأجهزة المكتبية واللابتوبات وملحقاتها الأساسية.', 1, 'active', true, '{}'::jsonb),
  ('cat-accessories-direct-items', null, 'إكسسوارات', 'accessories', 'mouse', 'https://placehold.co/640x480/png?text=Accessories', 'قسم مباشر لعرض الإكسسوارات والملحقات التقنية.', 2, 'active', true, '{}'::jsonb),
  ('cat-digital', null, 'الخدمات الرقمية', 'digital-services', 'sparkles', 'https://placehold.co/640x480/png?text=Digital+Services', 'خدمات رقمية واشتراكات قابلة للطلب مباشرة.', 3, 'active', true, '{}'::jsonb),
  ('cat-repairs', null, 'الصيانة', 'repairs', 'wrench', 'https://placehold.co/640x480/png?text=Repairs', 'خدمات صيانة الأجهزة والترقيات والتجميع.', 4, 'active', false, '{}'::jsonb),
  ('cat-laptops', 'cat-computers', 'لابتوبات', 'laptops', 'laptop', 'https://placehold.co/640x480/png?text=Laptops', 'أجهزة لابتوب للعمل والدراسة والأعمال.', 10, 'active', true, '{}'::jsonb),
  ('cat-components', 'cat-computers', 'قطع الكمبيوتر', 'components', 'cpu', 'https://placehold.co/640x480/png?text=Components', 'بطاقات شاشة، معالجات، ذواكر، وتخزين.', 11, 'active', true, '{}'::jsonb),
  ('cat-gaming', 'cat-computers', 'أجهزة ألعاب', 'gaming-pcs', 'gamepad-2', 'https://placehold.co/640x480/png?text=Gaming+PCs', 'أجهزة ألعاب وتجميعات عالية الأداء.', 12, 'active', true, '{}'::jsonb)
on conflict (id) do update
set
  parent_id = excluded.parent_id,
  name = excluded.name,
  slug = excluded.slug,
  icon = excluded.icon,
  image = excluded.image,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  show_in_navbar = excluded.show_in_navbar,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.products (
  id,
  category_id,
  name,
  slug,
  brand,
  sku,
  product_type,
  price,
  discount_price,
  quantity,
  rating,
  sold,
  status,
  description,
  specs,
  images,
  variants,
  low_stock_alert,
  is_featured
)
values
  (
    'prd-laptop-pro-14',
    'cat-laptops',
    'Laptop Pro 14',
    'laptop-pro-14',
    'Lenovo',
    'TZ-LTP-14',
    'physical',
    899.00,
    849.00,
    8,
    4.8,
    124,
    'active',
    'لابتوب عملي بشاشة 14 إنش ومعالج حديث مناسب للدراسة والعمل اليومي.',
    '{"cpu":"Intel Core i7","ram":"16GB","storage":"512GB SSD","display":"14-inch IPS"}'::jsonb,
    '["https://placehold.co/900x700/png?text=Laptop+Pro+14"]'::jsonb,
    '[]'::jsonb,
    3,
    true
  ),
  (
    'prd-gaming-rig-x',
    'cat-gaming',
    'Gaming Rig X',
    'gaming-rig-x',
    'TechZone',
    'TZ-GMR-X',
    'physical',
    1499.00,
    1399.00,
    4,
    4.9,
    68,
    'active',
    'تجميعة ألعاب جاهزة بأداء قوي ودعم لتشغيل أحدث الألعاب وبرامج التصميم.',
    '{"cpu":"Ryzen 7","gpu":"RTX 4070","ram":"32GB","storage":"1TB NVMe"}'::jsonb,
    '["https://placehold.co/900x700/png?text=Gaming+Rig+X"]'::jsonb,
    '[]'::jsonb,
    2,
    true
  ),
  (
    'prd-rtx4070ti-super',
    'cat-components',
    'RTX 4070 Ti Super',
    'rtx-4070-ti-super',
    'NVIDIA',
    'TZ-GPU-4070TI',
    'physical',
    999.00,
    null,
    6,
    4.7,
    32,
    'active',
    'بطاقة رسومية قوية للألعاب والإنتاجية مع أداء ممتاز على 1440p و4K.',
    '{"memory":"16GB GDDR6X","rayTracing":true,"power":"285W"}'::jsonb,
    '["https://placehold.co/900x700/png?text=RTX+4070+Ti+Super"]'::jsonb,
    '[]'::jsonb,
    2,
    false
  ),
  (
    'prd-rgb-mouse',
    null,
    'ماوس ألعاب RGB لاسلكي',
    'rgb-wireless-mouse',
    'Redragon',
    'TZ-ACC-MSE01',
    'accessory',
    29.00,
    24.00,
    12,
    4.6,
    210,
    'active',
    'ماوس لاسلكي مخصص للألعاب بإضاءة RGB ودقة عالية.',
    '{"dpi":"16000","connection":"2.4G / USB-C","buttons":7}'::jsonb,
    '["https://placehold.co/900x700/png?text=RGB+Mouse"]'::jsonb,
    '[]'::jsonb,
    5,
    true
  ),
  (
    'prd-mech-keyboard',
    null,
    'لوحة مفاتيح ميكانيكية',
    'mechanical-keyboard',
    'Logitech',
    'TZ-ACC-KB01',
    'accessory',
    79.00,
    69.00,
    9,
    4.7,
    155,
    'active',
    'كيبورد ميكانيكي بإضاءة خلفية ومفاتيح مريحة للاستخدام المطول.',
    '{"switches":"Blue","layout":"Arabic / English","connection":"USB"}'::jsonb,
    '["https://placehold.co/900x700/png?text=Mechanical+Keyboard"]'::jsonb,
    '[]'::jsonb,
    4,
    false
  )
on conflict (id) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  slug = excluded.slug,
  brand = excluded.brand,
  sku = excluded.sku,
  product_type = excluded.product_type,
  price = excluded.price,
  discount_price = excluded.discount_price,
  quantity = excluded.quantity,
  rating = excluded.rating,
  sold = excluded.sold,
  status = excluded.status,
  description = excluded.description,
  specs = excluded.specs,
  images = excluded.images,
  variants = excluded.variants,
  low_stock_alert = excluded.low_stock_alert,
  is_featured = excluded.is_featured,
  updated_at = now();

insert into public.services (
  id,
  category_id,
  subcategory_id,
  name,
  slug,
  provider_service_id,
  price,
  cost_price,
  min_qty,
  max_qty,
  description,
  speed,
  guarantee,
  image,
  status,
  sort_order,
  metadata
)
values
  ('srv-social-boost', 'cat-digital', null, 'زيادة متابعين إنستغرام', 'instagram-boost', 'IG-BOOST-001', 4.50, 3.20, 100, 10000, 'خدمة رقمية لزيادة التفاعل والمتابعين بشكل تدريجي.', 'من 1 إلى 24 ساعة', 'ضمان استبدال جزئي', 'https://placehold.co/900x700/png?text=Instagram+Boost', 'active', 1, '{}'::jsonb),
  ('srv-gift-card', 'cat-digital', null, 'بطاقة شحن ألعاب', 'gaming-gift-card', 'GIFT-100', 10.00, 8.50, 1, 50, 'بطاقات شحن رقمية للألعاب والمنصات المعتمدة.', 'فوري', 'مضمون', 'https://placehold.co/900x700/png?text=Gift+Card', 'active', 2, '{}'::jsonb),
  ('srv-subscription-pro', 'cat-digital', null, 'اشتراك خدمة برو', 'pro-subscription', 'SUB-PRO-01', 15.00, 11.00, 1, 12, 'اشتراك رقمي متجدد للوصول إلى مزايا إضافية.', 'خلال دقائق', 'مضمون', 'https://placehold.co/900x700/png?text=Pro+Subscription', 'active', 3, '{}'::jsonb)
on conflict (id) do update
set
  category_id = excluded.category_id,
  subcategory_id = excluded.subcategory_id,
  name = excluded.name,
  slug = excluded.slug,
  provider_service_id = excluded.provider_service_id,
  price = excluded.price,
  cost_price = excluded.cost_price,
  min_qty = excluded.min_qty,
  max_qty = excluded.max_qty,
  description = excluded.description,
  speed = excluded.speed,
  guarantee = excluded.guarantee,
  image = excluded.image,
  status = excluded.status,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.repair_services (
  id,
  name,
  slug,
  category,
  description,
  price,
  duration,
  icon,
  image,
  status,
  sort_order,
  metadata
)
values
  ('rsv-laptop-repair', 'صيانة لابتوب', 'laptop-repair', 'hardware', 'فحص وصيانة مشاكل اللابتوبات مثل الشاشة والبطارية واللوحة الأم.', 15.00, '1-3 أيام', 'laptop', 'https://placehold.co/900x700/png?text=Laptop+Repair', 'active', 1, '{}'::jsonb),
  ('rsv-custom-build', 'تجميع جهاز حسب الطلب', 'custom-pc-build', 'build', 'خدمة اختيار القطع وتجميع الجهاز وترتيبه وفحصه قبل التسليم.', 25.00, '1-2 أيام', 'cpu', 'https://placehold.co/900x700/png?text=Custom+Build', 'active', 2, '{}'::jsonb),
  ('rsv-upgrade-service', 'ترقية جهاز', 'pc-upgrade', 'upgrade', 'ترقية الرام أو التخزين أو البطاقة الرسومية أو التبريد.', 10.00, 'نفس اليوم', 'zap', 'https://placehold.co/900x700/png?text=PC+Upgrade', 'active', 3, '{}'::jsonb)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  category = excluded.category,
  description = excluded.description,
  price = excluded.price,
  duration = excluded.duration,
  icon = excluded.icon,
  image = excluded.image,
  status = excluded.status,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.coupons (
  id,
  code,
  description,
  type,
  value,
  min_order,
  max_discount,
  max_uses,
  used_count,
  status,
  expires_at
)
values
  ('cpn-welcome10', 'WELCOME10', 'خصم ترحيبي لأول طلب', 'percentage', 10.00, 30.00, 20.00, 500, 0, 'active', now() + interval '180 days'),
  ('cpn-save5', 'SAVE5', 'خصم ثابت على الطلبات المؤهلة', 'fixed', 5.00, 20.00, null, 1000, 0, 'active', now() + interval '120 days')
on conflict (id) do update
set
  code = excluded.code,
  description = excluded.description,
  type = excluded.type,
  value = excluded.value,
  min_order = excluded.min_order,
  max_discount = excluded.max_discount,
  max_uses = excluded.max_uses,
  status = excluded.status,
  expires_at = excluded.expires_at,
  updated_at = now();

insert into public.reviews (name, role, text, rating, product, status, sort_order)
select *
from (
  values
    ('أحمد عبدالله', 'لاعب محترف', 'اشتريت تجميعة ألعاب وكانت التجربة ممتازة من أول استشارة وحتى التسليم.', 5, 'Gaming Rig X', 'active', 0),
    ('سارة محمد', 'مصممة', 'فريق الصيانة كان واضحًا وسريعًا وتم إصلاح الجهاز خلال وقت قصير.', 5, 'صيانة لابتوب', 'active', 1),
    ('خالد سعيد', 'صاحب عمل', 'الإكسسوارات أصلية والأسعار مناسبة وخدمة التوصيل كانت سلسة.', 4, 'إكسسوارات', 'active', 2)
) as seed(name, role, text, rating, product, status, sort_order)
where not exists (
  select 1 from public.reviews
);

-- ============================================================
-- Grants and realtime
-- ============================================================

grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.is_current_admin() to authenticated;
grant execute on function public.create_service_order_tx(uuid, text, integer, text) to authenticated;
grant execute on function public.admin_adjust_wallet_balance(uuid, uuid, numeric, text) to authenticated;

create or replace function public.enable_realtime_for_table(p_table regclass)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format('alter publication supabase_realtime add table %s', p_table);
exception
  when duplicate_object then null;
  when undefined_object then null;
  when object_not_in_prerequisite_state then null;
end;
$$;

select public.enable_realtime_for_table('public.categories'::regclass);
select public.enable_realtime_for_table('public.products'::regclass);
select public.enable_realtime_for_table('public.services'::regclass);
select public.enable_realtime_for_table('public.orders'::regclass);
select public.enable_realtime_for_table('public.order_items'::regclass);
select public.enable_realtime_for_table('public.repair_services'::regclass);
select public.enable_realtime_for_table('public.service_orders'::regclass);
select public.enable_realtime_for_table('public.repair_bookings'::regclass);
select public.enable_realtime_for_table('public.contact_messages'::regclass);
select public.enable_realtime_for_table('public.support_conversations'::regclass);
select public.enable_realtime_for_table('public.support_chat_messages'::regclass);
select public.enable_realtime_for_table('public.deposits'::regclass);
select public.enable_realtime_for_table('public.coupons'::regclass);
select public.enable_realtime_for_table('public.notifications'::regclass);
select public.enable_realtime_for_table('public.settings'::regclass);
select public.enable_realtime_for_table('public.wallets'::regclass);
select public.enable_realtime_for_table('public.wallet_transactions'::regclass);

-- ============================================================
-- Storage buckets
-- ============================================================

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
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read deposit proofs" on storage.objects;
create policy "Public can read deposit proofs"
on storage.objects for select
using (bucket_id = 'deposits');

drop policy if exists "Authenticated users can upload own deposit proofs" on storage.objects;
create policy "Authenticated users can upload own deposit proofs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can update own deposit proofs" on storage.objects;
create policy "Authenticated users can update own deposit proofs"
on storage.objects for update
to authenticated
using (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can delete own deposit proofs" on storage.objects;
create policy "Authenticated users can delete own deposit proofs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'deposits'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop function if exists public.enable_realtime_for_table(regclass);

commit;
