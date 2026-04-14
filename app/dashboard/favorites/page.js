"use client";

import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import ProductCard from "@/components/ProductCard";
import { useDashboardFavorites } from "@/hooks/useDashboardFavorites";
import styles from "./favoritesPage.module.css";

/**
 * Favorites dashboard page for the current device and account session.
 *
 * @returns {import("react").JSX.Element}
 */
export default function DashboardFavoritesPage() {
  const {
    clearAllFavorites,
    error,
    favoriteCount,
    favoriteProducts,
    hasHydratedFavorites,
    loading,
    moveFavoriteToCart,
    removeFromFavorites,
  } = useDashboardFavorites();

  if (loading || !hasHydratedFavorites) {
    return (
      <div className="dash-orders-card">
        <div className="dash-loading">جاري تحميل المفضلة...</div>
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <div className={`dash-orders-card ${styles.summaryCard}`}>
        <div className="dash-orders-head">
          <h3>المفضلة</h3>
          {favoriteCount > 0 ? (
            <button type="button" className="btn btn-outline" onClick={clearAllFavorites}>
              <AppIcon name="x" size={15} />
              مسح الكل
            </button>
          ) : null}
        </div>

        <div className={styles.summaryBody}>
          <div className={styles.summaryMeta}>
            <span className="section-count-badge">
              <AppIcon name="heart" size={14} />
              {favoriteCount} منتج
            </span>
            <p className={styles.summaryNote}>
              المنتجات المحفوظة هنا مرتبطة بهذا الجهاز، ويمكنك نقل أي منتج إلى السلة مباشرة من نفس الصفحة.
            </p>
          </div>

          <div className={styles.summaryActions}>
            <Link href="/products" className="btn btn-primary">
              <AppIcon name="shopping-bag" size={15} />
              تصفح المنتجات
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className={styles.errorBanner}>
          <AppIcon name="refresh-cw" size={16} />
          {error}
        </div>
      ) : null}

      {favoriteProducts.length === 0 ? (
        <div className="dash-orders-card">
          <div className="dash-empty-orders">
            <div className="dash-empty-icon">♡</div>
            لا توجد منتجات محفوظة في المفضلة حالياً
            <div className={styles.emptyActions}>
              <Link href="/products" className="btn btn-outline">
                ابدأ بإضافة منتجات
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {favoriteProducts.map((product, index) => (
            <div key={product.id} className={styles.cardShell}>
              <ProductCard product={product} revealIndex={index} />

              <div className={styles.cardActions}>
                <button type="button" className="btn btn-primary" onClick={() => moveFavoriteToCart(product)}>
                  <AppIcon name="shopping-cart" size={15} />
                  انقل إلى السلة
                </button>

                <button type="button" className="btn btn-outline" onClick={() => removeFromFavorites(product.id)}>
                  <AppIcon name="heart" size={15} />
                  إزالة من المفضلة
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
