/**
 * Products Explorer Page — Client-side version.
 *
 * Fetches products and categories on mount, then renders
 * the products explorer with search, filters, and sorting.
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import '@/app/techfix-pages.css';
import PageSectionBreadcrumbs from '@/components/PageSectionBreadcrumbs';
import ProductsExplorerClient from '@/components/ProductsExplorerClient';
import StatusPanel from '@/components/StatusPanel';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import Link from 'next/link';
import { isAccessoryCatalogCategoryId, isAccessoryProduct } from '@/lib/accessoryCatalog';
import { mapProductsExplorerProduct } from '@/lib/productsExplorerModel';
import { supabase } from '@/lib/supabaseClient';

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
        const [productsResult, categoriesResult] = await Promise.all([
          supabase.from('products').select('*').in('status', ['active', 'out_of_stock']),
          supabase.from('categories').select('id, name').eq('status', 'active'),
        ]);

        if (cancelled) return;

        if (productsResult.error || categoriesResult.error) {
          setError(true);
          return;
        }

        const filteredCategories = (categoriesResult.data || [])
          .filter((cat) => !isAccessoryCatalogCategoryId(cat.id));
        const categoryById = Object.fromEntries(
          filteredCategories.map((cat) => [cat.id, cat.name])
        );
        const filteredProducts = (productsResult.data || [])
          .filter((product) => !isAccessoryProduct(product))
          .map((product) =>
            mapProductsExplorerProduct(product, categoryById[product.category_id] || 'منتجات عامة')
          );

        setCategories(filteredCategories);
        setProducts(filteredProducts);
      } catch (err) {
        console.error('ProductsPage: failed to load', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
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
            description="حدث خلل أثناء جلب المنتجات أو الفئات. أعد المحاولة بعد قليل أو انتقل إلى صفحة التواصل."
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
