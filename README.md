# TechZone Web Platform

منصة تجارة إلكترونية وخدمات تقنية عربية مبنية كواجهة `Vite + React` أحادية الصفحة، مع نشر على `Cloudflare Pages` ووظائف خادمية داخل `functions/`.

## المتطلبات

- Node.js 20+
- npm 10+

## إعداد البيئة

1. انسخ ملف التطوير المحلي:

```bash
cp .env.example .env.local
```

2. استخدم `.env.production.example` كمرجع placeholder فقط لقيم البناء العامة.
القيم الحقيقية يجب أن تبقى داخل GitHub Secrets وCloudflare Pages Variables/Secrets فقط.

3. عبّئ القيم المطلوبة داخل `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `PROVIDER_API_BASE_URL`
- `PROVIDER_API_KEY`
- `PROVIDER_API_TIMEOUT_MS`
- `CRON_SECRET`

4. لوحة الإدارة القديمة أصبحت تولّد ملف `admin-config.js` تلقائيًا أثناء `vite build`
   وأثناء تشغيل `vite dev` من القيم العامة التالية:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` أو `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `ENABLE_LEGACY_ADMIN_WRITE` اختياري لتفعيل عمليات الكتابة

## التشغيل المحلي

```bash
npm install
npm run dev
```

ثم افتح:

```text
http://localhost:5173
```

## البنية الحالية

- `src/`: نقطة دخول Vite وReact Router.
- `app/`: صفحات الواجهة بأسلوب قريب من هيكلة Next.js ولكنها تعمل داخل SPA.
- `components/`: المكوّنات المشتركة.
- `functions/`: Cloudflare Pages Functions لمسارات API.
- `lib/`: أدوات Supabase والمنطق المساعد القابل لإعادة الاستخدام.
- `public/`: ملفات ثابتة مثل `admin.html` و`_headers` و`_redirects`.
- `.github/workflows/deploy.yml`: بناء ونشر تلقائي إلى Cloudflare Pages.

## المسارات المهمة

- `/` الصفحة الرئيسية
- `/products` صفحة المنتجات
- `/services` صفحة الخدمات
- `/dashboard` لوحة المستخدم
- `/api/health` فحص الحالة
- `/api/chat` وكيل الدردشة
- `/api/checkout` إنشاء طلب منتج
- `/api/orders/create` إنشاء طلب مباشر
- `/api/deposits/proof` رفع إثبات التحويل
- `/api/account/profile` تحديث الملف الشخصي
- `/api/account/password` تحديث كلمة المرور
- `/api/img` وسيط الصور

## البناء والنشر

للبناء المحلي:

```bash
npm run build
```

لمعاينة Cloudflare Pages محليًا:

```bash
npm run preview:cloudflare
```

للنشر اليدوي:

```bash
npm run deploy:cloudflare
```

### النشر عبر GitHub Actions

الـ workflow المستخدم هو:

```text
.github/workflows/deploy.yml
```

ويحتاج في GitHub إلى:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

كما يجب ضبط القيم التشغيلية في Cloudflare Pages:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` أو `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `PROVIDER_API_BASE_URL`
- `PROVIDER_API_KEY`
- `PROVIDER_API_TIMEOUT_MS`
- `ENABLE_LEGACY_ADMIN_WRITE`
- `CRON_SECRET`

## ملاحظات أمنية

- `vite build` سيفشل الآن إذا لم تكن `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY` موجودتين.
- لا تحفظ أي قيم حقيقية داخل ملفات `.env.production` أو أي ملف متتبع في Git.
- سياسة الكاش للملفات الثابتة موجودة في `public/_headers`.
- مسار الصحة `/api/health` يعيد `Cache-Control: no-store`.
