import AdminProductCard from '@/components/admin-products/AdminProductCard';
import {
  emptyBoxStyle,
  loadingBoxStyle,
} from '@/components/admin-products/adminProductsStyles';
import { buildAdminProductDraft } from '@/lib/adminProductsModel';

/**
 * Renders the loading, empty, and editable list states for admin products.
 *
 * @param {{
 *   loading: boolean,
 *   products: Array<Record<string, unknown>>,
 *   drafts: Record<string, Record<string, string>>,
 *   mainCategories: Array<Record<string, unknown>>,
 *   categories: Array<Record<string, unknown>>,
 *   savingId: string,
 *   onDraftChange: (id: string, field: string, value: string) => void,
 *   onSave: (id: string) => Promise<void>,
 * }} props
 * @returns {JSX.Element}
 */
export default function AdminProductsList({
  loading,
  products,
  drafts,
  mainCategories,
  categories,
  savingId,
  onDraftChange,
  onSave,
}) {
  if (loading) {
    return <div style={loadingBoxStyle}>جاري تحميل المنتجات...</div>;
  }

  if (products.length === 0) {
    return <div style={emptyBoxStyle}>لا توجد منتجات مطابقة للفلترة الحالية.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {products.map((product) => (
        <AdminProductCard
          key={product.id}
          product={product}
          draft={drafts[product.id] || buildAdminProductDraft(product)}
          mainCategories={mainCategories}
          categories={categories}
          isSaving={savingId === product.id}
          onDraftChange={onDraftChange}
          onSave={onSave}
        />
      ))}
    </div>
  );
}
