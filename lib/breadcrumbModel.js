/**
 * Shared breadcrumb helpers for route-aware navigation trails and JSON-LD.
 */

import { buildAbsoluteUrl } from "./seo.js";

const HOME_LABEL = "الرئيسية";
const PRODUCTS_LABEL = "المنتجات";
const SERVICES_LABEL = "خدمات الصيانة";
const CHECKOUT_LABEL = "إتمام الشراء";
const COMPARE_LABEL = "مقارنة المنتجات";
const DEFAULT_DETAIL_LABEL = "التفاصيل";

export function normalizeBreadcrumbItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      href: typeof item?.href === "string" && item.href.trim() ? item.href.trim() : undefined,
      label: String(item?.label || "").trim(),
    }))
    .filter((item) => item.label);
}

export function buildRouteBreadcrumbItems(input) {
  const pathname = normalizePathname(input?.pathname);
  const currentLabel = String(input?.currentLabel || "").trim();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  const section = segments[0];
  const lastSegment = segments[segments.length - 1];

  if (section === "products") {
    return normalizeBreadcrumbItems([
      { href: "/", label: HOME_LABEL },
      segments.length === 1
        ? { label: PRODUCTS_LABEL }
        : { href: "/products", label: PRODUCTS_LABEL },
      segments.length > 1 ? { label: currentLabel || formatBreadcrumbSegment(lastSegment) } : null,
    ]);
  }

  if (section === "services") {
    return normalizeBreadcrumbItems([
      { href: "/", label: HOME_LABEL },
      segments.length === 1
        ? { label: SERVICES_LABEL }
        : { href: "/services", label: SERVICES_LABEL },
      segments.length > 1 ? { label: currentLabel || formatBreadcrumbSegment(lastSegment) } : null,
    ]);
  }

  if (section === "category") {
    return normalizeBreadcrumbItems([
      { href: "/", label: HOME_LABEL },
      { href: "/products", label: PRODUCTS_LABEL },
      { label: currentLabel || formatBreadcrumbSegment(lastSegment) },
    ]);
  }

  if (section === "checkout") {
    return normalizeBreadcrumbItems([
      { href: "/", label: HOME_LABEL },
      { href: "/products", label: PRODUCTS_LABEL },
      { label: CHECKOUT_LABEL },
    ]);
  }

  if (section === "compare") {
    return normalizeBreadcrumbItems([
      { href: "/", label: HOME_LABEL },
      { href: "/products", label: PRODUCTS_LABEL },
      { label: COMPARE_LABEL },
    ]);
  }

  return [];
}

export function buildBreadcrumbStructuredData(input) {
  const items = normalizeBreadcrumbItems(input?.items);
  const currentPath = typeof input?.currentPath === "string" ? input.currentPath.trim() : "";

  if (items.length < 2) {
    return null;
  }

  const itemListElement = items.map((item, index) => {
    const isLast = index === items.length - 1;
    const itemUrl = item.href || (isLast && currentPath ? currentPath : "");

    return {
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(itemUrl ? { item: buildAbsoluteUrl(itemUrl) } : {}),
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

function formatBreadcrumbSegment(segment) {
  const decodedValue = safelyDecodeSegment(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!decodedValue) {
    return DEFAULT_DETAIL_LABEL;
  }

  return /[a-z\u0600-\u06FF]/i.test(decodedValue) ? decodedValue : DEFAULT_DETAIL_LABEL;
}

function normalizePathname(pathname) {
  const value = String(pathname || "").trim();

  if (!value) {
    return "/";
  }

  return value.startsWith("/") ? value : `/${value}`;
}

function safelyDecodeSegment(segment) {
  try {
    return decodeURIComponent(String(segment || "").trim());
  } catch {
    return String(segment || "").trim();
  }
}
