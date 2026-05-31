"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import "@/app/techfix-pages.css";
import "@/app/techfix-neon.css";
import "@/app/techfix-neon-effects.css";
import AppIcon from "@/components/AppIcon";
import CatalogPageSkeleton from "@/components/CatalogPageSkeleton";
import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import StatusPanel from "@/components/StatusPanel";
import { useCart } from "@/components/CartProvider";
import { useToast } from "@/components/ToastProvider";
import { usePageSeo } from "@/hooks/usePageSeo";
import {
  buildCatalogServiceCartItem,
  resolveCatalogServiceCategoryLabel,
} from "@/lib/catalogServiceCartModel";
import {
  getCardsServicesForSelection,
  resolveCardsCategoryRouteSegment,
  resolveCardsSubcategorySelection,
} from "@/lib/cardsCatalogModel";
import { formatCurrency } from "@/lib/formatCurrency";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { loadCardsCategorySnapshot, subscribeToCardsCatalog } from "@/services/cardsCatalogService";
import styles from "../cardsCatalog.module.css";

/**
 * Renders the category-specific cards catalog page.
 *
 * @returns {JSX.Element}
 */
export default function CardsCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const rawRouteValue = Array.isArray(params?.categoryId) ? params.categoryId[0] : params?.categoryId;
  const { addToCart, openSidebar } = useCart();
  const { showToast } = useToast();
  const [activeSubId, setActiveSubId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [snapshot, setSnapshot] = useState({
    category: null,
    services: [],
    servicesCountBySubcategory: {},
    subCategories: [],
  });

  usePageSeo(snapshot.category ? {
    title: snapshot.category.name,
    description: snapshot.category.description || `تصفح بطاقات ${snapshot.category.name} ثم أضف الخدمة المناسبة إلى السلة أو اشترها مباشرة.`,
    canonicalPath: `/cards/${resolveCardsCategoryRouteSegment(snapshot.category) || rawRouteValue}`,
    breadcrumbLabel: snapshot.category.name,
    image: snapshot.category.image || "",
  } : null);

  useEffect(() => {
    let active = true;

    /**
     * Loads the current category snapshot and keeps the selected tab valid.
     *
     * @returns {Promise<void>}
     */
    async function loadSnapshot() {
      try {
        const nextSnapshot = await loadCardsCategorySnapshot(rawRouteValue);
        if (!active) return;

        setSnapshot(nextSnapshot);
        setActiveSubId((currentSubId) => resolveCardsSubcategorySelection({
          requestedSubId: currentSubId,
          services: nextSnapshot.services,
          subCategories: nextSnapshot.subCategories,
        }));
        setError(false);
      } catch (loadError) {
        console.error("[CRD-501] Failed to load one cards category page.", loadError);
        if (active) {
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    void loadSnapshot();
    const unsubscribe = subscribeToCardsCatalog(() => {
      void loadSnapshot();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [rawRouteValue]);

  const visibleServices = useMemo(() => getCardsServicesForSelection({
    rootId: snapshot.category?.id,
    services: snapshot.services,
    subCategoryId: activeSubId,
  }), [activeSubId, snapshot.category?.id, snapshot.services]);

  const activeSubCategory = useMemo(() => (
    snapshot.subCategories.find((subCategory) => subCategory.id === activeSubId) || null
  ), [activeSubId, snapshot.subCategories]);

  /**
   * Builds one cart-safe payload for a digital catalog service.
   *
   * @param {Record<string, unknown>} service
   * @returns {Record<string, unknown>}
   */
  function buildCartItem(service) {
    return buildCatalogServiceCartItem({
      service,
      categoryLabel: resolveCatalogServiceCategoryLabel({
        rootCategoryLabel: snapshot.category?.name,
        subCategoryLabel: activeSubCategory?.name,
      }),
    });
  }

  /**
   * Adds one visible service to the shared cart.
   *
   * @param {Record<string, unknown>} service
   * @returns {{ ok: boolean, message?: string }}
   */
  function addVisibleServiceToCart(service) {
    return addToCart(buildCartItem(service));
  }

  /**
   * Adds the selected service and opens the shared cart sidebar.
   *
   * @param {Record<string, unknown>} service
   * @returns {void}
   */
  function handleAddToCart(service) {
    const result = addVisibleServiceToCart(service);

    if (!result?.ok) {
      showToast(result?.message || "[CRT-301] تعذر إضافة الخدمة الآن.", { type: "error" });
      return;
    }

    openSidebar();
    showToast("تمت إضافة الخدمة إلى السلة.", { type: "success" });
  }

  /**
   * Adds the selected service and routes directly to checkout.
   *
   * @param {Record<string, unknown>} service
   * @returns {void}
   */
  function handleBuyNow(service) {
    const result = addVisibleServiceToCart(service);

    if (!result?.ok) {
      showToast(result?.message || "[CRT-302] تعذر تجهيز الخدمة للدفع الآن.", { type: "error" });
      return;
    }

    router.push("/checkout");
  }

  if (loading) {
    return <CatalogPageSkeleton showCategories categoryCount={4} productCount={6} />;
  }

  if (error || !snapshot.category) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="gift"
            eyebrow="الفئة غير متاحة"
            title="تعذر تحميل هذه الفئة من كتالوج البطاقات"
            description="[CRD-501] قد يكون الرابط غير صحيح أو أن هذه الفئة لا تحتوي خدمات منشورة حاليا."
            actions={<Link href="/cards" className="btn btn-primary">العودة إلى البطاقات</Link>}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="section page-top" style={{ paddingBottom: "4rem" }}>
      <div className="container" style={{ display: "grid", gap: "1.5rem" }}>
        <div className="section-topbar">
          <PageSectionBreadcrumbs currentLabel={snapshot.category.name} />
        </div>

        <div className="surface-panel section-shell">
          <div className="section-shell-head">
            <div className="section-shell-copy">
              <span className="section-badge">
                <AppIcon name="gift" size={14} />
                {snapshot.category.name}
              </span>
              <h1 style={{ margin: 0 }}>{snapshot.category.name}</h1>
              <p>{snapshot.category.description || "اختر الفئة الفرعية المناسبة لعرض الخدمات المتاحة للشراء."}</p>
            </div>
            <span className="section-count-badge">
              <AppIcon name="bolt" size={14} />
              {visibleServices.length} خدمة ظاهرة
            </span>
          </div>

          {snapshot.subCategories.length > 0 ? (
            <div className={styles.tabs}>
              {snapshot.subCategories.map((subCategory) => (
                <button
                  key={subCategory.id}
                  type="button"
                  className={`${styles.tabButton} ${activeSubId === subCategory.id ? styles.tabButtonActive : ""}`}
                  onClick={() => setActiveSubId(subCategory.id)}
                >
                  {subCategory.name}
                  <span style={{ marginInlineStart: "0.45rem", opacity: 0.75 }}>
                    ({snapshot.servicesCountBySubcategory[subCategory.id] || 0})
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {visibleServices.length === 0 ? (
          <StatusPanel
            icon="gift"
            eyebrow="لا توجد خدمات منشورة"
            title="هذه الفئة لا تحتوي خدمات قابلة للشراء الآن"
            description="أضف خدمة من قسم البطاقات والكتالوج داخل لوحة التحكم، لأن الفئات وحدها لا تُباع حتى يتم ربطها بسجل خدمة فعلي."
          />
        ) : (
          <div className={styles.grid}>
            {visibleServices.map((service) => {
              const image = typeof service.image === "string" ? service.image.trim() : "";

              return (
                <article key={service.id} className={`surface-card ${styles.card}`}>
                  <div className={styles.media}>
                    {image ? (
                      <Image
                        src={image}
                        alt={service.name || "خدمة رقمية"}
                        fill
                        loading="lazy"
                        quality={82}
                        sizes="(max-width: 700px) min(100vw - 3rem, 360px), 320px"
                        unoptimized={!isOptimizableImageSrc(image)}
                        className={styles.mediaImage}
                      />
                    ) : (
                      <div className={styles.iconFallback}>
                        <AppIcon name="gift" size={52} />
                      </div>
                    )}
                  </div>

                  <div className={styles.copy}>
                    <h2 style={{ margin: 0 }}>{service.name}</h2>
                    <p className={styles.description}>
                      {service.description || "خدمة رقمية متاحة الآن ويمكن إضافتها إلى السلة أو شراؤها مباشرة."}
                    </p>

                    <div className={styles.metaRow}>
                      <span className={styles.metaChip}>
                        <AppIcon name="wallet" size={14} />
                        {formatCurrency(service.price)}
                      </span>
                      <span className={styles.metaChip}>
                        <AppIcon name="layers" size={14} />
                        {service.min_qty || 1} - {service.max_qty || 9999}
                      </span>
                    </div>

                    <div className={styles.actions}>
                      <button type="button" className="btn btn-primary" onClick={() => handleAddToCart(service)}>
                        أضف إلى السلة
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => handleBuyNow(service)}>
                        اشتر الآن
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
