"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSiteRuntime } from "@/components/SiteRuntimeProvider";
import {
  buildBreadcrumbStructuredData,
  buildRouteBreadcrumbItems,
  normalizeBreadcrumbItems,
} from "@/lib/breadcrumbModel";
import { getSocialLinks } from "@/lib/contactChannels";
import {
  buildAbsoluteUrl,
  buildOrganizationStructuredData,
  resolveMetadataImageUrls,
} from "@/lib/seo";
import {
  buildDocumentTitle,
  getRouteSeoDefaults,
  mergeSeoMetadata,
} from "@/lib/seoRuntimeModel";

const SeoContext = createContext(() => {});
const MANAGED_META_ATTRIBUTE = "data-tz-seo";
const STRUCTURED_DATA_SELECTOR = 'script[data-tz-seo-json-ld="true"]';

/**
 * Ensures a managed head element exists and returns it.
 *
 * @param {string} selector
 * @param {string} tagName
 * @returns {HTMLElement}
 */
function ensureHeadElement(selector, tagName) {
  const existingElement = document.head.querySelector(selector);
  if (existingElement) return existingElement;
  const nextElement = document.createElement(tagName);
  nextElement.setAttribute(MANAGED_META_ATTRIBUTE, "true");
  document.head.appendChild(nextElement);
  return nextElement;
}

/**
 * Upserts a single meta tag in the document head.
 *
 * @param {{ key: string, content: string, property?: boolean }} input
 * @returns {void}
 */
function upsertMetaTag({ key, content, property = false }) {
  const normalizedContent = String(content || "").trim();
  const attributeName = property ? "property" : "name";
  const selector = `meta[${attributeName}="${key}"]`;

  if (!normalizedContent) {
    document.head.querySelector(selector)?.remove();
    return;
  }

  const metaTag = ensureHeadElement(selector, "meta");
  metaTag.setAttribute(attributeName, key);
  metaTag.setAttribute("content", normalizedContent);
}

/**
 * Upserts the canonical link tag.
 *
 * @param {string} href
 * @returns {void}
 */
function upsertCanonicalLink(href) {
  const normalizedHref = String(href || "").trim();
  const selector = 'link[rel="canonical"]';

  if (!normalizedHref) {
    document.head.querySelector(selector)?.remove();
    return;
  }

  const linkTag = ensureHeadElement(selector, "link");
  linkTag.setAttribute("rel", "canonical");
  linkTag.setAttribute("href", normalizedHref);
}

/**
 * Replaces managed JSON-LD scripts with the current payload list.
 *
 * @param {Array<Record<string, unknown>>} schemas
 * @returns {void}
 */
function syncStructuredDataScripts(schemas) {
  document.head.querySelectorAll(STRUCTURED_DATA_SELECTOR).forEach((node) => node.remove());

  schemas.filter(Boolean).forEach((schema) => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.tzSeoJsonLd = "true";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

/**
 * Safely parses a serialized page SEO registration.
 *
 * @param {string} serializedConfig
 * @returns {Record<string, unknown> | null}
 */
function parseSeoRegistration(serializedConfig) {
  try {
    return serializedConfig ? JSON.parse(serializedConfig) : null;
  } catch {
    return null;
  }
}

/**
 * Builds the breadcrumb schema for the current route when possible.
 *
 * @param {string} pathname
 * @param {Record<string, unknown>} metadata
 * @returns {Record<string, unknown> | null}
 */
function resolveBreadcrumbSchema(pathname, metadata) {
  const explicitItems = normalizeBreadcrumbItems(metadata?.breadcrumbItems);
  const fallbackItems = buildRouteBreadcrumbItems({
    pathname,
    currentLabel: metadata?.breadcrumbLabel || metadata?.title,
  });
  const breadcrumbItems = explicitItems.length > 0 ? explicitItems : fallbackItems;

  return buildBreadcrumbStructuredData({
    items: breadcrumbItems,
    currentPath: pathname,
  });
}

/**
 * Applies the runtime SEO state to the current document head.
 *
 * @param {{
 *   brandName: string,
 *   pathname: string,
 *   metadata: Record<string, unknown>,
 *   organizationSchema: Record<string, unknown>,
 * }} input
 * @returns {void}
 */
function applySeoMetadata({ brandName, pathname, metadata, organizationSchema }) {
  const resolvedTitle = buildDocumentTitle({
    brandName,
    pageTitle: metadata.title,
  });
  const resolvedImages = resolveMetadataImageUrls(metadata.image);
  const primaryImage = resolvedImages[0] || "";
  const canonicalUrl = buildAbsoluteUrl(metadata.canonicalPath || pathname);
  const breadcrumbSchema = resolveBreadcrumbSchema(pathname, metadata);
  const pageSchemas = Array.isArray(metadata.structuredData)
    ? metadata.structuredData.filter(Boolean)
    : [];

  document.title = resolvedTitle;
  upsertMetaTag({ key: "description", content: metadata.description });
  upsertMetaTag({ key: "robots", content: metadata.robots });
  upsertMetaTag({ key: "twitter:card", content: "summary_large_image" });
  upsertMetaTag({ key: "twitter:title", content: resolvedTitle });
  upsertMetaTag({ key: "twitter:description", content: metadata.description });
  upsertMetaTag({ key: "twitter:image", content: primaryImage });
  upsertMetaTag({ key: "og:type", content: metadata.type || "website", property: true });
  upsertMetaTag({ key: "og:site_name", content: brandName, property: true });
  upsertMetaTag({ key: "og:locale", content: "ar_JO", property: true });
  upsertMetaTag({ key: "og:title", content: resolvedTitle, property: true });
  upsertMetaTag({ key: "og:description", content: metadata.description, property: true });
  upsertMetaTag({ key: "og:image", content: primaryImage, property: true });
  upsertMetaTag({ key: "og:url", content: canonicalUrl, property: true });
  upsertCanonicalLink(canonicalUrl);
  syncStructuredDataScripts([organizationSchema, breadcrumbSchema, ...pageSchemas]);
}

/**
 * Registers route-specific SEO overrides for the current page.
 *
 * @param {Record<string, unknown> | null} config
 * @returns {void}
 */
export function usePageSeo(config = null) {
  const registerSeo = useContext(SeoContext);
  const entryIdRef = useRef(`seo-${Math.random().toString(36).slice(2)}`);
  const serializedConfig = JSON.stringify(config || null);

  useEffect(() => {
    registerSeo(entryIdRef.current, serializedConfig);
    return () => {
      registerSeo(entryIdRef.current, null);
    };
  }, [registerSeo, serializedConfig]);
}

/**
 * Provides centralized runtime SEO management for the SPA.
 *
 * @param {{ children: import("react").ReactNode }} props
 * @returns {JSX.Element}
 */
export default function SeoProvider({ children }) {
  const location = useLocation();
  const { siteSettings } = useSiteRuntime();
  const [registrations, setRegistrations] = useState({});
  const activeRegistration = Object.values(registrations).at(-1) || "";
  const pageMetadata = parseSeoRegistration(activeRegistration) || {};
  const routeMetadata = getRouteSeoDefaults({
    pathname: location.pathname,
    siteSettings,
  });
  const metadata = mergeSeoMetadata({
    routeMetadata,
    pageMetadata,
  });

  const registerSeo = useCallback((id, serializedConfig) => {
    setRegistrations((current) => {
      if (!serializedConfig) {
        if (!(id in current)) return current;
        const nextState = { ...current };
        delete nextState[id];
        return nextState;
      }

      if (current[id] === serializedConfig) {
        return current;
      }

      return { ...current, [id]: serializedConfig };
    });
  }, []);

  useEffect(() => {
    const socialUrls = getSocialLinks(siteSettings).map((item) => item.href);
    const organizationSchema = buildOrganizationStructuredData({
      siteSettings,
      sameAs: socialUrls,
    });
    const brandName = siteSettings?.company?.name || "TechZone";

    applySeoMetadata({
      brandName,
      pathname: location.pathname,
      metadata,
      organizationSchema,
    });
  }, [location.pathname, metadata, siteSettings]);

  return <SeoContext.Provider value={registerSeo}>{children}</SeoContext.Provider>;
}
