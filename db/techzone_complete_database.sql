-- ============================================================
-- TechZone - Complete Database Setup for Supabase SQL Editor
-- Execute this ENTIRE file in Supabase SQL Editor (one shot)
-- Generated: 2026-04-08
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. Helper Functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_prefixed_id(p_prefix text)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT coalesce(p_prefix, '') || replace(gen_random_uuid()::text, '-', '');
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_role(p_role text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p_role, '')) IN ('super_admin', 'admin', 'technician', 'employee');
$$;

-- ============================================================
-- 3. Core Tables
-- ============================================================

-- Settings (singleton)
CREATE TABLE IF NOT EXISTS public.settings (
  id bigint PRIMARY KEY DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton_id_check CHECK (id = 1),
  CONSTRAINT settings_data_is_object CHECK (jsonb_typeof(data) = 'object')
);

-- App Users (legacy bridge)
CREATE TABLE IF NOT EXISTS public.app_users (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('app-'),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer','user','admin','super_admin','technician','employee')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','banned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer','user','admin','super_admin','technician','employee')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','banned')),
  ban_reason text,
  country text,
  bio text,
  preferred_language text NOT NULL DEFAULT 'ar',
  preferred_currency text NOT NULL DEFAULT 'JOD',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  reserved numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (reserved >= 0),
  total_deposited numeric(12,2) NOT NULL DEFAULT 0.00,
  total_spent numeric(12,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','purchase','refund','admin_adjustment')),
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  balance_after numeric(12,2) NOT NULL,
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('cat-'),
  parent_id text REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text,
  icon text,
  image text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','hidden','draft','archived')),
  show_in_navbar boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('prd-'),
  category_id text REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text,
  brand text,
  sku text,
  product_type text NOT NULL DEFAULT 'physical'
    CHECK (product_type IN ('physical','accessory','service','subscription','digital')),
  price numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  discount_price numeric(12,2) CHECK (discount_price IS NULL OR (discount_price >= 0 AND discount_price <= price)),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  rating numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  sold integer NOT NULL DEFAULT 0 CHECK (sold >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','draft','out_of_stock','archived')),
  description text,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  low_stock_alert integer NOT NULL DEFAULT 5 CHECK (low_stock_alert >= 0),
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Digital Services
CREATE TABLE IF NOT EXISTS public.services (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('srv-'),
  category_id text REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id text REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text,
  provider_service_id text,
  price numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  cost_price numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
  min_qty integer NOT NULL DEFAULT 1 CHECK (min_qty > 0),
  max_qty integer NOT NULL DEFAULT 1000 CHECK (max_qty >= min_qty),
  description text,
  speed text,
  guarantee text,
  image text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','draft','paused','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Orders
CREATE SEQUENCE IF NOT EXISTS public.order_display_number_seq
  AS bigint
  START WITH 2000
  INCREMENT BY 1
  MINVALUE 2000;

CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('ord-'),
  display_number bigint NOT NULL DEFAULT nextval('public.order_display_number_seq'),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_delivery','confirmed','processing','shipped','delivered','completed','cancelled','failed','refunded')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded')),
  payment_method text NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('cash','card','wallet','bank_transfer','cod')),
  delivery_method text NOT NULL DEFAULT 'delivery'
    CHECK (delivery_method IN ('delivery','pickup')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  shipping_fee numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (shipping_fee >= 0),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
  coupon_code text,
  notes text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  line_total numeric(12,2) GENERATED ALWAYS AS ((qty::numeric) * price) STORED,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Repair Services
CREATE TABLE IF NOT EXISTS public.repair_services (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('rep-'),
  name text NOT NULL, slug text, category text, description text,
  price numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  duration text, icon text, image text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Repair Bookings
CREATE TABLE IF NOT EXISTS public.repair_bookings (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('bk-'),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id text REFERENCES public.repair_services(id) ON DELETE SET NULL,
  service_name text, name text NOT NULL, email text, phone text,
  device text NOT NULL, description text NOT NULL,
  preferred_date timestamptz,
  mode text NOT NULL DEFAULT 'delivery' CHECK (mode IN ('delivery','pickup','onsite')),
  address text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','received','diagnosing','waiting_approval','in_progress','ready','completed','cancelled','rejected','confirmed')),
  admin_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Contact Messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('msg-'),
  name text NOT NULL, email text, phone text, service_type text, subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','replied','closed','archived')),
  source text NOT NULL DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Support Conversations
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT 'محادثة مباشرة',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  customer_name text NOT NULL, customer_email text, customer_phone text,
  last_message_preview text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_sender_role text NOT NULL DEFAULT 'customer' CHECK (last_message_sender_role IN ('customer','admin')),
  assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Support Chat Messages
CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','admin')),
  sender_name text NOT NULL, body text NOT NULL,
  is_read_by_customer boolean NOT NULL DEFAULT false,
  is_read_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Service Orders
CREATE TABLE IF NOT EXISTS public.service_orders (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('so-'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id text REFERENCES public.services(id) ON DELETE SET NULL,
  service_name text NOT NULL, link text,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  cost_price numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','in_progress','completed','partial','failed','cancelled','refunded')),
  external_order_id text, provider_name text DEFAULT 'default',
  start_count integer, remains integer, admin_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id text REFERENCES public.service_orders(id) ON DELETE SET NULL,
  name text NOT NULL, role text, text text NOT NULL,
  rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  product text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','rejected','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('cpn-'),
  code text NOT NULL, description text,
  type text NOT NULL CHECK (type IN ('percentage','fixed')),
  value numeric(12,2) NOT NULL CHECK (value > 0),
  min_order numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (min_order >= 0),
  max_discount numeric(12,2), max_uses integer,
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deposits
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'manual' CHECK (method IN ('manual','gateway','bank_transfer','cash')),
  proof_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text, reviewed_by text, reviewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, body text,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  reference_type text, reference_id text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY DEFAULT public.generate_prefixed_id('log-'),
  action text NOT NULL, actor_id text, actor_email text,
  target_table text, target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_unique ON public.app_users ((lower(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_users_role ON public.app_users(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_status ON public.categories(status, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON public.categories ((lower(slug))) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_status ON public.products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON public.products(product_type, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique ON public.products ((lower(slug))) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_category_status ON public.services(category_id, status, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_slug_unique ON public.services ((lower(slug))) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_display_number ON public.orders(display_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id, id);
CREATE INDEX IF NOT EXISTS idx_repair_bookings_status ON public.repair_bookings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON public.support_conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_user_id ON public.service_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON public.service_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status, sort_order, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_unique ON public.coupons ((lower(code)));
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);

-- ============================================================
-- 5. Updated_at Triggers
-- ============================================================
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
  CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_app_users_updated_at ON public.app_users;
  CREATE TRIGGER trg_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
  CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
  CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
  CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
  CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
  CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
  CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_repair_services_updated_at ON public.repair_services;
  CREATE TRIGGER trg_repair_services_updated_at BEFORE UPDATE ON public.repair_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_repair_bookings_updated_at ON public.repair_bookings;
  CREATE TRIGGER trg_repair_bookings_updated_at BEFORE UPDATE ON public.repair_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_contact_messages_updated_at ON public.contact_messages;
  CREATE TRIGGER trg_contact_messages_updated_at BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_support_conversations_updated_at ON public.support_conversations;
  CREATE TRIGGER trg_support_conversations_updated_at BEFORE UPDATE ON public.support_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_service_orders_updated_at ON public.service_orders;
  CREATE TRIGGER trg_service_orders_updated_at BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
  CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
  CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
  DROP TRIGGER IF EXISTS trg_deposits_updated_at ON public.deposits;
  CREATE TRIGGER trg_deposits_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();
END $$;

-- ============================================================
-- 6. Auth & Admin Helper Functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, auth AS $$
DECLARE v_role text; v_email text;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = p_user_id AND coalesce(status,'active')='active' LIMIT 1;
  IF public.is_admin_role(v_role) THEN RETURN true; END IF;
  SELECT lower(coalesce(email,'')) INTO v_email FROM auth.users WHERE id = p_user_id LIMIT 1;
  IF v_email <> '' THEN
    SELECT role INTO v_role FROM public.app_users WHERE lower(coalesce(email,''))=v_email AND coalesce(status,'active')='active' LIMIT 1;
    IF public.is_admin_role(v_role) THEN RETURN true; END IF;
  END IF;
  SELECT role INTO v_role FROM public.app_users WHERE auth_user_id=p_user_id AND coalesce(status,'active')='active' LIMIT 1;
  RETURN public.is_admin_role(v_role);
END; $$;

CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth AS $$
  SELECT public.is_admin_user(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_view_order_item(p_order_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id=p_order_id AND (o.user_id=auth.uid() OR public.is_admin_user(auth.uid())));
$$;

-- ============================================================
-- 7. Auto-create profile + wallet on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE v_full_name text; v_role text; v_email text;
BEGIN
  v_email := lower(coalesce(NEW.email,''));
  v_full_name := coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'),''),nullif(trim(NEW.raw_user_meta_data->>'name'),''),nullif(split_part(v_email,'@',1),''),'User-'||right(replace(NEW.id::text,'-',''),6));
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE public.is_admin_role(role)) THEN v_role:='customer'; ELSE v_role:='super_admin'; END IF;
  INSERT INTO public.user_profiles (user_id,full_name,phone,role,status,preferred_language,preferred_currency) VALUES (NEW.id,v_full_name,nullif(trim(NEW.phone),''),v_role,'active','ar','JOD') ON CONFLICT (user_id) DO UPDATE SET full_name=coalesce(nullif(excluded.full_name,''),public.user_profiles.full_name),updated_at=now();
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.notifications (user_id,title,body,type,reference_type) VALUES (NEW.id,'مرحباً بك في TechZone',CASE WHEN v_role='super_admin' THEN 'تم إنشاء حسابك كمدير أول.' ELSE 'تم إنشاء حسابك بنجاح.' END,'success','welcome');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 8. Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read policies
DROP POLICY IF EXISTS settings_read_public ON public.settings;
CREATE POLICY settings_read_public ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS settings_admin_all ON public.settings;
CREATE POLICY settings_admin_all ON public.settings FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

DROP POLICY IF EXISTS categories_public_read_active ON public.categories;
CREATE POLICY categories_public_read_active ON public.categories FOR SELECT USING (status='active' OR public.is_current_admin());
DROP POLICY IF EXISTS categories_admin_manage ON public.categories;
CREATE POLICY categories_admin_manage ON public.categories FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

DROP POLICY IF EXISTS products_public_read_active ON public.products;
CREATE POLICY products_public_read_active ON public.products FOR SELECT USING (status='active' OR public.is_current_admin());
DROP POLICY IF EXISTS products_admin_manage ON public.products;
CREATE POLICY products_admin_manage ON public.products FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

DROP POLICY IF EXISTS services_public_read_active ON public.services;
CREATE POLICY services_public_read_active ON public.services FOR SELECT USING (status='active' OR public.is_current_admin());
DROP POLICY IF EXISTS services_admin_manage ON public.services;
CREATE POLICY services_admin_manage ON public.services FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

DROP POLICY IF EXISTS repair_services_public_read_active ON public.repair_services;
CREATE POLICY repair_services_public_read_active ON public.repair_services FOR SELECT USING (status='active' OR public.is_current_admin());
DROP POLICY IF EXISTS repair_services_admin_manage ON public.repair_services;
CREATE POLICY repair_services_admin_manage ON public.repair_services FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

DROP POLICY IF EXISTS reviews_public_read_active ON public.reviews;
CREATE POLICY reviews_public_read_active ON public.reviews FOR SELECT USING (status='active' OR public.is_current_admin());

DROP POLICY IF EXISTS coupons_public_read_active ON public.coupons;
CREATE POLICY coupons_public_read_active ON public.coupons FOR SELECT USING ((status='active' AND (expires_at IS NULL OR expires_at > now())) OR public.is_current_admin());
DROP POLICY IF EXISTS coupons_admin_manage ON public.coupons;
CREATE POLICY coupons_admin_manage ON public.coupons FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

-- User-scoped policies
DROP POLICY IF EXISTS user_profiles_select_own_or_admin ON public.user_profiles;
CREATE POLICY user_profiles_select_own_or_admin ON public.user_profiles FOR SELECT USING (auth.uid()=user_id OR public.is_current_admin());
DROP POLICY IF EXISTS user_profiles_update_own_or_admin ON public.user_profiles;
CREATE POLICY user_profiles_update_own_or_admin ON public.user_profiles FOR UPDATE USING (auth.uid()=user_id OR public.is_current_admin());

DROP POLICY IF EXISTS wallets_select_own_or_admin ON public.wallets;
CREATE POLICY wallets_select_own_or_admin ON public.wallets FOR SELECT USING (auth.uid()=user_id OR public.is_current_admin());
DROP POLICY IF EXISTS wallets_admin_manage ON public.wallets;
CREATE POLICY wallets_admin_manage ON public.wallets FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

DROP POLICY IF EXISTS wallet_transactions_select_own_or_admin ON public.wallet_transactions;
CREATE POLICY wallet_transactions_select_own_or_admin ON public.wallet_transactions FOR SELECT USING (auth.uid()=user_id OR public.is_current_admin());

DROP POLICY IF EXISTS orders_select_own_or_admin ON public.orders;
CREATE POLICY orders_select_own_or_admin ON public.orders FOR SELECT USING (auth.uid()=user_id OR public.is_current_admin());
DROP POLICY IF EXISTS orders_insert_own_or_admin ON public.orders;
CREATE POLICY orders_insert_own_or_admin ON public.orders FOR INSERT WITH CHECK (public.is_current_admin() OR (auth.uid() IS NOT NULL AND auth.uid()=user_id));
DROP POLICY IF EXISTS orders_update_admin ON public.orders;
CREATE POLICY orders_update_admin ON public.orders FOR UPDATE USING (public.is_current_admin());

DROP POLICY IF EXISTS service_orders_select_own_or_admin ON public.service_orders;
CREATE POLICY service_orders_select_own_or_admin ON public.service_orders FOR SELECT USING (auth.uid()=user_id OR public.is_current_admin());

DROP POLICY IF EXISTS deposits_select_own_or_admin ON public.deposits;
CREATE POLICY deposits_select_own_or_admin ON public.deposits FOR SELECT USING (auth.uid()=user_id OR public.is_current_admin());
DROP POLICY IF EXISTS deposits_insert_own ON public.deposits;
CREATE POLICY deposits_insert_own ON public.deposits FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id AND coalesce(status,'pending')='pending');

DROP POLICY IF EXISTS notifications_select_own_or_admin ON public.notifications;
CREATE POLICY notifications_select_own_or_admin ON public.notifications FOR SELECT USING (auth.uid()=user_id OR public.is_current_admin());
DROP POLICY IF EXISTS notifications_update_own_or_admin ON public.notifications;
CREATE POLICY notifications_update_own_or_admin ON public.notifications FOR UPDATE USING (auth.uid()=user_id OR public.is_current_admin());

-- Admin-only policies
DROP POLICY IF EXISTS app_users_admin_read ON public.app_users;
CREATE POLICY app_users_admin_read ON public.app_users FOR SELECT USING (public.is_current_admin());
DROP POLICY IF EXISTS app_users_admin_manage ON public.app_users;
CREATE POLICY app_users_admin_manage ON public.app_users FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT USING (public.is_current_admin());
DROP POLICY IF EXISTS audit_logs_admin_manage ON public.audit_logs;
CREATE POLICY audit_logs_admin_manage ON public.audit_logs FOR ALL USING (public.is_current_admin()) WITH CHECK (public.is_current_admin());

-- Public insert (contact & repair booking)
DROP POLICY IF EXISTS contact_messages_insert_public ON public.contact_messages;
CREATE POLICY contact_messages_insert_public ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (public.is_current_admin() OR coalesce(status,'new')='new');
DROP POLICY IF EXISTS contact_messages_admin_read ON public.contact_messages;
CREATE POLICY contact_messages_admin_read ON public.contact_messages FOR SELECT USING (public.is_current_admin());

DROP POLICY IF EXISTS repair_bookings_insert_public ON public.repair_bookings;
CREATE POLICY repair_bookings_insert_public ON public.repair_bookings FOR INSERT TO anon, authenticated WITH CHECK ((public.is_current_admin() OR coalesce(status,'pending')='pending') AND (user_id IS NULL OR user_id=auth.uid() OR public.is_current_admin()));
DROP POLICY IF EXISTS repair_bookings_update_admin ON public.repair_bookings;
CREATE POLICY repair_bookings_update_admin ON public.repair_bookings FOR UPDATE USING (public.is_current_admin());

-- ============================================================
-- 9. Grants
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_admin() TO authenticated;
GRANT SELECT ON public.settings TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.repair_services TO anon;
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT ON public.coupons TO anon;
GRANT INSERT ON public.contact_messages TO anon;
GRANT INSERT ON public.repair_bookings TO anon;

-- ============================================================
-- 10. Realtime (replica identity + publication)
-- ============================================================
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER TABLE public.wallets REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.services REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.repair_services REPLICA IDENTITY FULL;
ALTER TABLE public.repair_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.contact_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.support_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.service_orders REPLICA IDENTITY FULL;
ALTER TABLE public.coupons REPLICA IDENTITY FULL;
ALTER TABLE public.deposits REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.enable_realtime_for_table(p_table regclass)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', p_table);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; WHEN object_not_in_prerequisite_state THEN NULL;
END; $$;

SELECT public.enable_realtime_for_table('public.categories'::regclass);
SELECT public.enable_realtime_for_table('public.products'::regclass);
SELECT public.enable_realtime_for_table('public.services'::regclass);
SELECT public.enable_realtime_for_table('public.orders'::regclass);
SELECT public.enable_realtime_for_table('public.order_items'::regclass);
SELECT public.enable_realtime_for_table('public.repair_services'::regclass);
SELECT public.enable_realtime_for_table('public.service_orders'::regclass);
SELECT public.enable_realtime_for_table('public.repair_bookings'::regclass);
SELECT public.enable_realtime_for_table('public.contact_messages'::regclass);
SELECT public.enable_realtime_for_table('public.support_conversations'::regclass);
SELECT public.enable_realtime_for_table('public.support_chat_messages'::regclass);
SELECT public.enable_realtime_for_table('public.deposits'::regclass);
SELECT public.enable_realtime_for_table('public.coupons'::regclass);
SELECT public.enable_realtime_for_table('public.notifications'::regclass);
SELECT public.enable_realtime_for_table('public.settings'::regclass);
SELECT public.enable_realtime_for_table('public.wallets'::regclass);
SELECT public.enable_realtime_for_table('public.wallet_transactions'::regclass);

DROP FUNCTION IF EXISTS public.enable_realtime_for_table(regclass);

-- ============================================================
-- 11. Seed Data
-- ============================================================

-- Settings
INSERT INTO public.settings (id, data) VALUES (1, '{"company":{"name":"TechZone","slogan":"متجرك الذكي للأجهزة التقنية وخدمات الصيانة الاحترافية.","phone":"+962790000000","email":"info@techzone.local","address":"عمّان - الأردن"},"social":{"whatsapp":"https://wa.me/962790000000","instagram":"https://instagram.com/techzone.jo","facebook":"https://facebook.com/techzone.jo","youtube":"https://youtube.com/@techzonejo","telegram":"https://t.me/techzonejo"},"hero":{"trustBadge":"متجر وصيانة احترافية في الأردن تخدم آلاف العملاء","title":"عالمك التقني","titleHighlight":"يبدأ من هنا","description":"نوفر لك أجهزة كمبيوتر، لابتوبات، إكسسوارات، وخدمات صيانة وتجميع احترافية ضمن تجربة شراء واضحة وسريعة."},"trustBar":[{"icon":"truck","title":"توصيل سريع","subtitle":"داخل عمّان وخارجها"},{"icon":"shield-check","title":"ضمان موثوق","subtitle":"على المنتجات والخدمات المؤهلة"},{"icon":"headphones","title":"دعم متواصل","subtitle":"فريق جاهز للإجابة والمتابعة"}],"stats":[{"value":12000,"suffix":"+","label":"عميل نشط"},{"value":34000,"suffix":"+","label":"طلبات منجزة"},{"value":24,"suffix":"h","label":"متوسط الصيانة"},{"value":98,"suffix":"%","label":"رضا العملاء"}],"navigation":{"headerBefore":[{"href":"/","label":"الرئيسية"},{"href":"/products","label":"المنتجات"},{"href":"/accessories","label":"الإكسسوارات"}],"headerAfter":[{"href":"/services","label":"خدمات الصيانة"},{"href":"/contact","label":"تواصل معنا"}]}}'::jsonb)
ON CONFLICT (id) DO UPDATE SET data = CASE WHEN coalesce(public.settings.data,'{}'::jsonb)='{}'::jsonb THEN excluded.data ELSE public.settings.data END, updated_at = now();

-- Categories
INSERT INTO public.categories (id,parent_id,name,slug,icon,image,description,sort_order,status,show_in_navbar) VALUES
  ('cat-computers',NULL,'أجهزة الكمبيوتر','computers','monitor','https://placehold.co/640x480/png?text=Computers','الفئة الرئيسية للأجهزة.',1,'active',true),
  ('cat-accessories-direct-items',NULL,'إكسسوارات','accessories','mouse','https://placehold.co/640x480/png?text=Accessories','إكسسوارات وملحقات تقنية.',2,'active',true),
  ('cat-digital',NULL,'الخدمات الرقمية','digital-services','sparkles','https://placehold.co/640x480/png?text=Digital','خدمات رقمية واشتراكات.',3,'active',true),
  ('cat-repairs',NULL,'الصيانة','repairs','wrench','https://placehold.co/640x480/png?text=Repairs','خدمات صيانة الأجهزة.',4,'active',false),
  ('cat-laptops','cat-computers','لابتوبات','laptops','laptop','https://placehold.co/640x480/png?text=Laptops','أجهزة لابتوب.',10,'active',true),
  ('cat-components','cat-computers','قطع الكمبيوتر','components','cpu','https://placehold.co/640x480/png?text=Components','بطاقات شاشة ومعالجات.',11,'active',true),
  ('cat-gaming','cat-computers','أجهزة ألعاب','gaming-pcs','gamepad-2','https://placehold.co/640x480/png?text=Gaming','أجهزة ألعاب.',12,'active',true)
ON CONFLICT (id) DO UPDATE SET name=excluded.name,slug=excluded.slug,icon=excluded.icon,image=excluded.image,description=excluded.description,sort_order=excluded.sort_order,status=excluded.status,show_in_navbar=excluded.show_in_navbar,updated_at=now();

-- Products
INSERT INTO public.products (id,category_id,name,slug,brand,sku,product_type,price,discount_price,quantity,rating,sold,status,description,specs,images,is_featured) VALUES
  ('prd-laptop-pro-14','cat-laptops','Laptop Pro 14','laptop-pro-14','Lenovo','TZ-LTP-14','physical',899.00,849.00,8,4.8,124,'active','لابتوب عملي بشاشة 14 إنش','{"cpu":"Intel Core i7","ram":"16GB","storage":"512GB SSD"}'::jsonb,'["https://placehold.co/900x700/png?text=Laptop+Pro+14"]'::jsonb,true),
  ('prd-gaming-rig-x','cat-gaming','Gaming Rig X','gaming-rig-x','TechZone','TZ-GMR-X','physical',1499.00,1399.00,4,4.9,68,'active','تجميعة ألعاب جاهزة بأداء قوي','{"cpu":"Ryzen 7","gpu":"RTX 4070","ram":"32GB"}'::jsonb,'["https://placehold.co/900x700/png?text=Gaming+Rig+X"]'::jsonb,true),
  ('prd-rtx4070ti-super','cat-components','RTX 4070 Ti Super','rtx-4070-ti-super','NVIDIA','TZ-GPU-4070TI','physical',999.00,NULL,6,4.7,32,'active','بطاقة رسومية قوية','{"memory":"16GB GDDR6X","rayTracing":true}'::jsonb,'["https://placehold.co/900x700/png?text=RTX+4070+Ti"]'::jsonb,false),
  ('prd-rgb-mouse',NULL,'ماوس ألعاب RGB لاسلكي','rgb-wireless-mouse','Redragon','TZ-ACC-MSE01','accessory',29.00,24.00,12,4.6,210,'active','ماوس لاسلكي مخصص للألعاب','{"dpi":"16000","buttons":7}'::jsonb,'["https://placehold.co/900x700/png?text=RGB+Mouse"]'::jsonb,true),
  ('prd-mech-keyboard',NULL,'لوحة مفاتيح ميكانيكية','mechanical-keyboard','Logitech','TZ-ACC-KB01','accessory',79.00,69.00,9,4.7,155,'active','كيبورد ميكانيكي بإضاءة خلفية','{"switches":"Blue","layout":"Arabic/English"}'::jsonb,'["https://placehold.co/900x700/png?text=Keyboard"]'::jsonb,false)
ON CONFLICT (id) DO UPDATE SET category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,brand=excluded.brand,price=excluded.price,discount_price=excluded.discount_price,quantity=excluded.quantity,rating=excluded.rating,sold=excluded.sold,status=excluded.status,description=excluded.description,specs=excluded.specs,images=excluded.images,is_featured=excluded.is_featured,updated_at=now();

-- Services
INSERT INTO public.services (id,category_id,name,slug,provider_service_id,price,cost_price,min_qty,max_qty,description,speed,guarantee,image,status,sort_order) VALUES
  ('srv-social-boost','cat-digital','زيادة متابعين إنستغرام','instagram-boost','IG-BOOST-001',4.50,3.20,100,10000,'خدمة رقمية لزيادة التفاعل.','1-24 ساعة','ضمان استبدال جزئي','https://placehold.co/900x700/png?text=IG+Boost','active',1),
  ('srv-gift-card','cat-digital','بطاقة شحن ألعاب','gaming-gift-card','GIFT-100',10.00,8.50,1,50,'بطاقات شحن رقمية.','فوري','مضمون','https://placehold.co/900x700/png?text=Gift+Card','active',2),
  ('srv-subscription-pro','cat-digital','اشتراك خدمة برو','pro-subscription','SUB-PRO-01',15.00,11.00,1,12,'اشتراك رقمي متجدد.','خلال دقائق','مضمون','https://placehold.co/900x700/png?text=Pro+Sub','active',3)
ON CONFLICT (id) DO UPDATE SET name=excluded.name,price=excluded.price,cost_price=excluded.cost_price,status=excluded.status,updated_at=now();

-- Repair Services
INSERT INTO public.repair_services (id,name,slug,category,description,price,duration,icon,image,status,sort_order) VALUES
  ('rsv-laptop-repair','صيانة لابتوب','laptop-repair','hardware','فحص وصيانة مشاكل اللابتوبات.',15.00,'1-3 أيام','laptop','https://placehold.co/900x700/png?text=Laptop+Repair','active',1),
  ('rsv-custom-build','تجميع جهاز حسب الطلب','custom-pc-build','build','خدمة اختيار القطع وتجميع الجهاز.',25.00,'1-2 أيام','cpu','https://placehold.co/900x700/png?text=Custom+Build','active',2),
  ('rsv-upgrade-service','ترقية جهاز','pc-upgrade','upgrade','ترقية الرام أو التخزين.',10.00,'نفس اليوم','zap','https://placehold.co/900x700/png?text=Upgrade','active',3)
ON CONFLICT (id) DO UPDATE SET name=excluded.name,price=excluded.price,status=excluded.status,updated_at=now();

-- Coupons
INSERT INTO public.coupons (id,code,description,type,value,min_order,max_discount,max_uses,status,expires_at) VALUES
  ('cpn-welcome10','WELCOME10','خصم ترحيبي لأول طلب','percentage',10.00,30.00,20.00,500,'active',now()+interval '180 days'),
  ('cpn-save5','SAVE5','خصم ثابت على الطلبات','fixed',5.00,20.00,NULL,1000,'active',now()+interval '120 days')
ON CONFLICT (id) DO UPDATE SET code=excluded.code,status=excluded.status,expires_at=excluded.expires_at,updated_at=now();

-- Reviews
INSERT INTO public.reviews (name,role,text,rating,product,status,sort_order)
SELECT * FROM (VALUES
  ('أحمد عبدالله','لاعب محترف','اشتريت تجميعة ألعاب وكانت التجربة ممتازة.',5,'Gaming Rig X','active',0),
  ('سارة محمد','مصممة','فريق الصيانة كان واضحًا وسريعًا.',5,'صيانة لابتوب','active',1),
  ('خالد سعيد','صاحب عمل','الإكسسوارات أصلية والأسعار مناسبة.',4,'إكسسوارات','active',2)
) AS seed(name,role,text,rating,product,status,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.reviews);

-- ============================================================
-- 12. Storage Bucket for Deposit Proofs
-- ============================================================
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('deposits','deposits',false,5242880,ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read deposit proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read own deposit proofs" ON storage.objects;
CREATE POLICY "Authenticated users can read own deposit proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id='deposits'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_current_admin()
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload own deposit proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload own deposit proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='deposits' AND (storage.foldername(name))[1]=auth.uid()::text);

COMMIT;
-- ============================================================
-- DONE! Your TechZone database is fully configured.
-- ============================================================
