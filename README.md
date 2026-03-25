# TechZone Next.js

تم ترقية الموقع ليعمل على:

- Node.js
- Next.js (App Router)

## المتطلبات

- Node.js 20+
- npm 10+

## الإعدادات (Environment Variables)

1. انسخ ملف البيئة:

```bash
cp .env.example .env.local
```

2. عبّئ القيم الحقيقية داخل `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (لعمليات الخادم الآمنة)
- `PROVIDER_API_BASE_URL` (اختياري)
- `PROVIDER_API_KEY` (اختياري)
- `PROVIDER_API_TIMEOUT_MS` (اختياري)
- `CRON_SECRET` (اختياري لكن موصى به لحماية `/api/orders/sync`)

3. إعداد لوحة الإدارة القديمة (Static Admin):

- انسخ `admin-config.example.js` إلى `admin-config.js`.
- انسخ `public/admin-config.example.js` إلى `public/admin-config.js`.
- عبّئ القيم داخل الملفات:
	- `window.__TZ_SUPABASE_URL`
	- `window.__TZ_SUPABASE_ANON_KEY`

## التشغيل المحلي

1. تثبيت الاعتماديات:

```bash
npm install
```

2. تشغيل بيئة التطوير:

```bash
npm run dev
```

3. افتح المتصفح على:

```text
http://localhost:3000
```

## صفحات المشروع

- `/` الصفحة الرئيسية بتصميم احترافي جديد
- `/products` صفحة المنتجات
- `/services` صفحة الخدمات
- `/api/health` فحص حالة API
- `/api/quote` استقبال نموذج طلب الخدمة (POST)

## بنية الخادم (Node.js داخل Next.js)

- `lib/supabaseClient.js`: عميل Supabase للواجهة/الاستخدام العام عبر متغيرات البيئة.
- `lib/supabaseServer.js`: عميل Supabase للخادم فقط (`server-only`) مع دعم `service role`.
- `lib/serverAuth.js`: استخراج وتحقق Bearer token + Helpers للأدمن/الملف الشخصي.
- `app/api/orders/create/route.js`: إنشاء الطلب مع تحقق مدخلات واستجابات موحدة.
- `app/api/orders/sync/route.js`: مزامنة حالات الطلبات مع مزود خارجي.
- `app/api/health/route.js`: فحص الصحة مع `uptime` و`version` و`timestamp`.
- `app/api/account/profile/route.js`: جلب وتحديث الملف الشخصي للمستخدم الحالي.
- `app/api/account/password/route.js`: تغيير كلمة المرور للمستخدم الحالي.
- `app/api/account/wallet/route.js`: جلب المحفظة وسجل الحركات.
- `app/api/admin/users/route.js`: جلب المستخدمين مع المحافظ (للأدمن فقط).
- `app/api/admin/wallet-adjust/route.js`: إضافة/خصم رصيد ذري عبر RPC (للأدمن فقط).

## النظام الهرمي الديناميكي (فئات ← فئات فرعية ← خدمات)

تم تفعيل إدارة المحتوى بالكامل من لوحة التحكم بحيث لا تبقى الفئات أو الخدمات ثابتة داخل الكود:

- إضافة/تعديل/حذف فئة رئيسية.
- إضافة/تعديل/حذف فئة فرعية وربطها بفئة رئيسية.
- إضافة/تعديل/حذف خدمات داخل الفئة الفرعية.
- دعم: الصورة، الوصف، السعر، الحالة، الترتيب، وslug تلقائي.
- دعم عرض ديناميكي في الواجهة:
	- الرئيسية تعرض الفئات الرئيسية.
	- صفحة الفئة الرئيسية تعرض الفئات الفرعية.
	- صفحة الفئة الفرعية تعرض الخدمات.
	- صفحة تفاصيل خدمة مستقلة.

### تشغيل Migration الخاص بالهيكل الهرمي

نفّذ ملف SQL التالي داخل Supabase SQL Editor:

- `hierarchy_migration.sql`

### تشغيل Migration الخاص بالحسابات والمحفظة

نفّذ ملف SQL التالي داخل Supabase SQL Editor:

- `account_system_migration.sql`

هذا الملف يضيف:

- حقول ملف شخصي إضافية (الدولة/النبذة/اللغة/العملة).
- سياسات RLS أقوى.
- دوال ذرية:
	- `create_service_order_tx` لإنشاء الطلب وخصم الرصيد داخل معاملة واحدة.
	- `admin_adjust_wallet_balance` لتعديل الرصيد من الأدمن بشكل آمن.

### خطة التنفيذ على مراحل

المرحلة 1 (مكتملة):

- APIs الحساب والمحفظة:
	- `GET/PATCH /api/account/profile`
	- `POST /api/account/password`
	- `GET /api/account/wallet`

المرحلة 2 (مكتملة):

- APIs الإدارة:
	- `GET /api/admin/users`
	- `POST /api/admin/wallet-adjust`
- صفحة إدارة المستخدمين: `/dashboard/admin-users`

المرحلة 3 (مكتملة):

- ربط شراء الخدمة بمعاملة ذرية عبر `create_service_order_tx`.
- توحيد المصادقة عبر Bearer token في APIs الحساسة.

المرحلة 4 (مكتملة):

- إزالة المفاتيح الصلبة من صفحات Next.js (auth/dashboard).

المرحلة 5 (مكتملة):

- إزالة المفاتيح الصلبة من `data-engine.js` و`public/data-engine.js`.
- نقل إعداد Supabase إلى `admin-config.js` (غير مرفوع للمستودع).

ثم أعد تشغيل التطبيق:

```bash
npm run dev
```

### ملاحظات API احترافية

- `POST /api/orders/create` يدعم الآن:
	- `Authorization: Bearer <token>` (مفضل)
	- أو `user_token` داخل الـ body للتوافق مع الكود القديم.
	- يستخدم دالة قاعدة البيانات `create_service_order_tx` لضمان خصم الرصيد وإنشاء الطلب بمعاملة واحدة.
- `GET/POST /api/orders/sync`:
	- إذا تم تعريف `CRON_SECRET` يجب إرسال الهيدر `x-cron-secret` بنفس القيمة.

## حماية الإنتاج

- Security headers مفعلة في `next.config.mjs`.
- تعطيل `x-powered-by`.
- منع الكاش في endpoint الصحة.

## البناء للإنتاج

```bash
npm run build
npm run start
```
