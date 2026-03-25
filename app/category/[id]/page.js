'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import CategoryEmptyState from '@/components/category-page/CategoryEmptyState';
import CategoryHeroSummary from '@/components/category-page/CategoryHeroSummary';
import CategoryProductsSection from '@/components/category-page/CategoryProductsSection';
import CategorySubcategoriesSection from '@/components/category-page/CategorySubcategoriesSection';
import InternalPageHero from '@/components/InternalPageHero';
import StatusPanel from '@/components/StatusPanel';
import { useCategoryPage } from '@/hooks/useCategoryPage';
import {
  buildCategoryHeroStats,
  getCategoryHeroDescription,
  getCategoryHref,
  getTotalNestedProducts,
} from '@/lib/categoryPageModel';

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
            description="قد يكون الرابط غير صحيح أو أن هذه الفئة لم تعد منشورة حاليًا."
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

  const isMainCategory = !category.parent_id;
  const hasSubCategories = isMainCategory && subCategories.length > 0;
  const totalNestedProducts = getTotalNestedProducts(subCategoryProductsCount);

  return (
    <>
      <InternalPageHero
        items={[
          { href: '/', label: 'الرئيسية' },
          { href: '/products', label: 'الفئات' },
          mainCategory && mainCategory.id !== category.id
            ? { href: getCategoryHref(mainCategory), label: mainCategory.name }
            : null,
          { label: category.name },
        ].filter(Boolean)}
        badgeIcon={hasSubCategories ? 'folder-open' : 'folder'}
        badgeLabel={hasSubCategories ? 'فئة رئيسية' : 'فئة منتجات'}
        title={category.name}
        description={getCategoryHeroDescription(category, hasSubCategories)}
        stats={buildCategoryHeroStats({
          hasSubCategories,
          subCategories,
          totalNestedProducts,
          products,
          mainCategory,
          category,
        })}
        summary={<CategoryHeroSummary hasSubCategories={hasSubCategories} />}
        actions={
          !hasSubCategories && !isMainCategory && mainCategory ? (
            <Link href={getCategoryHref(mainCategory)} className="btn btn-outline">
              العودة إلى {mainCategory.name}
            </Link>
          ) : null
        }
      />

      <section className="section" style={{ paddingTop: 0, paddingBottom: '4rem' }}>
        <div className="container" style={{ display: 'grid', gap: '1.5rem' }}>
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
    </>
  );
}
