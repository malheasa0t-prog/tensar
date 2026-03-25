'use client';

import { useEffect, useState } from 'react';
import { loadCategoryPageSnapshot } from '@/services/categoryPageService';

/**
 * Loads and stores the client-side category page snapshot.
 *
 * @param {string} routeValue
 * @returns {{
 *   loading: boolean,
 *   error: boolean,
 *   category: Record<string, unknown> | null,
 *   mainCategory: Record<string, unknown> | null,
 *   subCategories: Array<Record<string, unknown>>,
 *   products: Array<Record<string, unknown>>,
 *   subCategoryProductsCount: Record<string, number>,
 * }}
 */
export function useCategoryPage(routeValue) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState(null);
  const [mainCategory, setMainCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [subCategoryProductsCount, setSubCategoryProductsCount] = useState({});

  useEffect(() => {
    if (!routeValue) {
      setLoading(false);
      setError(true);
      return;
    }

    let active = true;

    /**
     * Refreshes the full category tree and product snapshot.
     *
     * @returns {Promise<void>}
     */
    async function hydrateCategoryPage() {
      setLoading(true);
      setError(false);

      const snapshot = await loadCategoryPageSnapshot(routeValue);
      if (!active) {
        return;
      }

      setCategory(snapshot.category);
      setMainCategory(snapshot.mainCategory);
      setSubCategories(snapshot.subCategories);
      setProducts(snapshot.products);
      setSubCategoryProductsCount(snapshot.subCategoryProductsCount);
      setError(snapshot.error);
      setLoading(false);
    }

    hydrateCategoryPage();

    return () => {
      active = false;
    };
  }, [routeValue]);

  return {
    loading,
    error,
    category,
    mainCategory,
    subCategories,
    products,
    subCategoryProductsCount,
  };
}
