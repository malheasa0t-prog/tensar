'use client';

import "../../techfix-pages.css";
import "@/app/techfix-neon.css";
import "@/app/techfix-neon-effects.css";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import PageSectionBreadcrumbs from '@/components/PageSectionBreadcrumbs';
import CategoryEmptyState from '@/components/category-page/CategoryEmptyState';
import CategoryServicesSection from '@/components/category-page/CategoryServicesSection';
import CategorySubcategoriesSection from '@/components/category-page/CategorySubcategoriesSection';
import StatusPanel from '@/components/StatusPanel';
import { usePageSeo } from '@/hooks/usePageSeo';
import { useCategoryPage } from '@/hooks/useCategoryPage';

/**
 * Service category explorer page with optional nested subcategories.
 *
 * @returns {JSX.Element} Category page.
 */
export default function CategoryPage() {
  const params = useParams();
  const rawRouteValue = params?.id;
  const routeValue = Array.isArray(rawRouteValue) ? rawRouteValue[0] : rawRouteValue;
  const {
    loading,
    error,
    category,
    mainCategory,
    subCategories,
    repairServices,
    subCategoryServiceCounts,
  } = useCategoryPage(routeValue);

  const hasSubCategories = !loading && !error && category && subCategories.length > 0;

  usePageSeo(category ? {
    title: category.name,
    description:
      category.description ||
      `تصفح فئة ${category.name} واكتشف خدمات الصيانة والفئات الفرعية المتاحة لدى TechZone.`,
    image: category.image || '',
    canonicalPath: `/category/${category.slug || category.id || routeValue}`,
    breadcrumbLabel: category.name,
  } : null);

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
            description="[CPG-301] قد يكون الرابط غير صحيح أو أن هذه الفئة لم تعد منشورة حالياً."
            actions={
              <>
                <Link href="/" className="btn btn-primary">
                  العودة للرئيسية
                </Link>
                <Link href="/services" className="btn btn-outline">
                  تصفح الخدمات
                </Link>
              </>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="section page-top" style={{ paddingBottom: '4rem' }}>
      <div className="container" style={{ display: 'grid', gap: '1.5rem' }}>
        <div className="section-topbar">
          <PageSectionBreadcrumbs currentLabel={category.name} />
        </div>

        {hasSubCategories ? (
          <CategorySubcategoriesSection
            subCategories={subCategories}
            subCategoryServiceCounts={subCategoryServiceCounts}
          />
        ) : null}

        <CategoryServicesSection
          services={repairServices}
          categoryName={category.name}
          hasSubCategories={hasSubCategories}
        />

        {repairServices.length === 0 && !hasSubCategories ? (
          <CategoryEmptyState mainCategory={mainCategory} category={category} />
        ) : null}
      </div>
    </section>
  );
}
