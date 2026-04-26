-- =====================================================
-- Account, Profile, Wallet, and Admin Control Migration
-- =====================================================

DO $$
BEGIN
    IF to_regclass('public.user_profiles') IS NULL
       OR to_regclass('public.wallets') IS NULL
       OR to_regclass('public.wallet_transactions') IS NULL
       OR to_regclass('public.service_orders') IS NULL
       OR to_regclass('public.notifications') IS NULL THEN
        RAISE EXCEPTION 'Base tables are missing. Run supabase_migration.sql first, then run account_system_migration.sql';
    END IF;
END $$;

-- ===== 1) user_profiles enhancements =====
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS country TEXT,
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'ar',
    ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'JOD',
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);

UPDATE public.user_profiles
SET full_name = 'مستخدم-' || RIGHT(REPLACE(user_id::TEXT, '-', ''), 6)
WHERE full_name IS NULL OR trim(full_name) = '';

-- ===== 2) keep updated_at fresh =====
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS trg_service_orders_updated_at ON public.service_orders;
CREATE TRIGGER trg_service_orders_updated_at
BEFORE UPDATE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- ===== 3) helper: is admin =====
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.user_profiles
    WHERE user_id = p_user_id;

    RETURN v_role IN ('admin', 'super_admin');
END;
$$;

-- ===== 4) tighten RLS policies =====
DO $$
BEGIN
    -- wallets
    DROP POLICY IF EXISTS "System can manage wallets" ON public.wallets;
    DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;

    CREATE POLICY "wallet_select_own"
    ON public.wallets FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

    -- wallet_transactions
    DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
    DROP POLICY IF EXISTS "System can insert transactions" ON public.wallet_transactions;

    CREATE POLICY "wallet_tx_select_own"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

    -- user_profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "System can manage profiles" ON public.user_profiles;

    CREATE POLICY "profiles_select_own_or_admin"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

    CREATE POLICY "profiles_update_own"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

    -- service_orders
    DROP POLICY IF EXISTS "Users can view own orders" ON public.service_orders;
    DROP POLICY IF EXISTS "Users can create orders" ON public.service_orders;
    DROP POLICY IF EXISTS "System can update orders" ON public.service_orders;

    CREATE POLICY "orders_select_own_or_admin"
    ON public.service_orders FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

    CREATE POLICY "orders_insert_own"
    ON public.service_orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

END $$;

-- ===== 5) atomic admin wallet adjustment =====
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet_balance(
    p_admin_user_id UUID,
    p_target_user_id UUID,
    p_amount NUMERIC,
    p_reason TEXT
)
RETURNS TABLE(
    wallet_id UUID,
    new_balance NUMERIC,
    transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_user_id UUID := auth.uid();
    v_actor_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
    v_effective_admin_id UUID;
    v_wallet public.wallets%ROWTYPE;
    v_tx_id UUID;
BEGIN
    IF p_target_user_id IS NULL THEN
        RAISE EXCEPTION 'Target user is required';
    END IF;

    IF p_amount = 0 THEN
        RAISE EXCEPTION 'Amount cannot be zero';
    END IF;

    IF v_actor_user_id IS NOT NULL AND v_actor_user_id <> p_admin_user_id THEN
        RAISE EXCEPTION 'Actor mismatch';
    END IF;

    IF v_actor_user_id IS NULL AND v_actor_role <> 'service_role' THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_effective_admin_id := COALESCE(v_actor_user_id, p_admin_user_id);
    IF v_effective_admin_id IS NULL OR NOT public.is_admin_user(v_effective_admin_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.wallets(user_id) VALUES (p_target_user_id);
        SELECT * INTO v_wallet
        FROM public.wallets
        WHERE user_id = p_target_user_id
        FOR UPDATE;
    END IF;

    IF v_wallet.balance + p_amount < 0 THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    UPDATE public.wallets
    SET
        balance = balance + p_amount,
        total_deposited = CASE WHEN p_amount > 0 THEN total_deposited + p_amount ELSE total_deposited END,
        total_spent = CASE WHEN p_amount < 0 THEN total_spent + ABS(p_amount) ELSE total_spent END
    WHERE id = v_wallet.id;

    INSERT INTO public.wallet_transactions(
        wallet_id,
        user_id,
        type,
        amount,
        balance_after,
        description,
        reference_id
    )
    VALUES (
        v_wallet.id,
        p_target_user_id,
        'admin_adjustment',
        p_amount,
        v_wallet.balance + p_amount,
        COALESCE(p_reason, 'Admin adjustment'),
        v_effective_admin_id::TEXT
    )
    RETURNING id INTO v_tx_id;

    INSERT INTO public.notifications(user_id, title, body, type, reference_type, reference_id)
    VALUES (
        p_target_user_id,
        'تعديل على الرصيد',
        CASE WHEN p_amount > 0 THEN 'تمت إضافة رصيد بقيمة ' ELSE 'تم خصم رصيد بقيمة ' END || ABS(p_amount)::TEXT || ' د.أ',
        'info',
        'wallet_transaction',
        v_tx_id::TEXT
    );

    RETURN QUERY
    SELECT v_wallet.id, v_wallet.balance + p_amount, v_tx_id;
END;
$$;

-- ===== 6) atomic purchase + order creation =====
CREATE OR REPLACE FUNCTION public.create_service_order_tx(
    p_user_id UUID,
    p_service_id TEXT,
    p_quantity INTEGER,
    p_link TEXT
)
RETURNS TABLE(
    order_id UUID,
    total NUMERIC,
    new_balance NUMERIC,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_user_id UUID := auth.uid();
    v_actor_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
    v_effective_user_id UUID;
    v_service public.services%ROWTYPE;
    v_wallet public.wallets%ROWTYPE;
    v_total NUMERIC;
    v_order_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User is required';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than 0';
    END IF;

    IF v_actor_user_id IS NOT NULL AND v_actor_user_id <> p_user_id THEN
        RAISE EXCEPTION 'Actor mismatch';
    END IF;

    IF v_actor_user_id IS NULL AND v_actor_role <> 'service_role' THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_effective_user_id := COALESCE(v_actor_user_id, p_user_id);

    SELECT * INTO v_service
    FROM public.services
    WHERE id = p_service_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service not found';
    END IF;

    IF COALESCE(v_service.status, 'active') <> 'active' THEN
        RAISE EXCEPTION 'Service is not active';
    END IF;

    IF p_quantity < COALESCE(v_service.min_qty, 1) OR p_quantity > COALESCE(v_service.max_qty, 999999) THEN
        RAISE EXCEPTION 'Quantity out of range';
    END IF;

    v_total := COALESCE(v_service.price, 0) * p_quantity;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_effective_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    IF v_wallet.balance < v_total THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    UPDATE public.wallets
    SET
        balance = balance - v_total,
        total_spent = total_spent + v_total
    WHERE id = v_wallet.id;

    INSERT INTO public.service_orders(
        user_id,
        service_id,
        service_name,
        link,
        quantity,
        price,
        cost_price,
        total,
        status,
        provider_name
    )
    VALUES (
        v_effective_user_id,
        v_service.id,
        v_service.name,
        NULLIF(p_link, ''),
        p_quantity,
        COALESCE(v_service.price, 0),
        COALESCE(v_service.cost_price, 0),
        v_total,
        'pending',
        'default'
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.wallet_transactions(
        wallet_id,
        user_id,
        type,
        amount,
        balance_after,
        description,
        reference_id
    )
    VALUES (
        v_wallet.id,
        v_effective_user_id,
        'purchase',
        -v_total,
        v_wallet.balance - v_total,
        'شراء: ' || v_service.name || ' (×' || p_quantity || ')',
        v_order_id::TEXT
    );

    INSERT INTO public.notifications(user_id, title, body, type, reference_type, reference_id)
    VALUES (
        v_effective_user_id,
        'تم إنشاء طلبك بنجاح',
        'طلب ' || v_service.name || ' بكمية ' || p_quantity || ' — المبلغ: ' || v_total || ' د.أ',
        'success',
        'order',
        v_order_id::TEXT
    );

    RETURN QUERY
    SELECT v_order_id, v_total, v_wallet.balance - v_total, 'تم إنشاء الطلب بنجاح';
END;
$$;

-- ===== 7) grant execute for authenticated users =====
REVOKE EXECUTE ON FUNCTION public.create_service_order_tx(UUID, TEXT, INTEGER, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet_balance(UUID, UUID, NUMERIC, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_order_tx(UUID, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet_balance(UUID, UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;

-- =====================================================
-- End migration
-- =====================================================
