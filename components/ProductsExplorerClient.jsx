"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import AppIcon from "@/components/AppIcon";
import ProductCard from "@/components/ProductCard";
import ProductsExplorerFilters from "@/components/ProductsExplorerFilters";
import ScrollReveal from "@/components/ScrollReveal";
import StatusPanel from "@/components/StatusPanel";
import styles from "./ProductsExplorerClient.module.css";
import {
  PRODUCTS_EXPLORER_DEFAULT_SORT,
  PRODUCTS_EXPLORER_DEFAULT_VIEW,
  PRODUCTS_SORT_OPTIONS,
  buildProductsExplorerActiveFilters,
  filterProductsExplorerProducts,
  getProductsExplorerAvailabilityLabel,
  getProductsExplorerType,
  getProductsExplorerTypeLabel,
  sortProductsExplorerProducts,
} from "@/lib/productsExplorerModel";

/**
 * Renders the interactive products explorer used by the public catalog page.
 *
 * @param {{
 *   categories?: Array<Record<string, unknown>>,
 *   initialProducts?: Array<Record<string, unknown>>,
 *   initialSearchQuery?: string,
 * }} props
 * @returns {import("react").JSX.Element}
 */
export default function ProductsExplorerClient({
  categories = [],
  initialProducts = [],
  initialSearchQuery = "",
}) {
  const [searchQuery, setSearchQuery] = useState(String(initialSearchQuery || ""));
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sortOption, setSortOption] = useState(PRODUCTS_EXPLORER_DEFAULT_SORT);
  const [viewMode, setViewMode] = useState(PRODUCTS_EXPLORER_DEFAULT_VIEW);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

  useEffect(() => {
    setSearchQuery(String(initialSearchQuery || ""));
  }, [initialSearchQuery]);

  const products = Array.isArray(initialProducts) ? initialProducts : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const availableCategories = useMemo(() => {
    const usedCategoryIds = new Set(products.map((product) => product.categoryId).filter(Boolean));

    return safeCategories
      .filter((category) => usedCategoryIds.has(category.id))
      .sort((first, second) => String(first.name || "").localeCompare(String(second.name || ""), "ar"));
  }, [products, safeCategories]);

  const typeOptions = useMemo(() => {
    const productTypes = [...new Set(products.map((product) => getProductsExplorerType(product)).filter(Boolean))];

    return productTypes
      .map((value) => ({ label: getProductsExplorerTypeLabel(value), value }))
      .sort((first, second) => first.label.localeCompare(second.label, "ar"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const matchingProducts = filterProductsExplorerProducts({
      products,
      searchQuery: deferredSearchQuery,
      categoryId: selectedCategory,
      productType: selectedType,
      availability: selectedAvailability,
      minPrice: minimumPrice,
      maxPrice: maximumPrice,
    });

    return sortProductsExplorerProducts({ products: matchingProducts, sortOption });
  }, [
    deferredSearchQuery,
    maximumPrice,
    minimumPrice,
    products,
    selectedAvailability,
    selectedCategory,
    selectedType,
    sortOption,
  ]);

  const selectedCategoryName =
    availableCategories.find((category) => category.id === selectedCategory)?.name || "";
  const selectedTypeLabel = selectedType ? getProductsExplorerTypeLabel(selectedType) : "";
  const selectedAvailabilityLabel = selectedAvailability
    ? getProductsExplorerAvailabilityLabel(selectedAvailability)
    : "";
  const selectedSortLabel =
    PRODUCTS_SORT_OPTIONS.find((option) => option.value === sortOption)?.label || PRODUCTS_SORT_OPTIONS[0].label;
  const activeFilterLabels = buildProductsExplorerActiveFilters({
    searchQuery: searchQuery.trim(),
    categoryName: selectedCategoryName,
    productTypeLabel: selectedTypeLabel,
    availabilityLabel: selectedAvailabilityLabel,
    minPrice: minimumPrice,
    maxPrice: maximumPrice,
    sortLabel: selectedSortLabel,
    sortOption,
  });

  function clearFilters() {
    startTransition(() => {
      setSearchQuery("");
      setSelectedCategory("");
      setSelectedType("");
      setSelectedAvailability("");
      setMinimumPrice("");
      setMaximumPrice("");
      setSortOption(PRODUCTS_EXPLORER_DEFAULT_SORT);
    });
  }

  if (products.length === 0) {
    return (
      <StatusPanel
        icon="shopping-bag"
        eyebrow="لا توجد منتجات حالياً"
        title="سيظهر الكتالوج هنا بمجرد إضافة المنتجات"
        description="أضف منتجات مفعلة داخل لوحة التحكم ليبدأ عرضها هنا مع إمكانيات البحث والفلترة."
      />
    );
  }

  return (
    <>
      <ProductsExplorerFilters
        activeFilterLabels={activeFilterLabels}
        availableCategories={availableCategories}
        filteredCount={filteredProducts.length}
        hasActiveFilters={activeFilterLabels.length > 0}
        maximumPrice={maximumPrice}
        minimumPrice={minimumPrice}
        onAvailabilityChange={setSelectedAvailability}
        onCategoryChange={setSelectedCategory}
        onClearFilters={clearFilters}
        onMaximumPriceChange={setMaximumPrice}
        onMinimumPriceChange={setMinimumPrice}
        onSearchQueryChange={setSearchQuery}
        onSortOptionChange={setSortOption}
        onTypeChange={setSelectedType}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        selectedAvailability={selectedAvailability}
        selectedCategory={selectedCategory}
        selectedType={selectedType}
        sortOption={sortOption}
        typeOptions={typeOptions}
        viewMode={viewMode}
      />

      <ScrollReveal variant="fade-up" delayMs={120}>
        <div className={`surface-panel section-shell ${styles.resultsShell}`}>
          <div className={`section-shell-head ${styles.resultsHead}`}>
            <div className={`section-shell-copy ${styles.resultsCopy}`}>
              <h2>نتائج المنتجات</h2>
              <p>اعرض المنتجات بالطريقة التي تناسبك ثم افتح الصفحة الكاملة لأي منتج تريد تفاصيله أو إضافته للسلة.</p>
            </div>
            <span className="section-count-badge">
              <AppIcon name="shopping-bag" size={14} />
              {filteredProducts.length} منتج
            </span>
          </div>

          {filteredProducts.length > 0 ? (
            <div className={styles.productsGrid}>
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} revealIndex={index} layout="grid" />
              ))}
            </div>
          ) : (
            <div className="techfix-empty">
              <div>
                <AppIcon name="search" size={48} />
              </div>
              <h3>لا توجد نتائج مطابقة</h3>
              <p>جرّب تغيير كلمات البحث أو توسيع حدود السعر أو إعادة ضبط الفلاتر الحالية.</p>
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
