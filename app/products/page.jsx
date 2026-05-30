/**
 * Products Explorer Page - Client-side version.
 *
 * Fetches products and categories on mount, then renders
 * the products explorer with search, filters, and sorting.
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import '@/app/techfix-pages.css';
import '@/app/techfix-neon.css';
import '@/app/techfix-neon-effects.css';
import PageSectionBreadcrumbs from '@/components/PageSectionBreadcrumbs';
import ProductsExplorerClient from '@/components/ProductsExplorerClient';
import StatusPanel from '@/components/StatusPanel';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import Link from 'next/link';
import { loadProductsPageSnapshot, subscribeToProductsPage } from '@/services/productsPageService';

/**
 * Renders the products explorer page with filtering and search.
 *
 * @returns {JSX.Element}
 */
export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const initialSearchQuery = searchParams.get('search') || '';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const snapshot = await loadProductsPageSnapshot();

        if (cancelled) return;

        setCategories(snapshot.categories);
        setProducts(snapshot.products);
      } catch (err) {
        console.error('[PLS-500] ProductsPage: failed to load', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    const unsubscribe = subscribeToProductsPage(() => {
      loadData();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <CatalogPageSkeleton productCount={8} />;
  }

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل الكتالوج"
            title="لم نتمكن من عرض المنتجات الآن"
            description="[PLS-500] حدث خلل أثناء جلب المنتجات أو الفئات. أعد المحاولة بعد قليل أو انتقل إلى صفحة التواصل."
            actions={
              <>
                <Link href="/products" className="btn btn-primary">
                  إعادة المحاولة
                </Link>
                <Link href="/contact" className="btn btn-outline">
                  تواصل معنا
                </Link>
              </>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="section page-top">
      <div className="container">
        <div className="section-topbar" style={{ marginBottom: '1rem' }}>
          <PageSectionBreadcrumbs />
        </div>
        <ProductsExplorerClient
          initialProducts={products}
          categories={categories}
          initialSearchQuery={initialSearchQuery}
        />
      </div>
    </section>
  );
}
