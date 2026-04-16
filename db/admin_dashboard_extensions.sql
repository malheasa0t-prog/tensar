-- =====================================================
-- Admin Dashboard Extensions
-- Adds refund requests + admin visibility policies
-- =====================================================

DO $$
BEGIN
    IF to_regclass('public.user_profiles') IS NULL
       OR to_regclass('public.wallets') IS NULL
       OR to_regclass('public.deposits') IS NULL
       OR to_regclass('public.notifications') IS NULL THEN
        RAISE EXCEPTION 'Missing prerequisite tables. Run supabase_migration.sql and account_system_migration.sql first.';
    END IF;
END $$;

-- ===== Allow admins to view deposit requests =====
DROP POLICY IF EXISTS "Users can view own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users or admins can view deposits" ON public.deposits;
CREATE POLICY "Users or admins can view deposits"
ON public.deposits FOR SELECT
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

-- ===== Allow admins to view notifications =====
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users or admins can view notifications" ON public.notifications;
CREATE POLICY "Users or admins can view notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

-- ===== Refund requests =====
CREATE TABLE IF NOT EXISTS public.refund_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    order_type TEXT NOT NULL CHECK (order_type IN ('product', 'digital')),
    order_id TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON public.refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_order_id ON public.refund_requests(order_id);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users or admins can view refund requests" ON public.refund_requests;
CREATE POLICY "Users or admins can view refund requests"
ON public.refund_requests FOR SELECT
USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Users can create own refund requests" ON public.refund_requests;
CREATE POLICY "Users can create own refund requests"
ON public.refund_requests FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update refund requests" ON public.refund_requests;
CREATE POLICY "Admins can update refund requests"
ON public.refund_requests FOR UPDATE
USING (public.is_admin_user(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.refund_requests;

-- =====================================================
-- End
-- =====================================================
