"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "@/app/techfix-pages.css";
import "@/app/techfix-neon.css";
import "@/app/techfix-neon-effects.css";
import AppIcon from "@/components/AppIcon";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import StatusPanel from "@/components/StatusPanel";
import { usePageSeo } from "@/hooks/usePageSeo";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { resolveCardsCategoryRouteSegment } from "@/lib/cardsCatalogModel";
import { loadCardsCatalogSnapshot, subscribeToCardsCatalog } from "@/services/cardsCatalogService";
import styles from "./cardsCatalog.module.css";

/**
 * Renders the root cards catalog page.
 *
 * @returns {JSX.Element}
 */
export default function CardsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [roots, setRoots] = useState([]);

  usePageSeo({
    title: "البطاقات",
    description: "تصفح أقسام البطاقات الرقمية المنشورة داخل TechZone واختر الفئة المناسبة قبل الشراء.",
    canonicalPath: "/cards",
    breadcrumbLabel: "البطاقات",
  });

  useEffect(() => {
    let active = true;

    async function loadSnapshot() {
      try {
        const snapshot = await loadCardsCatalogSnapshot();
        if (!active) return;
        setRoots(Array.isArray(snapshot.roots) ? snapshot.roots : []);
        setError(false);
      } catch (loadError) {
        console.error("[CRD-500] Failed to load cards root catalog.", loadError);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSnapshot();
    const unsubscribe = subscribeToCardsCatalog(() => {
      void loadSnapshot();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <CatalogPageSkeleton showCategories categoryCount={4} productCount={4} />;
  }

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="gift"
            eyebrow="تعذر تحميل البطاقات"
            title="حدث خطأ أثناء تحميل أقسام البطاقات"
            description="[CRD-500] تعذر قراءة أقسام البطاقات الآن. حاول مرة أخرى بعد قليل."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="section page-top" style={{ paddingBottom: "4rem" }}>
      <div className="container" style={{ display: "grid", gap: "1.5rem" }}>
        <div className="section-topbar">
          <PageSectionBreadcrumbs currentLabel="البطاقات" />
        </div>

        <div className="surface-panel section-shell">
          <div className="section-shell-head">
            <div className="section-shell-copy">
              <span className="section-badge">
                <AppIcon name="gift" size={14} />
                البطاقات الرقمية
              </span>
              <h1>اختر القسم المناسب</h1>
              <p>يعرض هذا القسم الفئات الرئيسية التي تحتوي خدمات قابلة للشراء من جدول الكتالوج الرقمي.</p>
            </div>
            <span className="section-count-badge">
              <AppIcon name="folder" size={14} />
              {roots.length} قسم
            </span>
          </div>

          {roots.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem 1rem" }}>
              <i className="fas fa-gift" aria-hidden="true"></i>
              <p>لا توجد بطاقات منشورة بعد. ستظهر هنا تلقائيًا عند ربط الخدمات الرقمية بالفئات المناسبة.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {roots.map((category) => {
                const image = typeof category.image === "string" ? category.image.trim() : "";

                return (
                  <Link
                    key={category.id}
                    href={`/cards/${resolveCardsCategoryRouteSegment(category)}`}
                    className={`surface-card ${styles.card}`}
                  >
                    <div className={styles.media}>
                      {image ? (
                        <Image
                          src={image}
                          alt={category.name || "قسم بطاقات"}
                          fill
                          loading="lazy"
                          quality={82}
                          sizes="(max-width: 700px) min(100vw - 3rem, 360px), 320px"
                          unoptimized={!isOptimizableImageSrc(image)}
                          className={styles.mediaImage}
                        />
                      ) : (
                        <div className={styles.iconFallback}>
                          <AppIcon name={category.icon || "gift"} size={54} />
                        </div>
                      )}
                    </div>

                    <div className={styles.copy}>
                      <h2 style={{ margin: 0 }}>{category.name}</h2>
                      <p className={styles.description}>
                        {category.description || "افتح هذا القسم لعرض الفئات الفرعية والخدمات الرقمية المرتبطة به."}
                      </p>
                      <span className={styles.countBadge}>
                        <AppIcon name="bolt" size={14} />
                        {category.serviceCount || 0} خدمة
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
