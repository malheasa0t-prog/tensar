"use client";

import Link from "next/link";

import AppIcon from "@/components/AppIcon";
import styles from "@/components/Breadcrumbs.module.css";
import {
  buildBreadcrumbStructuredData,
  normalizeBreadcrumbItems,
} from "@/lib/breadcrumbModel";

/**
 * Renders a structured breadcrumb trail with optional JSON-LD support.
 *
 * @param {{
 *   items?: Array<{ href?: string, label?: string }>,
 *   currentPath?: string,
 *   className?: string,
 * }} props
 * @returns {JSX.Element | null}
 */
export default function Breadcrumbs({ items = [], currentPath = "", className = "" }) {
  const normalizedItems = normalizeBreadcrumbItems(items);
  const schema = buildBreadcrumbStructuredData({
    items: normalizedItems,
    currentPath,
  });

  if (normalizedItems.length < 2) {
    return null;
  }

  return (
    <>
      {schema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ) : null}

      <nav className={`${styles.breadcrumbs} ${className}`.trim()} aria-label="التنقل الهرمي">
        <ol className={styles.list}>
          {normalizedItems.map((item, index) => {
            const isLast = index === normalizedItems.length - 1;
            const isHome = item.href === "/";

            return (
              <li key={`${item.href || item.label}-${index}`} className={styles.item}>
                {item.href && !isLast ? (
                  <Link href={item.href} className={styles.link}>
                    {isHome ? (
                      <span className={styles.homePill}>
                        <AppIcon name="home" size={14} />
                        <span>{item.label}</span>
                      </span>
                    ) : (
                      item.label
                    )}
                  </Link>
                ) : (
                  <span className={styles.current} aria-current="page">
                    {isHome ? (
                      <span className={styles.homePill}>
                        <AppIcon name="home" size={14} />
                        <span>{item.label}</span>
                      </span>
                    ) : (
                      item.label
                    )}
                  </span>
                )}

                {!isLast ? <span className={styles.separator}>/</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
