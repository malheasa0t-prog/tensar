# Non-Next Site Copy

هذه نسخة موازية من موقع `tensar` مبنية بـ `Vite + React Router` بدل `Next.js`.

الهدف من هذه النسخة:
- إبقاء موقع `Next.js` الحالي كما هو دون تعديل أو كسر.
- توفير نسخة بديلة يمكن تطويرها وتجربتها تدريجيًا خارج `Next.js`.
- إعادة استخدام نفس المكونات والتصميم الحالي قدر الإمكان.

## النسخة الاحتياطية

تم إنشاء فرع احتياطي قبل بدء العمل:

`codex/backup-before-no-next-copy`

## ما الذي يعمل الآن

- الصفحة الرئيسية
- المنتجات
- تفاصيل المنتج
- الإكسسوارات
- خدمات الصيانة
- تفاصيل خدمة الصيانة
- الفئات
- صفحة التواصل
- صفحة الاشتراكات
- المقارنة
- الدفع
- الإيداع
- تسجيل الدخول والتسجيل والاستعادة
- صفحات لوحة العميل الأساسية

ملاحظة:
- مسار `/admin` في هذه النسخة يوجّه إلى `/admin.html` الموجود في `public`.
- واجهات `/api/*` ما زالت معتمدة على الموقع/الخلفية الحالية عبر `VITE_BACKEND_ORIGIN`.

## التشغيل المحلي

1. افتح مجلد النسخة:

```powershell
cd "C:\Users\m\Desktop\tensor flow\tensar\non-next-site"
```

2. ثبّت الحزم:

```powershell
npm install
```

3. انسخ ملف البيئة:

```powershell
Copy-Item .env.example .env
```

4. شغّل السيرفر المحلي:

```powershell
npm run dev
```

## البناء

```powershell
npm run build
```

بعد البناء، يتم توليد الملفات التالية داخل `dist` تلقائيًا:

- `admin-config.js`
- `robots.txt`
- `sitemap.xml`
- `_redirects`

## متغيرات البيئة

استخدم القيم التالية داخل `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SITE_URL`
- `ENABLE_LEGACY_ADMIN_WRITE`
- `VITE_BACKEND_ORIGIN`

## ملاحظات مهمة

- هذه النسخة لا تنشر تلقائيًا إلى `tensr.systems`.
- الموقع الحي الحالي ما زال يعمل من مشروع `Next.js` الأصلي.
- الهدف الحالي هو إنشاء بديل آمن ومتدرج، وليس استبدال النشر الحالي مباشرة.
- لوحة الأدمن في هذه النسخة يمكنها الإقلاع من `admin-config.js` الثابت دون الاعتماد على `/api/admin/runtime`.
