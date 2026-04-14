'use client';

import "../../techfix-pages.css";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import PageSectionBreadcrumbs from '@/components/PageSectionBreadcrumbs';
import CategoryEmptyState from '@/components/category-page/CategoryEmptyState';
import CategoryProductsSection from '@/components/category-page/CategoryProductsSection';
import CategorySubcategoriesSection from '@/components/category-page/CategorySubcategoriesSection';
import StatusPanel from '@/components/StatusPanel';
import { useCategoryPage } from '@/hooks/useCategoryPage';

/**
 * Product category explorer page with optional nested subcategories.
 *
 * @returns {JSX.Element}
 */
export default function CategoryPage() {
  const params = useParams();
  const rawRouteValue = params?.id;
  const routeValue = Array.isArray(rawRouteValue) ? rawRouteValue[0] : rawRouteValue;
  const { loading, error, category, mainCategory, subCategories, products, subCategoryProductsCount } =
    useCategoryPage(routeValue);

  if (loading) {
    return <CatalogPageSkeleton showCategories categoryCount={4} productCount={6} />;
  }

  if (error || !category) {
    return (
      <section className="section page-top" style={{ paddingBottom: '4rem' }}>
        <div className="container">
          <StatusPanel
            tone="error"
            icon="folder-open"
            eyebrow="الفئة غير متاحة"
            title="لم نتمكن من العثور على هذه الفئة"
            description="قد يكون الرابط غير صحيح أو أن هذه الفئة لم تعد منشورة حالياً."
            actions={
              <>
                <Link href="/" className="btn btn-primary">
                  العودة للرئيسية
                </Link>
                <Link href="/products" className="btn btn-outline">
                  تصفح الفئات
                </Link>
              </>
            }
          />
        </div>
      </section>
    );
  }

  const hasSubCategories = !category.parent_id && subCategories.length > 0;

  return (
    <section className="section page-top" style={{ paddingBottom: '4rem' }}>
      <div className="container" style={{ display: 'grid', gap: '1.5rem' }}>
        <div className="section-topbar">
          <PageSectionBreadcrumbs currentLabel={category.name} />
        </div>

        {hasSubCategories ? (
          <CategorySubcategoriesSection
            subCategories={subCategories}
            subCategoryProductsCount={subCategoryProductsCount}
          />
        ) : null}

        <CategoryProductsSection
          products={products}
          categoryName={category.name}
          hasSubCategories={hasSubCategories}
        />

        {products.length === 0 && !hasSubCategories ? (
          <CategoryEmptyState mainCategory={mainCategory} category={category} />
        ) : null}
      </div>
    </section>
  );
}
