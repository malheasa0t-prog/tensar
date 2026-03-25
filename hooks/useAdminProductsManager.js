'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_ADMIN_PRODUCT_FORM,
  applyAdminProductFieldChange,
  buildAdminProductDraftMap,
  buildInitialAdminProductForm,
  countLowStockAdminProducts,
  filterAdminProducts,
  getAdminMainCategories,
  getAdminSubcategories,
} from '@/lib/adminProductsModel';
import {
  createAdminProduct,
  fetchAdminProductsData,
  updateAdminProduct,
} from '@/services/adminProductsService';

/**
 * Manages admin product loading, inline drafts, filtering, and persistence.
 *
 * @returns {{
 *   products: Array<Record<string, unknown>>,
 *   categories: Array<Record<string, unknown>>,
 *   loading: boolean,
 *   savingId: string,
 *   creating: boolean,
 *   error: string,
 *   search: string,
 *   mainFilter: string,
 *   subFilter: string,
 *   form: typeof EMPTY_ADMIN_PRODUCT_FORM,
 *   drafts: Record<string, typeof EMPTY_ADMIN_PRODUCT_FORM>,
 *   mainCategories: Array<Record<string, unknown>>,
 *   subcategories: Array<Record<string, unknown>>,
 *   formSubcategories: Array<Record<string, unknown>>,
 *   filterSubcategories: Array<Record<string, unknown>>,
 *   filteredProducts: Array<Record<string, unknown>>,
 *   lowStockCount: number,
 *   hasMainCategories: boolean,
 *   hasSubcategories: boolean,
 *   updateCreateForm: (field: string, value: string) => void,
 *   updateDraft: (id: string, field: string, value: string) => void,
 *   handleCreate: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   handleSave: (id: string) => Promise<void>,
 *   handleSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   handleMainFilterChange: (event: React.ChangeEvent<HTMLSelectElement>) => void,
 *   handleSubFilterChange: (event: React.ChangeEvent<HTMLSelectElement>) => void,
 * }}
 */
export function useAdminProductsManager() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [mainFilter, setMainFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [form, setForm] = useState(EMPTY_ADMIN_PRODUCT_FORM);
  const [drafts, setDrafts] = useState({});

  /**
   * Refreshes the products payload and rebuilds local drafts from the backend state.
   *
   * @returns {Promise<void>}
   */
  async function loadProducts() {
    setLoading(true);
    setError('');

    try {
      const payload = await fetchAdminProductsData();
      const nextCategories = payload.categories || [];
      const nextProducts = payload.products || [];

      setCategories(nextCategories);
      setProducts(nextProducts);
      setDrafts(buildAdminProductDraftMap(nextProducts));
      setForm(buildInitialAdminProductForm(nextCategories));
    } catch (err) {
      setError(err.message || 'تعذر تحميل المنتجات.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const mainCategories = useMemo(() => getAdminMainCategories(categories), [categories]);
  const subcategories = useMemo(() => getAdminSubcategories(categories), [categories]);
  const formSubcategories = useMemo(
    () => getAdminSubcategories(categories, form.main_category_id),
    [categories, form.main_category_id]
  );
  const filterSubcategories = useMemo(
    () => getAdminSubcategories(categories, mainFilter),
    [categories, mainFilter]
  );
  const filteredProducts = useMemo(
    () => filterAdminProducts(products, search, mainFilter, subFilter),
    [products, search, mainFilter, subFilter]
  );
  const lowStockCount = useMemo(() => countLowStockAdminProducts(products), [products]);

  /**
   * Updates the creation form while preserving category hierarchy consistency.
   *
   * @param {string} field
   * @param {string} value
   * @returns {void}
   */
  function updateCreateForm(field, value) {
    setForm((prev) => applyAdminProductFieldChange(prev, field, value, categories));
  }

  /**
   * Updates a single inline draft field for an existing product row.
   *
   * @param {string} id
   * @param {string} field
   * @param {string} value
   * @returns {void}
   */
  function updateDraft(id, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [id]: applyAdminProductFieldChange(prev[id] || EMPTY_ADMIN_PRODUCT_FORM, field, value, categories),
    }));
  }

  /**
   * Submits the create form and refreshes the page data after a successful insert.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setError('');

    try {
      await createAdminProduct(form);
      await loadProducts();
    } catch (err) {
      setError(err.message || 'تعذر إنشاء المنتج.');
    } finally {
      setCreating(false);
    }
  }

  /**
   * Saves an existing product draft and refreshes the backend snapshot afterward.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function handleSave(id) {
    const draft = drafts[id];

    if (!draft) {
      return;
    }

    setSavingId(id);
    setError('');

    try {
      await updateAdminProduct(id, draft);
      await loadProducts();
    } catch (err) {
      setError(err.message || 'تعذر حفظ التعديلات.');
    } finally {
      setSavingId('');
    }
  }

  /**
   * Syncs the free-text search input with the local filter state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * @returns {void}
   */
  function handleSearchChange(event) {
    setSearch(event.target.value);
  }

  /**
   * Applies the main category filter and resets the dependent subcategory filter.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   * @returns {void}
   */
  function handleMainFilterChange(event) {
    setMainFilter(event.target.value);
    setSubFilter('');
  }

  /**
   * Applies the subcategory filter selection.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   * @returns {void}
   */
  function handleSubFilterChange(event) {
    setSubFilter(event.target.value);
  }

  return {
    products,
    categories,
    loading,
    savingId,
    creating,
    error,
    search,
    mainFilter,
    subFilter,
    form,
    drafts,
    mainCategories,
    subcategories,
    formSubcategories,
    filterSubcategories,
    filteredProducts,
    lowStockCount,
    hasMainCategories: mainCategories.length > 0,
    hasSubcategories: subcategories.length > 0,
    updateCreateForm,
    updateDraft,
    handleCreate,
    handleSave,
    handleSearchChange,
    handleMainFilterChange,
    handleSubFilterChange,
  };
}
