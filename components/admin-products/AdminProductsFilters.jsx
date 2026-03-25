import {
  fieldStyle,
  filterBarStyle,
} from '@/components/admin-products/adminProductsStyles';
import { getAdminSubcategoryFilterLabel } from '@/lib/adminProductsModel';

/**
 * Renders the search and category filters used before the editable products list.
 *
 * @param {{
 *   search: string,
 *   mainFilter: string,
 *   subFilter: string,
 *   filteredCount: number,
 *   mainCategories: Array<Record<string, unknown>>,
 *   filterSubcategories: Array<Record<string, unknown>>,
 *   subcategories: Array<Record<string, unknown>>,
 *   categories: Array<Record<string, unknown>>,
 *   onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   onMainFilterChange: (event: React.ChangeEvent<HTMLSelectElement>) => void,
 *   onSubFilterChange: (event: React.ChangeEvent<HTMLSelectElement>) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function AdminProductsFilters({
  search,
  mainFilter,
  subFilter,
  filteredCount,
  mainCategories,
  filterSubcategories,
  subcategories,
  categories,
  onSearchChange,
  onMainFilterChange,
  onSubFilterChange,
}) {
  const visibleSubcategories = mainFilter ? filterSubcategories : subcategories;

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ margin: 0, marginBottom: '6px' }}>قائمة منتجات المتجر</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            ابحث وفلتر حسب الفئة الرئيسية والفرعية، ثم عدّل بيانات المنتج مباشرة من نفس الصفحة.
          </p>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          العناصر الظاهرة الآن:{' '}
          <strong style={{ color: 'var(--text-color)' }}>{filteredCount}</strong>
        </div>
      </div>

      <div style={filterBarStyle}>
        <input
          type="search"
          value={search}
          onChange={onSearchChange}
          placeholder="ابحث باسم المنتج أو العلامة أو الفئة..."
          style={{ ...fieldStyle, minWidth: '240px', flex: '1 1 260px' }}
        />
        <select
          value={mainFilter}
          onChange={onMainFilterChange}
          style={{ ...fieldStyle, minWidth: '210px' }}
        >
          <option value="">كل الفئات الرئيسية</option>
          {mainCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={subFilter}
          onChange={onSubFilterChange}
          style={{ ...fieldStyle, minWidth: '210px' }}
          disabled={!!mainFilter && filterSubcategories.length === 0}
        >
          <option value="">كل الفئات الفرعية</option>
          {visibleSubcategories.map((category) => (
            <option key={category.id} value={category.id}>
              {getAdminSubcategoryFilterLabel(category, categories)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
