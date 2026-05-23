/**
 * Shared breadcrumb helpers for route-aware navigation trails and JSON-LD.
 */

import { buildAbsoluteUrl } from "./seo.js";

const HOME_LABEL = "الرئيسية";
const SERVICES_LABEL = "خدمات الصيانة";
const CHECKOUT_LABEL = "إتمام الطلب";
const COMPARE_LABEL = "المقارنة";
const DEFAULT_DETAIL_LABEL = "التفاصيل";

/**
 * Normalizes breadcrumb items before rendering.
 *
 * @param {Array<Record<string, unknown>>} items - Raw breadcrumb items.
 * @returns {Array<{ href?: string, label: string }>} Safe breadcrumb items.
 */
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

/**
 * Builds route-aware breadcrumb items for public pages.
 *
 * @param {{ pathname?: string, currentLabel?: string }} input - Route context.
 * @returns {Array<{ href?: string, label: string }>} Breadcrumb items.
 */
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
      { href: "/services", label: SERVICES_LABEL },
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
      { href: "/services", label: SERVICES_LABEL },
      { label: currentLabel || formatBreadcrumbSegment(lastSegment) },
    ]);
  }

  if (section === "checkout") {
    return normalizeBreadcrumbItems([
      { href: "/", label: HOME_LABEL },
      { href: "/services", label: SERVICES_LABEL },
      { label: CHECKOUT_LABEL },
    ]);
  }

  if (section === "compare") {
    return normalizeBreadcrumbItems([
      { href: "/", label: HOME_LABEL },
      { href: "/services", label: SERVICES_LABEL },
      { label: COMPARE_LABEL },
    ]);
  }

  return [];
}

/**
 * Builds JSON-LD structured data for breadcrumbs.
 *
 * @param {{ items?: Array<Record<string, unknown>>, currentPath?: string }} input - Breadcrumb context.
 * @returns {Record<string, unknown> | null} Breadcrumb JSON-LD.
 */
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

/**
 * Formats a path segment into a readable breadcrumb label.
 *
 * @param {string} segment - Raw URL segment.
 * @returns {string} Display label.
 */
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

/**
 * Normalizes a route pathname.
 *
 * @param {unknown} pathname - Raw pathname.
 * @returns {string} Pathname starting with a slash.
 */
function normalizePathname(pathname) {
  const value = String(pathname || "").trim();

  if (!value) {
    return "/";
  }

  return value.startsWith("/") ? value : `/${value}`;
}

/**
 * Decodes a URL segment without throwing.
 *
 * @param {unknown} segment - Raw URL segment.
 * @returns {string} Decoded segment.
 */
function safelyDecodeSegment(segment) {
  try {
    return decodeURIComponent(String(segment || "").trim());
  } catch {
    return String(segment || "").trim();
  }
}
