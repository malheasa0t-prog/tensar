\echo 'DO NOT RUN: legacy snapshot. Use db/complete_database_setup.sql plus chronological migrations from db/README.md.'
\q

-- ============================================
-- Migration: Dynamic content support for homepage and service flows
-- ============================================

-- 1. Updates to Categories table
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS show_in_navbar BOOLEAN DEFAULT true;


-- 2. Updates to Products table
ALTER TABLE public.products
ALTER COLUMN category_id DROP NOT NULL,
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical';

UPDATE public.products
SET product_type = 'accessory', category_id = NULL
WHERE category_id = 'cat-accessories-direct-items' OR category_id = 'cat-accessories';


-- 3. Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  text TEXT NOT NULL,
  rating INT DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  product TEXT,
  status TEXT DEFAULT 'active',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
CREATE POLICY "Public read reviews"
ON public.reviews
FOR SELECT
USING (status = 'active');

DROP POLICY IF EXISTS "Admin full reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated manage reviews" ON public.reviews;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admin full reviews"
      ON public.reviews
      FOR ALL
      USING (
        auth.uid() IN (
          SELECT user_id
          FROM public.user_profiles
          WHERE role = 'admin'
        )
      )
      WITH CHECK (
        auth.uid() IN (
          SELECT user_id
          FROM public.user_profiles
          WHERE role = 'admin'
        )
      )
    $policy$;
  ELSE
    EXECUTE $policy$
      CREATE POLICY "Authenticated manage reviews"
      ON public.reviews
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true)
    $policy$;
  END IF;
END $$;


-- 4. Default homepage/service settings payload
INSERT INTO public.settings (id, data)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

UPDATE public.settings
SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
  'hero', jsonb_build_object(
    'trustBadge', 'متجر وصيانة احترافية يخدم أكثر من 12,000 عميل',
    'title', 'عالمك التقني',
    'titleHighlight', 'يبدأ من هنا',
    'description', 'نوفر لك أحدث الأجهزة والخدمات التقنية وتجارب صيانة وتجميع احترافية في مكان واحد.'
  ),
  'trustBar', jsonb_build_array(
    jsonb_build_object('icon', 'truck', 'title', 'توصيل مجاني', 'subtitle', 'للطلبات فوق 50 د.أ'),
    jsonb_build_object('icon', 'headphones', 'title', 'دعم متواصل', 'subtitle', 'فريق مختص لخدمتك')
  ),
  'stats', jsonb_build_array(
    jsonb_build_object('value', 12000, 'suffix', '+', 'label', 'عميل نشط', 'hint', 'أفراد وشركات يثقون بخدماتنا', 'icon', 'user', 'accent', '#22c55e', 'glow', 'rgba(34,197,94,0.24)'),
    jsonb_build_object('value', 34000, 'suffix', '+', 'label', 'طلبات منجزة', 'hint', 'تنفيذ متواصل بدقة وسرعة', 'icon', 'shopping-bag', 'accent', '#38bdf8', 'glow', 'rgba(56,189,248,0.24)'),
    jsonb_build_object('value', 24, 'suffix', 'h', 'label', 'متوسط وقت الصيانة', 'hint', 'تشخيص واضح ومتابعة أسرع', 'icon', 'clock', 'accent', '#f59e0b', 'glow', 'rgba(245,158,11,0.2)'),
    jsonb_build_object('value', 98, 'suffix', '%', 'label', 'رضا العملاء', 'hint', 'تجربة موثوقة بعد كل طلب', 'icon', 'shield-check', 'accent', '#34d399', 'glow', 'rgba(52,211,153,0.22)')
  ),
  'customBuild', jsonb_build_object(
    'badge', '⚙️ تجميع احترافي',
    'title', 'صمم جهاز',
    'titleHighlight', 'أحلامك',
    'description', 'نقدم خدمة تجميع أجهزة حسب الطلب مع أفضل القطع وتركيب احترافي واختبارات كاملة قبل التسليم.',
    'features', jsonb_build_array(
      'استشارة مجانية لاختيار القطع',
      'تركيب احترافي لترتيب الكيابل',
      'تثبيت نظام التشغيل والتعريفات الأساسية',
      'فحص شامل للحرارة والأداء قبل التسليم'
    ),
    'ctaLabel', 'اطلب تجميعة الآن',
    'ctaHref', '/services'
  ),
  'serviceFeatures', jsonb_build_array(
    jsonb_build_object('icon', 'zap', 'title', 'استجابة سريعة', 'subtitle', 'تشخيص أولي سريع للحالة'),
    jsonb_build_object('icon', 'shield-check', 'title', 'قطع أصلية', 'subtitle', 'جودة أعلى واعتمادية أفضل'),
    jsonb_build_object('icon', 'phone', 'title', 'متابعة واضحة', 'subtitle', 'تحديثات مستمرة على حالة الطلب')
  ),
  'paymentMethods', jsonb_build_array(
    jsonb_build_object('value', 'cod', 'label', 'الدفع عند الاستلام'),
    jsonb_build_object('value', 'bank_transfer', 'label', 'تحويل بنكي'),
    jsonb_build_object('value', 'wallet', 'label', 'محفظة')
  ),
  'deliveryMethods', jsonb_build_array(
    jsonb_build_object('value', 'delivery', 'label', 'توصيل'),
    jsonb_build_object('value', 'pickup', 'label', 'استلام من المحل')
  ),
  'serviceTypes', jsonb_build_array(
    jsonb_build_object('value', 'صيانة عاجلة', 'label', 'صيانة عاجلة'),
    jsonb_build_object('value', 'تجميعة مخصصة', 'label', 'تجميعة مخصصة'),
    jsonb_build_object('value', 'ترقية جهاز', 'label', 'ترقية جهاز'),
    jsonb_build_object('value', 'تركيب شبكات', 'label', 'تركيب شبكات'),
    jsonb_build_object('value', 'تنصيب برمجيات', 'label', 'تنصيب برمجيات')
  )
)
WHERE id = 1;


-- 5. Optional seed reviews if table is empty
INSERT INTO public.reviews (name, role, text, rating, product, status, sort_order)
SELECT *
FROM (
  VALUES
    ('أحمد عبدالله', 'جيمنغ احترافي', 'خدمة ممتازة وتجميعة نظيفة جدًا. التجربة كانت سريعة وواضحة من البداية للنهاية.', 5, 'تجميعة مخصصة', 'active', 0),
    ('سارة محمد', 'مصممة', 'تم إصلاح الجهاز بسرعة وكانت المتابعة واضحة طوال فترة الصيانة.', 5, 'صيانة لابتوب', 'active', 1),
    ('خالد سعيد', 'صاحب عمل', 'أسعار مناسبة وتعامل احترافي وتجربة شراء مريحة جدًا.', 4, 'إكسسوارات وتقنيات', 'active', 2)
) AS seed(name, role, text, rating, product, status, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reviews
);
