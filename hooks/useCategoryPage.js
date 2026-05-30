'use client';

import { useEffect, useState } from 'react';
import { loadCategoryPageSnapshot, subscribeToCategoryPage } from '@/services/categoryPageService';

/**
 * Loads and stores the client-side category services snapshot.
 *
 * @param {string} routeValue
 * @returns {{
 *   loading: boolean,
 *   error: boolean,
 *   category: Record<string, unknown> | null,
 *   mainCategory: Record<string, unknown> | null,
 *   subCategories: Array<Record<string, unknown>>,
 *   repairServices: Array<Record<string, unknown>>,
 *   subCategoryServiceCounts: Record<string, number>,
 * }}
 */
export function useCategoryPage(routeValue) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState(null);
  const [mainCategory, setMainCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [repairServices, setRepairServices] = useState([]);
  const [subCategoryServiceCounts, setSubCategoryServiceCounts] = useState({});

  useEffect(() => {
    if (!routeValue) {
      setLoading(false);
      setError(true);
      return;
    }

    let active = true;

    /**
     * Refreshes the full category tree and service snapshot.
     *
     * @returns {Promise<void>}
     */
    async function hydrateCategoryPage(silent = false) {
      if (!silent) {
        setLoading(true);
        setError(false);
      }

      const snapshot = await loadCategoryPageSnapshot(routeValue);
      if (!active) {
        return;
      }

      setCategory(snapshot.category);
      setMainCategory(snapshot.mainCategory);
      setSubCategories(snapshot.subCategories);
      setRepairServices(snapshot.repairServices);
      setSubCategoryServiceCounts(snapshot.subCategoryServiceCounts);
      setError(snapshot.error);
      setLoading(false);
    }

    hydrateCategoryPage();
    const unsubscribe = subscribeToCategoryPage(() => {
      hydrateCategoryPage(true);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [routeValue]);

  return {
    loading,
    error,
    category,
    mainCategory,
    subCategories,
    repairServices,
    subCategoryServiceCounts,
  };
}
