-- =====================================================
-- Hierarchical Categories + Services Migration
-- =====================================================
-- الهدف: إدارة ديناميكية كاملة من لوحة الإدارة
-- 1) فئات رئيسية
-- 2) فئات فرعية
-- 3) خدمات مرتبطة بالفئات الفرعية

-- ===== Categories Enhancements =====
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS slug TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ===== Services Enhancements =====
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS subcategory_id TEXT,
    ADD COLUMN IF NOT EXISTS image TEXT,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS slug TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ابقاء التوافق: category_id موجود مسبقاً ويستخدم كمرجع قديم

-- ===== Optional indexes for performance =====
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_status ON public.categories(status);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

CREATE INDEX IF NOT EXISTS idx_services_subcategory_id ON public.services(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS idx_services_sort_order ON public.services(sort_order);
CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services(slug);

-- ===== Basic constraints =====
ALTER TABLE public.categories
    DROP CONSTRAINT IF EXISTS categories_status_check;
ALTER TABLE public.categories
    ADD CONSTRAINT categories_status_check CHECK (status IN ('active', 'hidden'));

ALTER TABLE public.services
    DROP CONSTRAINT IF EXISTS services_status_check;
ALTER TABLE public.services
    ADD CONSTRAINT services_status_check CHECK (status IN ('active', 'hidden'));

-- ===== Utility slug function (Arabic-safe) =====
CREATE OR REPLACE FUNCTION public.slugify_ar(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    normalized TEXT;
BEGIN
    normalized := lower(coalesce(trim(input_text), ''));
    normalized := regexp_replace(normalized, '\s+', '-', 'g');
    normalized := regexp_replace(normalized, '[^0-9a-zء-يآأؤإئهةى_-]', '', 'g');
    normalized := regexp_replace(normalized, '-+', '-', 'g');
    normalized := regexp_replace(normalized, '(^-|-$)', '', 'g');

    IF normalized = '' THEN
        RETURN NULL;
    END IF;

    RETURN normalized;
END;
$$;

-- ===== Auto fill slug + updated_at for categories =====
CREATE OR REPLACE FUNCTION public.categories_before_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.slugify_ar(NEW.name);
    ELSE
        NEW.slug := public.slugify_ar(NEW.slug);
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_before_upsert ON public.categories;
CREATE TRIGGER trg_categories_before_upsert
BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.categories_before_upsert();

-- ===== Auto fill slug + updated_at for services =====
CREATE OR REPLACE FUNCTION public.services_before_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.slugify_ar(NEW.name);
    ELSE
        NEW.slug := public.slugify_ar(NEW.slug);
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_before_upsert ON public.services;
CREATE TRIGGER trg_services_before_upsert
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.services_before_upsert();

-- ===== Backfill current records =====
UPDATE public.categories
SET slug = public.slugify_ar(name)
WHERE slug IS NULL OR slug = '';

UPDATE public.services
SET slug = public.slugify_ar(name)
WHERE slug IS NULL OR slug = '';

-- =====================================================
-- End of migration
-- =====================================================
