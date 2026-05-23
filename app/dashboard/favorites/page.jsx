"use client";

import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import ProductCard from "@/components/ProductCard";
import { useToast } from "@/components/ToastProvider";
import { useDashboardFavorites } from "@/hooks/useDashboardFavorites";
import { buildFavoritesShareUrl } from "@/lib/favoritesShareModel";
import styles from "./favoritesPage.module.css";

/**
 * Favorites dashboard page for the current device and account session.
 *
 * @returns {import("react").JSX.Element}
 */
export default function DashboardFavoritesPage() {
  const { showToast } = useToast();
  const withFavoritesCode = (code, message) => String(message || '').startsWith('[') ? message : `[${code}] ${message}`;
  const {
    clearAllFavorites,
    error,
    favoriteCount,
    favoriteIds,
    favoriteProducts,
    hasHydratedFavorites,
    loading,
    moveFavoriteToCart,
    removeFromFavorites,
  } = useDashboardFavorites();

  /**
   * Shares the current favorites list using native share or clipboard.
   *
   * @returns {Promise<void>}
   */
  async function handleShareFavorites() {
    const shareUrl = buildFavoritesShareUrl({
      favoriteIds,
      origin: window.location.origin,
    });

    if (!shareUrl) {
      showToast(withFavoritesCode('FAV-101', "أضف منتجات إلى المفضلة أولاً حتى تتمكن من مشاركتها."), { type: "info" });
      return;
    }

    const sharePayload = {
      title: "مفضلة TechZone",
      text: "هذه قائمة المنتجات التي أعجبتني في TechZone.",
      url: shareUrl,
    };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(sharePayload);
        showToast("تم تجهيز رابط مشاركة المفضلة.", { type: "success" });
        return;
      } catch (shareError) {
        if (shareError?.name === "AbortError") {
          return;
        }
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("تم نسخ رابط المفضلة للمشاركة.", { type: "success" });
        return;
      } catch {
      showToast(withFavoritesCode('FAV-301', "تعذر النسخ التلقائي على هذا المتصفح حالياً."), { type: "warning" });
        return;
      }
    }

      showToast(withFavoritesCode('FAV-301', "تعذر النسخ التلقائي على هذا المتصفح حالياً."), { type: "warning" });
  }

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
              المنتجات المحفوظة هنا مرتبطة بهذا الجهاز، ويمكنك مشاركتها مع الأصدقاء أو نقل أي عنصر منها إلى السلة مباشرة.
            </p>
          </div>

          <div className={styles.summaryActions}>
            <button type="button" className="btn btn-outline" onClick={handleShareFavorites}>
              <AppIcon name="send" size={15} />
              مشاركة المفضلة
            </button>

            <Link href="/services" className="btn btn-primary">
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
              <Link href="/services" className="btn btn-outline">
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
