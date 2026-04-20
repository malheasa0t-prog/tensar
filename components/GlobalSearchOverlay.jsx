"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppIcon from "./AppIcon";
import Button from "./Button";
import FriendlyEmptyState from "./FriendlyEmptyState";
import styles from "./GlobalSearchOverlay.module.css";
import {
  GLOBAL_SEARCH_DEFAULT_CATEGORY,
  filterGlobalSearchItems,
  getGlobalSearchTypeLabel,
} from "@/lib/globalSearchModel";
import {
  fetchGlobalSearchSnapshot,
  resetGlobalSearchSnapshotCache,
} from "@/services/globalSearchService";

const INITIAL_SNAPSHOT = {
  items: [],
  popularSuggestions: [],
  quickFilters: [],
  sourceErrors: [],
};

/**
 * Builds the small secondary text shown under each search result title.
 *
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function getResultSummary(item) {
  return String(item?.description || item?.subtitle || "افتح العنصر لعرض التفاصيل الكاملة.").trim();
}

/**
 * Renders the full-screen global search overlay from the public header.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 * @returns {import("react").JSX.Element | null}
 */
export default function GlobalSearchOverlay({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(GLOBAL_SEARCH_DEFAULT_CATEGORY);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);
  const deferredQuery = useDeferredValue(searchQuery.trim());

  const results = useMemo(
    () =>
      filterGlobalSearchItems({
        items: snapshot.items,
        query: deferredQuery,
        categoryFilter: selectedCategory,
      }),
    [deferredQuery, selectedCategory, snapshot.items]
  );

  /**
   * Loads the search snapshot and optionally forces a fresh refetch.
   *
   * @param {{ forceRefresh?: boolean }} [options]
   * @returns {Promise<void>}
   */
  async function loadSnapshot(options = {}) {
    setLoading(true);
    setErrorMessage("");

    if (options.forceRefresh) {
      resetGlobalSearchSnapshotCache();
    }

    try {
      const nextSnapshot = await fetchGlobalSearchSnapshot();
      setSnapshot(nextSnapshot);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "تعذر تحميل البحث حاليًا.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedCategory(GLOBAL_SEARCH_DEFAULT_CATEGORY);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => inputRef.current?.focus());

    if (!snapshot.items.length && !loading) {
      void loadSnapshot();
    }

    /**
     * Closes the overlay when the escape key is pressed.
     *
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, onClose, snapshot.items.length]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="global-search-title" onClick={onClose}>
      <div className={styles.panel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>بحث عام</span>
            <h2 id="global-search-title">ابحث في المنتجات والخدمات والفئات</h2>
            <p>نتائج فورية أثناء الكتابة مع فلاتر سريعة واقتراحات شائعة لبدء أسرع.</p>
          </div>

          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="إغلاق البحث">
            <AppIcon name="x" size={18} />
          </button>
        </div>

        <div className={styles.searchBar}>
          <span className={styles.searchIcon}>
            <AppIcon name="search" size={20} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={styles.searchInput}
            placeholder="ابحث عن منتج، خدمة، أو فئة..."
            aria-label="البحث العام"
          />

          {searchQuery ? (
            <button type="button" className={styles.utilityButton} onClick={() => setSearchQuery("")}>
              مسح
            </button>
          ) : null}

          <span className={styles.shortcutHint}>Esc</span>
        </div>

        <div className={styles.filterRow}>
          <button
            type="button"
            className={selectedCategory === GLOBAL_SEARCH_DEFAULT_CATEGORY ? styles.filterChipActive : styles.filterChip}
            onClick={() => setSelectedCategory(GLOBAL_SEARCH_DEFAULT_CATEGORY)}
          >
            الكل
          </button>

          {snapshot.quickFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={selectedCategory === filter.value ? styles.filterChipActive : styles.filterChip}
              onClick={() => setSelectedCategory(filter.value)}
            >
              {filter.label}
              <span>{filter.count}</span>
            </button>
          ))}
        </div>

        {!deferredQuery && snapshot.popularSuggestions.length > 0 ? (
          <div className={styles.suggestions}>
            <span className={styles.suggestionsLabel}>اقتراحات شائعة</span>
            <div className={styles.suggestionsList}>
              {snapshot.popularSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={styles.suggestionChip}
                  onClick={() => setSearchQuery(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.resultsMeta}>
          <strong>{deferredQuery ? `نتائج فورية لـ "${deferredQuery}"` : "ابدأ بالكتابة أو اختر اقتراحًا"}</strong>
          <span>{loading ? "جارٍ تحميل الفهرس..." : `${results.length} نتائج جاهزة الآن`}</span>
        </div>

        {errorMessage ? (
          <div className={styles.feedbackCard}>
            <div>
              <strong>تعذر تحميل البحث</strong>
              <p>{errorMessage}</p>
            </div>
            <button type="button" className={styles.retryButton} onClick={() => void loadSnapshot({ forceRefresh: true })}>
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {!errorMessage && loading && snapshot.items.length === 0 ? (
          <div className={styles.loadingGrid}>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className={styles.loadingCard} />
            ))}
          </div>
        ) : null}

        {!errorMessage && !loading && results.length === 0 ? (
          <FriendlyEmptyState
            compact
            tone="search"
            icon="search"
            eyebrow={deferredQuery ? "لا توجد نتائج مطابقة" : "لا توجد عناصر قابلة للعرض الآن"}
            title={
              deferredQuery
                ? `لم نعثر على نتائج مطابقة لعبارة "${deferredQuery}"`
                : "الفهرس فارغ حاليًا"
            }
            description={
              deferredQuery
                ? "جرّب عبارة أقصر أو أزل الفلتر السريع الحالي للوصول إلى نتائج أوسع."
                : "سيظهر هنا أي منتج أو خدمة أو فئة بمجرد توفرها في فهرس البحث العام."
            }
            actions={
              <>
                {deferredQuery ? (
                  <Button type="button" variant="secondary" onClick={() => setSearchQuery("")}>
                    مسح البحث
                  </Button>
                ) : null}
                {selectedCategory !== GLOBAL_SEARCH_DEFAULT_CATEGORY ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedCategory(GLOBAL_SEARCH_DEFAULT_CATEGORY)}
                  >
                    إزالة الفلتر
                  </Button>
                ) : null}
              </>
            }
          />
        ) : null}

        {!errorMessage && results.length > 0 ? (
          <div className={styles.resultsList}>
            {results.map((item) => (
              <Link key={item.id} href={item.href} className={styles.resultCard} onClick={onClose}>
                <span className={styles.resultIcon}>
                  <AppIcon name={item.iconName || "search"} size={20} />
                </span>

                <div className={styles.resultBody}>
                  <div className={styles.resultHead}>
                    <strong>{item.title}</strong>
                    <span className={styles.typeBadge}>{getGlobalSearchTypeLabel(item.type)}</span>
                  </div>

                  <p>{getResultSummary(item)}</p>

                  <div className={styles.resultMetaRow}>
                    <span>{item.subtitle}</span>
                    <span>{item.metaLabel}</span>
                  </div>
                </div>

                <span className={styles.resultArrow}>
                  <AppIcon name="chevron-left" size={18} />
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
