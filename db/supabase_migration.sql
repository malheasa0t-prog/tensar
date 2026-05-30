\echo 'DO NOT RUN: legacy snapshot. Use db/complete_database_setup.sql plus chronological migrations from db/README.md.'
\q

-- =====================================================
-- منصة الخدمات الرقمية — سكربت إنشاء الجداول الجديدة
-- المرحلة الأولى (النواة)
-- =====================================================

-- ===== 1. جدول المحافظ =====
CREATE TABLE IF NOT EXISTS wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    balance DECIMAL(12,2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
    reserved DECIMAL(12,2) DEFAULT 0.00 NOT NULL CHECK (reserved >= 0),
    total_deposited DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    total_spent DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. جدول حركات المحفظة =====
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'purchase', 'refund', 'admin_adjustment')),
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    description TEXT,
    reference_id TEXT, -- order_id or deposit_id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 3. جدول طلبات الإيداع =====
CREATE TABLE IF NOT EXISTS deposits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    method TEXT DEFAULT 'manual' CHECK (method IN ('manual', 'gateway')),
    proof_url TEXT, -- رابط صورة إثبات التحويل
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 4. جدول طلبات الخدمات (الجديد) =====
CREATE TABLE IF NOT EXISTS service_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    service_id TEXT NOT NULL, -- references services table
    service_name TEXT NOT NULL,
    link TEXT, -- الرابط المستهدف
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(12,2) NOT NULL, -- سعر البيع
    cost_price DECIMAL(12,2) DEFAULT 0, -- سعر التكلفة
    total DECIMAL(12,2) NOT NULL, -- الإجمالي
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded')),
    external_order_id TEXT, -- رقم الطلب عند المزود
    provider_name TEXT,
    start_count INTEGER,
    remains INTEGER,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 5. جدول التقييمات =====
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES service_orders(id) ON DELETE CASCADE NOT NULL,
    service_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id) -- تقييم واحد لكل طلب
);

-- ===== 6. جدول المحادثات =====
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 7. جدول الإشعارات =====
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    reference_type TEXT, -- 'order', 'deposit', 'chat'
    reference_id TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 8. جدول ملفات المستخدمين (بيانات إضافية) =====
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    ban_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- سياسات صلاحيات (RLS)
-- =====================================================

-- تفعيل RLS على كل الجداول
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- === wallets ===
CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage wallets" ON wallets FOR ALL USING (true);

-- === wallet_transactions ===
CREATE POLICY "Users can view own transactions" ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON wallet_transactions FOR INSERT WITH CHECK (true);

-- === deposits ===
CREATE POLICY "Users can view own deposits" ON deposits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create deposits" ON deposits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update deposits" ON deposits FOR UPDATE USING (true);

-- === service_orders ===
CREATE POLICY "Users can view own orders" ON service_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON service_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update orders" ON service_orders FOR UPDATE USING (true);

-- === reviews ===
CREATE POLICY "Anyone can view approved reviews" ON reviews FOR SELECT USING (status = 'approved' OR auth.uid() = user_id);
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- === chat_messages ===
CREATE POLICY "Users can view own chats" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can send messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can manage chats" ON chat_messages FOR UPDATE USING (true);

-- === notifications ===
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- === user_profiles ===
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can manage profiles" ON user_profiles FOR INSERT WITH CHECK (true);

-- === services table (fix existing RLS) ===
DROP POLICY IF EXISTS "Allow public read services" ON services;
CREATE POLICY "Allow public read services" ON services FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert services" ON services;
CREATE POLICY "Allow public insert services" ON services FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update services" ON services;
CREATE POLICY "Allow public update services" ON services FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete services" ON services;
CREATE POLICY "Allow public delete services" ON services FOR DELETE USING (true);

-- =====================================================
-- دالة إنشاء محفظة تلقائياً عند تسجيل مستخدم جديد
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- إنشاء ملف شخصي
    INSERT INTO public.user_profiles (user_id, full_name)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
            'مستخدم-' || RIGHT(REPLACE(NEW.id::TEXT, '-', ''), 6)
        )
    );
    
    -- إنشاء محفظة
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id);
    
    -- إشعار ترحيبي
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (NEW.id, 'مرحباً بك!', 'تم إنشاء حسابك بنجاح. يمكنك الآن شحن محفظتك وطلب الخدمات.', 'success');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ربط الدالة بحدث إنشاء مستخدم جديد
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
