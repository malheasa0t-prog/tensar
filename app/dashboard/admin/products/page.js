'use client';

import AdminProductCreateForm from '@/components/admin-products/AdminProductCreateForm';
import AdminProductsAlerts from '@/components/admin-products/AdminProductsAlerts';
import AdminProductsFilters from '@/components/admin-products/AdminProductsFilters';
import AdminProductsList from '@/components/admin-products/AdminProductsList';
import AdminProductsOverview from '@/components/admin-products/AdminProductsOverview';
import {
  pageGridStyle,
  panelStyle,
  sectionGridStyle,
} from '@/components/admin-products/adminProductsStyles';
import { useAdminProductsManager } from '@/hooks/useAdminProductsManager';

/**
 * Composes the admin products dashboard using extracted UI, state, and service layers.
 *
 * @returns {JSX.Element}
 */
export default function AdminProductsPage() {
  const {
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
    products,
    mainCategories,
    subcategories,
    formSubcategories,
    filterSubcategories,
    filteredProducts,
    lowStockCount,
    hasMainCategories,
    hasSubcategories,
    updateCreateForm,
    updateDraft,
    handleCreate,
    handleSave,
    handleSearchChange,
    handleMainFilterChange,
    handleSubFilterChange,
  } = useAdminProductsManager();

  return (
    <div style={pageGridStyle}>
      <AdminProductsOverview
        productCount={products.length}
        mainCategoryCount={mainCategories.length}
        subcategoryCount={subcategories.length}
        lowStockCount={lowStockCount}
      />

      <AdminProductsAlerts
        error={error}
        hasMainCategories={hasMainCategories}
        hasSubcategories={hasSubcategories}
      />

      <AdminProductCreateForm
        form={form}
        mainCategories={mainCategories}
        formSubcategories={formSubcategories}
        creating={creating}
        hasMainCategories={hasMainCategories}
        hasSubcategories={hasSubcategories}
        onFieldChange={updateCreateForm}
        onSubmit={handleCreate}
      />

      <div style={panelStyle}>
        <div style={sectionGridStyle}>
          <AdminProductsFilters
            search={search}
            mainFilter={mainFilter}
            subFilter={subFilter}
            filteredCount={filteredProducts.length}
            mainCategories={mainCategories}
            filterSubcategories={filterSubcategories}
            subcategories={subcategories}
            categories={categories}
            onSearchChange={handleSearchChange}
            onMainFilterChange={handleMainFilterChange}
            onSubFilterChange={handleSubFilterChange}
          />

          <AdminProductsList
            loading={loading}
            products={filteredProducts}
            drafts={drafts}
            mainCategories={mainCategories}
            categories={categories}
            savingId={savingId}
            onDraftChange={updateDraft}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
