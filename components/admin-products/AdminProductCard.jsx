import {
  fieldGroupStyle,
  fieldStyle,
  formGridStyle,
  labelStyle,
  productCardStyle,
} from '@/components/admin-products/adminProductsStyles';
import {
  formatAdminProductMoney,
  getAdminSubcategories,
} from '@/lib/adminProductsModel';

/**
 * Renders a single editable product card for inline admin updates.
 *
 * @param {{
 *   product: Record<string, unknown>,
 *   draft: Record<string, string>,
 *   mainCategories: Array<Record<string, unknown>>,
 *   categories: Array<Record<string, unknown>>,
 *   isSaving: boolean,
 *   onDraftChange: (id: string, field: string, value: string) => void,
 *   onSave: (id: string) => Promise<void>,
 * }} props
 * @returns {JSX.Element}
 */
export default function AdminProductCard({
  product,
  draft,
  mainCategories,
  categories,
  isSaving,
  onDraftChange,
  onSave,
}) {
  const draftSubcategories = getAdminSubcategories(categories, draft.main_category_id);
  const lowStock =
    Number(product.quantity || 0) <= Number(product.low_stock_alert || 0);

  return (
    <article style={productCardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: '4px' }}>
          <strong>{product.name}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {product.main_category_name || 'بدون'} / {product.subcategory_name || 'بدون'}{' '}
            {product.brand ? `• ${product.brand}` : ''} • {product.id}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
            {formatAdminProductMoney(product.discount_price || product.price)}
          </span>
          <span style={{ color: lowStock ? '#c0392b' : 'var(--text-muted)', fontWeight: 700 }}>
            المخزون: {product.quantity}
          </span>
        </div>
      </div>

      <div style={formGridStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>الفئة الرئيسية</label>
          <select
            value={draft.main_category_id}
            onChange={(event) => onDraftChange(product.id, 'main_category_id', event.target.value)}
            style={fieldStyle}
          >
            <option value="">اختر الفئة الرئيسية</option>
            {mainCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>الفئة الفرعية</label>
          <select
            value={draft.category_id}
            onChange={(event) => onDraftChange(product.id, 'category_id', event.target.value)}
            style={fieldStyle}
            disabled={!draft.main_category_id || draftSubcategories.length === 0}
          >
            <option value="">اختر الفئة الفرعية</option>
            {draftSubcategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>اسم المنتج</label>
          <input
            value={draft.name}
            onChange={(event) => onDraftChange(product.id, 'name', event.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>العلامة التجارية</label>
          <input
            value={draft.brand}
            onChange={(event) => onDraftChange(product.id, 'brand', event.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>السعر</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.price}
            onChange={(event) => onDraftChange(product.id, 'price', event.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>سعر الخصم</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.discount_price}
            onChange={(event) => onDraftChange(product.id, 'discount_price', event.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>الكمية</label>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.quantity}
            onChange={(event) => onDraftChange(product.id, 'quantity', event.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>حد التنبيه</label>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.low_stock_alert}
            onChange={(event) => onDraftChange(product.id, 'low_stock_alert', event.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>الحالة</label>
          <select
            value={draft.status}
            onChange={(event) => onDraftChange(product.id, 'status', event.target.value)}
            style={fieldStyle}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>الوصف</label>
        <textarea
          value={draft.description}
          onChange={(event) => onDraftChange(product.id, 'description', event.target.value)}
          rows={3}
          style={{ ...fieldStyle, resize: 'vertical', minHeight: '88px' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
          آخر تحديث:{' '}
          {product.updated_at
            ? new Date(product.updated_at).toLocaleString('ar-JO')
            : 'غير متاح'}
        </div>

        <button
          onClick={() => onSave(product.id)}
          disabled={isSaving}
          className={isSaving ? 'btn btn-primary btn-sm is-loading' : 'btn btn-primary btn-sm'}
        >
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </article>
  );
}
