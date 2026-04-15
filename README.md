# TechZone Web Platform

منصة تجارة وخدمات رقمية تعتمد على Supabase في البيانات والمصادقة، مع واجهة موقع حديثة ولوحة إدارة مستقلة.

## المتطلبات

- JavaScript runtime 20+
- npm 10+

## الإعدادات

1. انسخ ملف البيئة:

```bash
cp .env.example .env.local
```

2. عبّئ القيم الحقيقية داخل `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROVIDER_API_BASE_URL` (اختياري)
- `PROVIDER_API_KEY` (اختياري)
- `PROVIDER_API_TIMEOUT_MS` (اختياري)
- `CRON_SECRET` (مطلوب لمسار المزامنة الآمن)

3. لإعداد لوحة الإدارة القديمة:

- انسخ `admin-config.example.js` إلى `admin-config.js`.
- انسخ `public/admin-config.example.js` إلى `public/admin-config.js`.
- عبّئ:
  - `window.__TZ_SUPABASE_URL`
  - `window.__TZ_SUPABASE_ANON_KEY`

## التشغيل المحلي

```bash
npm install
npm run dev
```

ثم افتح:

```text
http://localhost:3000
```

## الصفحات والمسارات المهمة

- `/` الصفحة الرئيسية
- `/products` صفحة المنتجات
- `/services` صفحة الخدمات
- `/api/health` فحص الحالة
- `/api/orders/create` إنشاء الطلب
- `/api/orders/sync` مزامنة الطلبات

## بنية التطبيق

- `lib/supabaseClient.js`: عميل Supabase للواجهة العامة.
- `lib/supabaseServer.js`: عميل Supabase لطبقة الخادم.
- `lib/serverAuth.js`: التحقق من Bearer token ومساعدات الصلاحيات.
- `app/api/orders/create/route.js`: إنشاء الطلب مع تحقق موحد للمدخلات.
- `app/api/orders/sync/route.js`: مزامنة حالات الطلبات مع مزود خارجي.
- `app/api/account/*`: إدارة الملف الشخصي، كلمة المرور، والمحفظة.
- `app/api/admin/*`: عمليات الإدارة المحمية.

## النظام الهرمي الديناميكي

إدارة الفئات والخدمات ديناميكية بالكامل من لوحة التحكم:

- إضافة وتعديل وحذف الفئات الرئيسية.
- إضافة وتعديل وحذف الفئات الفرعية وربطها بالفئة الرئيسية.
- إضافة وتعديل وحذف الخدمات داخل الفئات الفرعية.
- دعم الصور، الوصف، السعر، الحالة، الترتيب، و`slug` التلقائي.

## ملفات الترحيل

- `hierarchy_migration.sql`
- `account_system_migration.sql`

## الحماية

- Security headers مفعلة في `next.config.mjs`.
- تعطيل `x-powered-by`.
- منع الكاش في endpoint الصحة.

## البناء والتشغيل للإنتاج

```bash
npm run build
npm run start
```

## النشر إلى Cloudflare

```bash
npm run deploy
```
