"use client";

import { useState, useDeferredValue, useMemo } from "react";
import AppIcon from "@/components/AppIcon";
import ProductCard from "@/components/ProductCard";
import ScrollReveal from "@/components/ScrollReveal";
import StatusPanel from "@/components/StatusPanel";
import { ACCESSORY_PUBLIC_LABEL, ACCESSORY_SECTION_NAME } from "@/lib/accessoryCatalog";
import styles from "./AccessoriesClient.module.css";

/** @constant Default sort option value */
const DEFAULT_SORT_OPTION = "newest";

/** @constant Available sorting options */
const SORT_OPTIONS = [
  { value: DEFAULT_SORT_OPTION, label: "الأحدث" },
  { value: "price_asc", label: "السعر: من الأقل للأعلى" },
  { value: "price_desc", label: "السعر: من الأعلى للأقل" },
];

/**
 * Normalizes text for search matching.
 *
 * @param {string} value - Text to normalize
 * @returns {string} Lowercased trimmed string
 */
function normalizeAccessoryText(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Checks whether a product matches the search query.
 *
 * @param {{ product: object, query: string }} params
 * @returns {boolean}
 */
function matchesAccessorySearch({ product, query }) {
  if (!query) return true;
  return [product.name, product.description, product.brand].some((value) =>
    normalizeAccessoryText(value).includes(query)
  );
}

/**
 * Sorts accessory products by the selected sort option.
 *
 * @param {{ products: object[], sortOption: string }} params
 * @returns {object[]} Sorted products
 */
function sortAccessoryProducts({ products, sortOption }) {
  const nextProducts = [...products];
  if (sortOption === "price_asc") {
    return nextProducts.sort(
      (first, second) =>
        Number(first.discount_price || first.price || 0) -
        Number(second.discount_price || second.price || 0)
    );
  }
  if (sortOption === "price_desc") {
    return nextProducts.sort(
      (first, second) =>
        Number(second.discount_price || second.price || 0) -
        Number(first.discount_price || first.price || 0)
    );
  }
  return nextProducts.sort(
    (first, second) =>
      new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
  );
}

/**
 * Renders the interactive accessories catalog with compact filters.
 *
 * @param {{ initialProducts: object[], categories: object[] }} props
 * @returns {import("react").JSX.Element}
 */
export default function AccessoriesClient({ initialProducts, categories = [] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortOption, setSortOption] = useState(DEFAULT_SORT_OPTION);
  const [isExpanded, setIsExpanded] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const products = Array.isArray(initialProducts) ? initialProducts : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const brands = useMemo(() => {
    const allBrands = products.map((product) => product.brand).filter(Boolean);
    return [...new Set(allBrands)].sort((first, second) => first.localeCompare(second, "ar"));
  }, [products]);

  const availableCategories = useMemo(() => {
    const usedCategoryIds = [...new Set(products.map((product) => product.category_id).filter(Boolean))];
    return safeCategories
      .filter((category) => usedCategoryIds.includes(category.id))
      .sort((first, second) => String(first.name || "").localeCompare(String(second.name || ""), "ar"));
  }, [products, safeCategories]);

  const filteredProducts = useMemo(() => {
    const matchingProducts = products.filter((product) => {
      if (selectedBrand && product.brand !== selectedBrand) return false;
      if (selectedCategory && product.category_id !== selectedCategory) return false;
      return matchesAccessorySearch({ product, query: normalizeAccessoryText(deferredSearchQuery) });
    });
    return sortAccessoryProducts({ products: matchingProducts, sortOption });
  }, [deferredSearchQuery, products, selectedBrand, selectedCategory, sortOption]);

  const hasActiveFilters = Boolean(searchQuery.trim() || selectedBrand || selectedCategory || sortOption !== DEFAULT_SORT_OPTION);

  /**
   * Resets all filter state to defaults.
   */
  function clearFilters() {
    setSearchQuery("");
    setSelectedBrand("");
    setSelectedCategory("");
    setSortOption(DEFAULT_SORT_OPTION);
  }

  if (products.length === 0) {
    return (
      <StatusPanel
        icon="headphones"
        eyebrow="لا توجد إكسسوارات حاليًا"
        title="لم يتم إضافة أي إكسسوارات بعد"
        description="نقوم بتحديث متجرنا باستمرار. يرجى العودة لاحقًا لاستكشاف أحدث الإكسسوارات."
      />
    );
  }

  return (
    <>
      <ScrollReveal variant="fade-up">
        <div className={styles.filterShell}>
          {/* Row 1: Search + count + toggle */}
          <div className={styles.compactTopRow}>
            <div className={`techfix-search ${styles.searchField}`}>
              <AppIcon name="search" size={16} />
              <input
                type="text"
                className="form-input"
                inputMode="search"
                placeholder="ابحث بالاسم أو الماركة..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery ? (
                <button type="button" className={styles.searchClear} onClick={() => setSearchQuery("")}>
                  <AppIcon name="x" size={12} />
                </button>
              ) : null}
            </div>

            <span className={styles.compactCount}>
              <AppIcon name="headphones" size={13} />
              {filteredProducts.length}
            </span>

            <button
              type="button"
              className={`${styles.compactToggle}${isExpanded ? ` ${styles.compactToggleActive}` : ""}${hasActiveFilters ? ` ${styles.compactToggleHasFilters}` : ""}`}
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
            >
              <AppIcon name="sliders-horizontal" size={15} />
              <span>فلترة</span>
              {hasActiveFilters ? <span className={styles.compactFilterDot} /> : null}
            </button>
          </div>

          {/* Row 2: Collapsible filters */}
          <div className={`${styles.compactFiltersPanel}${isExpanded ? ` ${styles.compactFiltersPanelOpen}` : ""}`}>
            <div className={styles.compactFiltersGrid}>
              {brands.length > 0 ? (
                <label className={styles.inlineFilter}>
                  <span className={styles.inlineFilterLabel}>الماركة</span>
                  <select
                    className={`form-select ${styles.compactSelect}`}
                    value={selectedBrand}
                    onChange={(event) => setSelectedBrand(event.target.value)}
                  >
                    <option value="">الكل</option>
                    {brands.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {availableCategories.length > 0 ? (
                <label className={styles.inlineFilter}>
                  <span className={styles.inlineFilterLabel}>التصنيف</span>
                  <select
                    className={`form-select ${styles.compactSelect}`}
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                  >
                    <option value="">الكل</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className={styles.inlineFilter}>
                <span className={styles.inlineFilterLabel}>الترتيب</span>
                <select
                  className={`form-select ${styles.compactSelect}`}
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {hasActiveFilters ? (
              <div className={styles.compactActiveRow}>
                <button type="button" className={styles.compactClearBtn} onClick={clearFilters}>
                  <AppIcon name="refresh-cw" size={13} />
                  مسح الكل
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delayMs={120}>
        <div className={`surface-panel section-shell ${styles.resultsShell}`}>
          <div className={`section-shell-head ${styles.resultsHead}`}>
            <div className={`section-shell-copy ${styles.resultsCopy}`}>
              <h2>{ACCESSORY_SECTION_NAME}</h2>
              <p>تصفح الإكسسوارات والملحقات المتوفرة لمتجرنا بواجهة أوضح وأسرع.</p>
            </div>
            <span className="section-count-badge">
              <AppIcon name="shopping-bag" size={14} />
              {filteredProducts.length} إكسسوار
            </span>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="balanced-card-grid">
              {filteredProducts.map((product, index) => {
                const categoryName = safeCategories.find((category) => category.id === product.category_id)?.name || ACCESSORY_PUBLIC_LABEL;
                return (
                  <ProductCard
                    key={product.id}
                    revealIndex={index}
                    product={{
                      id: product.id,
                      name: product.name,
                      category: categoryName,
                      categoryId: null,
                      price: product.price,
                      discountPrice: product.discount_price,
                      quantity: product.quantity,
                      description: product.description,
                      badge: product.brand || null,
                      rating: product.rating,
                      reviewCount: product.review_count || product.reviews_count || product.sold || null,
                      images: product.images || [],
                      icon: product.icon || ACCESSORY_PUBLIC_LABEL,
                      link: `/products/${product.id}`,
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="techfix-empty">
              <div>
                <AppIcon name="search" size={48} />
              </div>
              <h3>لم يتم العثور على نتائج</h3>
              <p>لا توجد إكسسوارات تطابق معايير البحث أو الفلاتر المحددة.</p>
              <button type="button" className="btn btn-outline" onClick={clearFilters}>
                إعادة ضبط الفلاتر
              </button>
            </div>
          )}
        </div>
      </ScrollReveal>
    </>
  );
}
