/**
 * Route-aware suspense fallback helpers for the Vite SPA shell.
 */

const DEFAULT_SCREEN_COPY = Object.freeze({
  compact: true,
  description: "يتم تحميل الواجهة التالية مع الحفاظ على السياق البصري للمستخدم.",
  eyebrow: "جاري التحميل",
  title: "نجهز الصفحة التالية",
});

const CATALOG_ROUTE_CONFIG = Object.freeze({
  "/accessories": { kind: "catalog", productCount: 6 },
  "/contact": { kind: "catalog", productCount: 3 },
  "/products": { kind: "catalog", productCount: 8 },
  "/services": { kind: "catalog", productCount: 6 },
  "/subscriptions": { kind: "catalog", productCount: 6 },
});

const SCREEN_ROUTE_CONFIG = Object.freeze({
  "/compare": {
    compact: true,
    description: "نرتب بطاقات المقارنة وعناصر المواصفات لتظهر فور اكتمال الصفحة.",
    eyebrow: "مقارنة الأجهزة",
    title: "نحضّر لوحة المقارنة",
  },
  "/deposit": {
    compact: true,
    description: "يتم تجهيز خيارات شحن الرصيد وسجل العمليات بشكل آمن وواضح.",
    eyebrow: "المحفظة",
    title: "نجهز صفحة شحن الرصيد",
  },
});

/**
 * Normalizes a pathname into a stable route key.
 *
 * @param {string | null | undefined} pathname
 * @returns {string}
 */
export function normalizeSuspensePathname(pathname) {
  if (typeof pathname !== "string") {
    return "/";
  }

  const trimmedPathname = pathname.trim();

  if (!trimmedPathname) {
    return "/";
  }

  const normalizedPathname = trimmedPathname.startsWith("/")
    ? trimmedPathname
    : `/${trimmedPathname}`;

  return normalizedPathname.replace(/\/+$/, "") || "/";
}

/**
 * Resolves the most suitable suspense fallback configuration for a route.
 *
 * @param {string | null | undefined} pathname
 * @returns {Record<string, unknown>}
 */
export function resolveRouteSuspenseFallback(pathname) {
  const normalizedPathname = normalizeSuspensePathname(pathname);

  if (normalizedPathname === "/") {
    return { kind: "home" };
  }

  if (normalizedPathname.startsWith("/dashboard")) {
    return { kind: "dashboard" };
  }

  if (normalizedPathname === "/checkout") {
    return { kind: "checkout" };
  }

  if (normalizedPathname.startsWith("/products/")) {
    return { kind: "product-details" };
  }

  if (normalizedPathname.startsWith("/category/")) {
    return {
      categoryCount: 4,
      kind: "catalog",
      productCount: 6,
      showCategories: true,
    };
  }

  if (normalizedPathname.startsWith("/services/")) {
    return { kind: "catalog", productCount: 3 };
  }

  if (normalizedPathname.startsWith("/auth/")) {
    return {
      compact: true,
      description: "يتم الآن تجهيز صفحة الحساب والتحقق من تدفق الدخول أو الاستعادة.",
      eyebrow: "الحساب",
      kind: "screen",
      title: "نجهز بوابة الدخول",
    };
  }

  if (CATALOG_ROUTE_CONFIG[normalizedPathname]) {
    return CATALOG_ROUTE_CONFIG[normalizedPathname];
  }

  if (SCREEN_ROUTE_CONFIG[normalizedPathname]) {
    return {
      kind: "screen",
      ...SCREEN_ROUTE_CONFIG[normalizedPathname],
    };
  }

  return {
    kind: "screen",
    ...DEFAULT_SCREEN_COPY,
  };
}
