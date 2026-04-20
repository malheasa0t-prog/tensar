"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppIcon from "@/components/AppIcon";
import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import ProductCard from "@/components/ProductCard";
import { usePageSeo } from "@/hooks/usePageSeo";
import {
  decodeFavoritesShareIds,
  FAVORITES_SHARE_QUERY_PARAM,
} from "@/lib/favoritesShareModel";
import {
  fetchFavoriteCategoryMap,
  fetchFavoriteProductSnapshots,
  mapFavoriteProductsForDisplay,
} from "@/services/favoritesService";
import styles from "./sharedFavoritesPage.module.css";

const SHARED_FAVORITES_LOAD_ERROR_MESSAGE = "تعذر تحميل المفضلة المشتركة حالياً.";

/**
 * Public storefront page for viewing a shared favorites list.
 *
 * @returns {import("react").JSX.Element}
 */
export default function SharedFavoritesPage() {
  const searchParams = useSearchParams();
  const shareToken = searchParams.get(FAVORITES_SHARE_QUERY_PARAM) || "";
  const sharedIds = useMemo(() => decodeFavoritesShareIds(shareToken), [shareToken]);
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const missingCount = Math.max(sharedIds.length - favoriteProducts.length, 0);

  usePageSeo({
    title: "مفضلة مشتركة",
    description: "استعرض قائمة منتجات TechZone التي تمت مشاركتها معك.",
    robots: "noindex, nofollow",
    canonicalPath: "/favorites/shared",
    breadcrumbLabel: "مفضلة مشتركة",
  });

  useEffect(() => {
    let active = true;

    async function loadSharedFavorites() {
      if (sharedIds.length === 0) {
        setFavoriteProducts([]);
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const rawProducts = await fetchFavoriteProductSnapshots({ productIds: sharedIds });
        const categoryIds = [...new Set(rawProducts.map((product) => product.category_id).filter(Boolean))];
        const categoryMap = await fetchFavoriteCategoryMap({ categoryIds });

        if (!active) {
          return;
        }

        setFavoriteProducts(
          mapFavoriteProductsForDisplay({
            categoryMap,
            favoriteIds: sharedIds,
            products: rawProducts,
          })
        );
        setError("");
      } catch (loadError) {
        if (!active) {
          return;
        }

        setFavoriteProducts([]);
        setError(loadError instanceof Error ? loadError.message : SHARED_FAVORITES_LOAD_ERROR_MESSAGE);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSharedFavorites();
    return () => {
      active = false;
    };
  }, [sharedIds]);

  return (
    <section className="section page-top">
      <div className="container">
        <div className={styles.stack}>
          <div className="section-topbar">
            <PageSectionBreadcrumbs currentLabel="مفضلة مشتركة" />
          </div>

          <div className={styles.heroCard}>
            <div className={styles.heroCopy}>
              <span className={styles.heroBadge}>
                <AppIcon name="heart" size={14} />
                مفضلة مشتركة
              </span>
              <h1 className={styles.heroTitle}>منتجات مقترحة من شخص يثق بـ TechZone</h1>
              <p className={styles.heroNote}>
                هذه الصفحة تعرض المنتجات التي تمت مشاركتها معك. يمكنك فتح تفاصيل أي منتج أو حفظه في مفضلتك من نفس الصفحة.
              </p>
            </div>

            <div className={styles.heroActions}>
              <span className="section-count-badge">
                <AppIcon name="shopping-bag" size={14} />
                {favoriteProducts.length} منتج ظاهر
              </span>
              <Link href="/products" className="btn btn-primary">
                تصفح كل المنتجات
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="dash-orders-card">
              <div className="dash-loading">جاري تحميل المفضلة المشتركة...</div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className={styles.errorBanner}>
              <AppIcon name="refresh-cw" size={16} />
              {error}
            </div>
          ) : null}

          {!loading && !error && sharedIds.length === 0 ? (
            <div className="dash-orders-card">
              <div className="dash-empty-orders">
                <div className="dash-empty-icon">♡</div>
                رابط المفضلة هذا غير مكتمل أو لا يحتوي على منتجات.
              </div>
            </div>
          ) : null}

          {!loading && !error && sharedIds.length > 0 && missingCount > 0 ? (
            <div className={styles.infoBanner}>
              <AppIcon name="info" size={16} />
              بعض المنتجات لم تعد متاحة، لذلك يظهر فقط ما هو موجود حالياً في المتجر.
            </div>
          ) : null}

          {!loading && !error && sharedIds.length > 0 && favoriteProducts.length === 0 ? (
            <div className="dash-orders-card">
              <div className="dash-empty-orders">
                <div className="dash-empty-icon">🛍</div>
                لم تعد المنتجات الموجودة في هذا الرابط متاحة حالياً.
              </div>
            </div>
          ) : null}

          {!loading && !error && favoriteProducts.length > 0 ? (
            <div className={styles.grid}>
              {favoriteProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} revealIndex={index} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
