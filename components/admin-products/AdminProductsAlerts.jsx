import {
  errorBoxStyle,
  warningBoxStyle,
} from '@/components/admin-products/adminProductsStyles';

/**
 * Renders validation and setup warnings around the products admin workflow.
 *
 * @param {{
 *   error: string,
 *   hasMainCategories: boolean,
 *   hasSubcategories: boolean,
 * }} props
 * @returns {JSX.Element}
 */
export default function AdminProductsAlerts({
  error,
  hasMainCategories,
  hasSubcategories,
}) {
  return (
    <>
      {error ? <div style={errorBoxStyle}>{error}</div> : null}

      {!hasMainCategories ? (
        <div style={warningBoxStyle}>
          لا يمكن إضافة منتجات الآن لأن النظام لا يحتوي على أي فئة رئيسية بعد.
        </div>
      ) : null}

      {hasMainCategories && !hasSubcategories ? (
        <div style={warningBoxStyle}>
          توجد فئات رئيسية، لكن لا توجد فئات فرعية بعد. أضف فئة فرعية أولًا حتى تصبح إضافة المنتجات ممكنة.
        </div>
      ) : null}
    </>
  );
}
