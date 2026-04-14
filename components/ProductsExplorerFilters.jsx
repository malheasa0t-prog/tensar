"use client";

import { useState } from "react";
import AppIcon from "@/components/AppIcon";
import ScrollReveal from "@/components/ScrollReveal";
import styles from "./ProductsExplorerClient.module.css";
import {
  PRODUCT_AVAILABILITY_OPTIONS,
  PRODUCTS_SORT_OPTIONS,
} from "@/lib/productsExplorerModel";

/**
 * Renders a compact inline filter select.
 *
 * @param {{ children: import("react").ReactNode, icon: string, label: string }} props
 * @returns {import("react").JSX.Element}
 */
function InlineFilter({ children, icon, label }) {
  return (
    <label className={styles.inlineFilter}>
      <span className={styles.inlineFilterIcon}>
        <AppIcon name={icon} size={14} />
      </span>
      <span className={styles.inlineFilterLabel}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Renders a view toggle button.
 *
 * @param {{ icon: string, isActive: boolean, label: string, onClick: () => void }} props
 * @returns {import("react").JSX.Element}
 */
function ViewModeButton({ icon, isActive, label, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.viewModeButton}${isActive ? ` ${styles.viewModeButtonActive}` : ""}`}
      onClick={onClick}
      aria-pressed={isActive}
    >
      <AppIcon name={icon} size={14} />
      {label}
    </button>
  );
}

/**
 * Renders the compact products explorer toolbar with search and filters.
 *
 * @param {object} props - Filter properties
 * @returns {import("react").JSX.Element}
 */
export default function ProductsExplorerFilters(props) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ScrollReveal variant="fade-up">
      <div className={`${styles.filterShell} ${styles.filterShellCompact}`}>
        {/* Row 1: Search + count + toggle */}
        <div className={styles.compactTopRow}>
          <div className={`techfix-search ${styles.searchField}`}>
            <AppIcon name="search" size={16} />
            <input
              type="text"
              className="form-input"
              inputMode="search"
              placeholder="ابحث بالاسم أو الوصف أو العلامة التجارية..."
              value={props.searchQuery}
              onChange={(event) => props.onSearchQueryChange(event.target.value)}
            />
            {props.searchQuery ? (
              <button type="button" className={styles.searchClear} onClick={() => props.onSearchQueryChange("")}>
                <AppIcon name="x" size={12} />
              </button>
            ) : null}
          </div>

          <span className={styles.compactCount}>
            <AppIcon name="shopping-bag" size={13} />
            {props.filteredCount}
          </span>

          <button
            type="button"
            className={`${styles.compactToggle}${isExpanded ? ` ${styles.compactToggleActive}` : ""}${props.hasActiveFilters ? ` ${styles.compactToggleHasFilters}` : ""}`}
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <AppIcon name="sliders-horizontal" size={15} />
            <span>فلترة</span>
            {props.hasActiveFilters ? (
              <span className={styles.compactFilterDot} />
            ) : null}
          </button>


        </div>

        {/* Row 2: Collapsible filters */}
        <div className={`${styles.compactFiltersPanel}${isExpanded ? ` ${styles.compactFiltersPanelOpen}` : ""}`}>
          <div className={styles.compactFiltersGrid}>
            <InlineFilter label="الفئة" icon="folder">
              <select
                className={`form-select ${styles.compactSelect}`}
                value={props.selectedCategory}
                onChange={(event) => props.onCategoryChange(event.target.value)}
              >
                <option value="">الكل</option>
                {props.availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </InlineFilter>

            <InlineFilter label="النوع" icon="boxes">
              <select
                className={`form-select ${styles.compactSelect}`}
                value={props.selectedType}
                onChange={(event) => props.onTypeChange(event.target.value)}
              >
                <option value="">الكل</option>
                {props.typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </InlineFilter>

            <InlineFilter label="التوفر" icon="shield-check">
              <select
                className={`form-select ${styles.compactSelect}`}
                value={props.selectedAvailability}
                onChange={(event) => props.onAvailabilityChange(event.target.value)}
              >
                <option value="">الكل</option>
                {PRODUCT_AVAILABILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </InlineFilter>

            <InlineFilter label="الترتيب" icon="arrow-up-down">
              <select
                className={`form-select ${styles.compactSelect}`}
                value={props.sortOption}
                onChange={(event) => props.onSortOptionChange(event.target.value)}
              >
                {PRODUCTS_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </InlineFilter>

            <InlineFilter label="السعر من" icon="wallet">
              <input
                type="number"
                min="0"
                step="0.01"
                className={`form-input ${styles.compactInput}`}
                value={props.minimumPrice}
                onChange={(event) => props.onMinimumPriceChange(event.target.value)}
                placeholder="0"
              />
            </InlineFilter>

            <InlineFilter label="السعر إلى" icon="wallet">
              <input
                type="number"
                min="0"
                step="0.01"
                className={`form-input ${styles.compactInput}`}
                value={props.maximumPrice}
                onChange={(event) => props.onMaximumPriceChange(event.target.value)}
                placeholder="∞"
              />
            </InlineFilter>
          </div>

          {props.hasActiveFilters ? (
            <div className={styles.compactActiveRow}>
              <div className={styles.activeChipRow}>
                {props.activeFilterLabels.map((label) => (
                  <span key={label} className={styles.activeChip}>
                    {label}
                  </span>
                ))}
              </div>
              <button type="button" className={styles.compactClearBtn} onClick={props.onClearFilters}>
                <AppIcon name="refresh-cw" size={13} />
                مسح الكل
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </ScrollReveal>
  );
}
