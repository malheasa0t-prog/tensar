/**
 * Shared runtime SEO helpers for route-level metadata in the SPA.
 */

const DEFAULT_PUBLIC_ROBOTS = "index, follow";
const DEFAULT_PRIVATE_ROBOTS = "noindex, nofollow";
const DEFAULT_HOME_TITLE = "بيع وصيانة أجهزة الكمبيوتر والخدمات التقنية";
const DEFAULT_SITE_DESCRIPTION =
  "تسوق أجهزة الكمبيوتر والإكسسوارات واحجز خدمات الصيانة من TechZone بتجربة عربية سريعة وواضحة.";

/**
 * Returns trimmed plain text values.
 *
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/**
 * Normalizes a pathname to a leading-slash route.
 *
 * @param {string} pathname
 * @returns {string}
 */
function normalizePathname(pathname) {
  const candidate = cleanText(pathname);
  if (!candidate) return "/";
  return candidate.startsWith("/") ? candidate : `/${candidate}`;
}

/**
 * Creates a normalized metadata object with shared defaults.
 *
 * @param {Record<string, unknown>} metadata
 * @returns {Record<string, unknown>}
 */
function createMetadata(metadata) {
  return {
    canonicalPath: "/",
    robots: DEFAULT_PUBLIC_ROBOTS,
    type: "website",
    ...metadata,
  };
}

/**
 * Returns the best default description from site settings.
 *
 * @param {Record<string, unknown>} siteSettings
 * @returns {string}
 */
export function getDefaultSiteDescription(siteSettings = {}) {
  return (
    cleanText(siteSettings?.hero?.description) ||
    cleanText(siteSettings?.company?.slogan) ||
    DEFAULT_SITE_DESCRIPTION
  );
}

/**
 * Builds the final document title for the browser tab.
 *
 * @param {{ brandName?: string, pageTitle?: string }} input
 * @returns {string}
 */
export function buildDocumentTitle({ brandName = "TechZone", pageTitle = "" } = {}) {
  const resolvedBrandName = cleanText(brandName) || "TechZone";
  const resolvedPageTitle = cleanText(pageTitle);
  return resolvedPageTitle ? `${resolvedBrandName} | ${resolvedPageTitle}` : resolvedBrandName;
}

/**
 * Returns route defaults for the homepage.
 *
 * @param {Record<string, unknown>} siteSettings
 * @returns {Record<string, unknown>}
 */
function buildHomeMetadata(siteSettings) {
  return createMetadata({
    title: DEFAULT_HOME_TITLE,
    description: getDefaultSiteDescription(siteSettings),
  });
}

/**
 * Returns route defaults for the public catalog pages.
 *
 * @param {string} pathname
 * @returns {Record<string, unknown>}
 */
function buildCatalogMetadata(pathname) {
  const routeMap = {
    "/products": {
      title: "المنتجات",
      description: "تصفح أجهزة الكمبيوتر والقطع الجاهزة مع بحث وفلاتر ومقارنة سريعة.",
    },
    "/services": {
      title: "خدمات الصيانة",
      description: "احجز خدمات الصيانة والتشخيص والترقية مع تفاصيل وأسعار وخطوات حجز واضحة.",
    },
    "/contact": {
      title: "اتصل بنا",
      description: "تواصل مع TechZone عبر الهاتف والبريد وواتساب وقنوات التواصل الرسمية.",
      breadcrumbItems: [
        { href: "/", label: "الرئيسية" },
        { label: "اتصل بنا" },
      ],
    },
  };

  return createMetadata({
    ...routeMap[pathname],
    canonicalPath: pathname,
  });
}

/**
 * Returns route defaults for public utility pages.
 *
 * @param {string} pathname
 * @returns {Record<string, unknown>}
 */
function buildUtilityMetadata(pathname) {
  const routeMap = {
    "/compare": {
      title: "مقارنة المنتجات",
      description: "قارن بين المنتجات جنبًا إلى جنب لمراجعة السعر والمواصفات والتوفر.",
      robots: DEFAULT_PRIVATE_ROBOTS,
    },
    "/checkout": {
      title: "إتمام الشراء",
      description: "أكمل طلبك وأدخل بيانات الشحن والدفع في خطوات واضحة.",
      robots: DEFAULT_PRIVATE_ROBOTS,
    },
    "/deposit": {
      title: "إيداع الرصيد",
      description: "ارفع طلب إيداع للمحفظة مع إثبات التحويل ومتابعة حالة الطلب.",
      robots: DEFAULT_PRIVATE_ROBOTS,
      breadcrumbItems: [
        { href: "/", label: "الرئيسية" },
        { label: "إيداع الرصيد" },
      ],
    },
  };

  return createMetadata({
    ...routeMap[pathname],
    canonicalPath: pathname,
  });
}

/**
 * Returns route defaults for auth pages.
 *
 * @param {string} pathname
 * @returns {Record<string, unknown>}
 */
function buildAuthMetadata(pathname) {
  const titleMap = {
    "/auth/login": "تسجيل الدخول",
    "/auth/register": "إنشاء حساب",
    "/auth/recover": "استعادة كلمة المرور",
    "/auth/callback": "جارٍ التحقق من الحساب",
  };

  return createMetadata({
    title: titleMap[pathname] || "الحساب",
    description: "أدخل إلى حسابك لمتابعة الطلبات والمحفظة وخدمات الدعم.",
    robots: DEFAULT_PRIVATE_ROBOTS,
    canonicalPath: pathname,
  });
}

/**
 * Returns route defaults for dashboard pages.
 *
 * @param {string} pathname
 * @returns {Record<string, unknown>}
 */
function buildDashboardMetadata(pathname) {
  const routeMap = {
    "/dashboard": "لوحة التحكم",
    "/dashboard/orders": "طلباتي",
    "/dashboard/favorites": "المفضلة",
    "/dashboard/profile": "الملف الشخصي",
    "/dashboard/notifications": "الإشعارات",
    "/dashboard/deposit": "طلبات الإيداع",
    "/dashboard/wallet": "المحفظة",
  };

  return createMetadata({
    title: routeMap[pathname] || "حسابي",
    description: "أدر حسابك وطلباتك والإشعارات والمحفظة من لوحة تحكم واضحة.",
    robots: DEFAULT_PRIVATE_ROBOTS,
    canonicalPath: pathname,
  });
}

/**
 * Returns route defaults for dynamic catalog detail pages.
 *
 * @param {string} pathname
 * @param {Record<string, unknown>} siteSettings
 * @returns {Record<string, unknown>}
 */
function buildDynamicDetailMetadata(pathname, siteSettings) {
  if (pathname.startsWith("/products/")) {
    return createMetadata({
      title: "تفاصيل المنتج",
      description: getDefaultSiteDescription(siteSettings),
      type: "product",
      canonicalPath: pathname,
    });
  }

  if (pathname.startsWith("/services/")) {
    return createMetadata({
      title: "تفاصيل خدمة الصيانة",
      description: getDefaultSiteDescription(siteSettings),
      canonicalPath: pathname,
    });
  }

  return createMetadata({
    title: "فئة المنتجات",
    description: getDefaultSiteDescription(siteSettings),
    canonicalPath: pathname,
  });
}

/**
 * Returns generic defaults for unmatched public routes.
 *
 * @param {string} pathname
 * @param {Record<string, unknown>} siteSettings
 * @returns {Record<string, unknown>}
 */
function buildFallbackMetadata(pathname, siteSettings) {
  return createMetadata({
    description: getDefaultSiteDescription(siteSettings),
    canonicalPath: pathname,
  });
}

/**
 * Returns route-level SEO defaults for the active pathname.
 *
 * @param {{ pathname?: string, siteSettings?: Record<string, unknown> }} input
 * @returns {Record<string, unknown>}
 */
export function getRouteSeoDefaults({ pathname = "/", siteSettings = {} } = {}) {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === "/") return buildHomeMetadata(siteSettings);

  if (normalizedPath in { "/products": 1, "/services": 1, "/contact": 1 }) {
    return buildCatalogMetadata(normalizedPath);
  }

  if (normalizedPath in { "/compare": 1, "/checkout": 1, "/deposit": 1 }) {
    return buildUtilityMetadata(normalizedPath);
  }

  if (normalizedPath.startsWith("/auth/")) return buildAuthMetadata(normalizedPath);
  if (normalizedPath.startsWith("/dashboard")) return buildDashboardMetadata(normalizedPath);

  if (
    normalizedPath.startsWith("/products/") ||
    normalizedPath.startsWith("/services/") ||
    normalizedPath.startsWith("/category/")
  ) {
    return buildDynamicDetailMetadata(normalizedPath, siteSettings);
  }

  return buildFallbackMetadata(normalizedPath, siteSettings);
}

/**
 * Merges route defaults with page-level overrides.
 *
 * @param {{ routeMetadata?: Record<string, unknown>, pageMetadata?: Record<string, unknown> }} input
 * @returns {Record<string, unknown>}
 */
export function mergeSeoMetadata({ routeMetadata = {}, pageMetadata = {} } = {}) {
  const pageData = pageMetadata && typeof pageMetadata === "object" ? pageMetadata : {};
  const structuredData = Array.isArray(pageData.structuredData) ? pageData.structuredData.filter(Boolean) : [];

  return {
    ...routeMetadata,
    ...pageData,
    structuredData,
    image: pageData.image || routeMetadata.image || "",
    title: cleanText(pageData.title) || cleanText(routeMetadata.title),
    description: cleanText(pageData.description) || cleanText(routeMetadata.description),
    robots: cleanText(pageData.robots) || cleanText(routeMetadata.robots) || DEFAULT_PUBLIC_ROBOTS,
    canonicalPath: cleanText(pageData.canonicalPath) || cleanText(routeMetadata.canonicalPath) || "/",
  };
}
