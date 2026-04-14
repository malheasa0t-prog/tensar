"use client";

import { usePathname } from "next/navigation";

import Breadcrumbs from "@/components/Breadcrumbs";
import { buildRouteBreadcrumbItems } from "@/lib/breadcrumbModel";

/**
 * Builds a route-aware breadcrumb trail for public interior pages.
 *
 * @param {{
 *   currentLabel?: string,
 *   className?: string,
 * }} props
 * @returns {JSX.Element | null}
 */
export default function PageSectionBreadcrumbs({ currentLabel = "", className = "" }) {
  const pathname = usePathname() || "/";
  const items = buildRouteBreadcrumbItems({
    pathname,
    currentLabel,
  });

  return <Breadcrumbs items={items} currentPath={pathname} className={className} />;
}
