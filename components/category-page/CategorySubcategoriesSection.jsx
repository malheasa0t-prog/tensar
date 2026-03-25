import Link from 'next/link';
import AppIcon from '@/components/AppIcon';
import { getCategoryHref } from '@/lib/categoryPageModel';

/**
 * Lists subcategories for a main category.
 *
 * @param {{
 *   subCategories: Array<Record<string, unknown>>,
 *   subCategoryProductsCount: Record<string, number>,
 * }} props
 * @returns {JSX.Element | null}
 */
export default function CategorySubcategoriesSection({
  subCategories,
  subCategoryProductsCount,
}) {
  if (!subCategories.length) {
    return null;
  }

  return (
    <div className="surface-panel section-shell">
      <div className="section-shell-head">
        <div className="section-shell-copy">
          <h2>الأقسام الفرعية</h2>
          <p>اختر القسم الفرعي المناسب لتصفح المنتجات الخاصة به داخل صفحة أوضح وأكثر تركيزًا.</p>
        </div>

        <span className="section-count-badge">
          <AppIcon name="folder" size={14} />
          {subCategories.length} فئة
        </span>
      </div>

      <div className="balanced-card-grid">
        {subCategories.map((subCategory) => (
          <Link
            key={subCategory.id}
            href={getCategoryHref(subCategory)}
            className="surface-card category-section-card"
            style={{ display: 'grid', gap: '0.9rem', textAlign: 'center' }}
          >
            <div
              className="detail-media-placeholder"
              style={{ width: '78px', height: '78px', borderRadius: '24px', marginInline: 'auto' }}
            >
              {subCategory.image ? (
                <img
                  src={subCategory.image}
                  alt={subCategory.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '24px' }}
                />
              ) : (
                <AppIcon name={subCategory.icon || subCategory.name || 'folder'} size={28} />
              )}
            </div>

            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{subCategory.name}</h3>
              <p style={{ fontSize: '0.88rem' }}>
                {subCategory.description ||
                  'ادخل إلى هذا القسم لاستعراض المنتجات الخاصة به داخل بطاقات واضحة ومباشرة.'}
              </p>
            </div>

            <span className="section-count-badge" style={{ justifySelf: 'center' }}>
              <AppIcon name="boxes" size={14} />
              {subCategoryProductsCount[subCategory.id] || 0} منتج
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
