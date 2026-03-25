import {
  hintCardStyle,
  hintCopyStyle,
  hintLabelStyle,
  infoGridStyle,
  panelStyle,
  sectionGridStyle,
} from '@/components/admin-products/adminProductsStyles';

/**
 * Displays the category hierarchy guidance and high-level inventory counts.
 *
 * @param {{
 *   productCount: number,
 *   mainCategoryCount: number,
 *   subcategoryCount: number,
 *   lowStockCount: number,
 * }} props
 * @returns {JSX.Element}
 */
export default function AdminProductsOverview({
  productCount,
  mainCategoryCount,
  subcategoryCount,
  lowStockCount,
}) {
  return (
    <div style={panelStyle}>
      <div style={sectionGridStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, marginBottom: '6px' }}>المنتجات المنظّمة بالفئات</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              هذا هو النظام الأول في الموقع: فئة رئيسية ثم فئة فرعية ثم المنتج داخل الفئة الفرعية. إذا أردت
              منتجات تظهر مباشرة في صفحة المنتجات العامة فاستخدم قسم منتجات اكسسوارات المنفصل.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            <span>
              المنتجات: <strong style={{ color: 'var(--text-color)' }}>{productCount}</strong>
            </span>
            <span>
              الفئات الرئيسية:{' '}
              <strong style={{ color: 'var(--text-color)' }}>{mainCategoryCount}</strong>
            </span>
            <span>
              الفئات الفرعية:{' '}
              <strong style={{ color: 'var(--text-color)' }}>{subcategoryCount}</strong>
            </span>
            <span>
              المخزون المنخفض: <strong style={{ color: '#c0392b' }}>{lowStockCount}</strong>
            </span>
          </div>
        </div>

        <div style={infoGridStyle}>
          <div style={hintCardStyle}>
            <div style={hintLabelStyle}>المسار المعتمد</div>
            <strong>فئة رئيسية ← فئة فرعية ← منتج</strong>
            <div style={hintCopyStyle}>
              لن يتم حفظ المنتج إلا داخل فئة فرعية تابعة لفئة رئيسية موجودة.
            </div>
          </div>
          <div style={hintCardStyle}>
            <div style={hintLabelStyle}>متى تستخدمه؟</div>
            <strong>عندما تريد شجرة واضحة: رئيسية ثم فرعية ثم منتج</strong>
            <div style={hintCopyStyle}>
              مناسب للمنتجات التي تحتاج تنظيمًا أدق داخل فئات وأقسام فرعية متعددة.
            </div>
          </div>
          <div style={hintCardStyle}>
            <div style={hintLabelStyle}>النظام الثاني</div>
            <strong>منتجات اكسسوارات المباشرة</strong>
            <div style={hintCopyStyle}>
              متاح الآن في قسم مستقل إذا كنت لا تريد إنشاء فئة فرعية لكل منتج.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
