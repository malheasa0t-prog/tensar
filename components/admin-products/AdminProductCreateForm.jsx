import {
  fieldGroupStyle,
  fieldStyle,
  formGridStyle,
  labelStyle,
  panelStyle,
  sectionGridStyle,
} from '@/components/admin-products/adminProductsStyles';

/**
 * Renders the product creation form within the category tree workflow.
 *
 * @param {{
 *   form: Record<string, string>,
 *   mainCategories: Array<Record<string, unknown>>,
 *   formSubcategories: Array<Record<string, unknown>>,
 *   creating: boolean,
 *   hasMainCategories: boolean,
 *   hasSubcategories: boolean,
 *   onFieldChange: (field: string, value: string) => void,
 *   onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 * }} props
 * @returns {JSX.Element}
 */
export default function AdminProductCreateForm({
  form,
  mainCategories,
  formSubcategories,
  creating,
  hasMainCategories,
  hasSubcategories,
  onFieldChange,
  onSubmit,
}) {
  return (
    <div style={panelStyle}>
      <div style={sectionGridStyle}>
        <div>
          <h3 style={{ margin: 0, marginBottom: '6px' }}>إضافة منتج ضمن الشجرة</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            ابدأ باختيار الفئة الرئيسية، ثم الفئة الفرعية التابعة لها، وبعدها أدخل بيانات المنتج بشكل مباشر.
          </p>
        </div>

        <form onSubmit={onSubmit} style={sectionGridStyle}>
          <div style={formGridStyle}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>الفئة الرئيسية *</label>
              <select
                value={form.main_category_id}
                onChange={(event) => onFieldChange('main_category_id', event.target.value)}
                required
                style={fieldStyle}
                disabled={creating || !hasMainCategories}
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
              <label style={labelStyle}>الفئة الفرعية *</label>
              <select
                value={form.category_id}
                onChange={(event) => onFieldChange('category_id', event.target.value)}
                required
                style={fieldStyle}
                disabled={creating || !form.main_category_id || formSubcategories.length === 0}
              >
                <option value="">اختر الفئة الفرعية</option>
                {formSubcategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>اسم المنتج *</label>
              <input
                value={form.name}
                onChange={(event) => onFieldChange('name', event.target.value)}
                placeholder="مثال: ماوس ألعاب RGB"
                required
                style={fieldStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>العلامة التجارية</label>
              <input
                value={form.brand}
                onChange={(event) => onFieldChange('brand', event.target.value)}
                placeholder="Logitech / Redragon / HP ..."
                style={fieldStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>السعر *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => onFieldChange('price', event.target.value)}
                placeholder="0.00"
                required
                style={fieldStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>سعر الخصم</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount_price}
                onChange={(event) => onFieldChange('discount_price', event.target.value)}
                placeholder="اختياري"
                style={fieldStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>الكمية *</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={(event) => onFieldChange('quantity', event.target.value)}
                placeholder="0"
                required
                style={fieldStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>حد التنبيه</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.low_stock_alert}
                onChange={(event) => onFieldChange('low_stock_alert', event.target.value)}
                placeholder="5"
                style={fieldStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>الحالة</label>
              <select
                value={form.status}
                onChange={(event) => onFieldChange('status', event.target.value)}
                style={fieldStyle}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>وصف مختصر</label>
            <textarea
              value={form.description}
              onChange={(event) => onFieldChange('description', event.target.value)}
              placeholder="وصف سريع يوضح ماهية المنتج وفائدته الأساسية."
              rows={3}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: '96px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={creating || !hasMainCategories || !hasSubcategories}
              className={creating ? 'btn btn-primary is-loading' : 'btn btn-primary'}
            >
              {creating ? 'جاري إضافة المنتج...' : 'إضافة المنتج مباشرة'}
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              سيتم حفظ المنتج داخل الفئة الفرعية المحددة فقط.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
