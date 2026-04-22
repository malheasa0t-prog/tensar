/**
 * Accessories Page - Client-side version.
 *
 * Fetches accessory products and categories on mount.
 */

'use client';

import { useState, useEffect } from 'react';
import '../techfix-pages.css';
import Link from 'next/link';
import AccessoriesClient from '@/components/AccessoriesClient';
import StatusPanel from '@/components/StatusPanel';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import { supabase } from '@/lib/supabaseClient';
import { isAccessoryProduct } from '@/lib/accessoryCatalog';

/**
 * Renders the accessories explorer page.
 *
 * @returns {JSX.Element}
 */
export default function AccessoriesPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [productsResult, categoriesResult] = await Promise.all([
          supabase.from('products').select('*').eq('status', 'active'),
          supabase.from('categories').select('id, name').eq('status', 'active'),
        ]);

        if (cancelled) return;

        if (productsResult.error) {
          setError(true);
          return;
        }

        const accessoryProducts = (productsResult.data || [])
          .filter((product) => isAccessoryProduct(product))
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

        setProducts(accessoryProducts);
        setCategories(categoriesResult.data || []);
      } catch (err) {
        console.error('[APG-500] AccessoriesPage: failed to load', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <CatalogPageSkeleton productCount={6} />;

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل الإكسسوارات"
            title="لم نتمكن من عرض الإكسسوارات الآن"
            description="[APG-500] حصل خلل أثناء الجلب. أعد المحاولة بعد قليل أو تواصل معنا."
            actions={
              <>
                <Link href="/accessories" className="btn btn-primary">إعادة المحاولة</Link>
                <Link href="/contact" className="btn btn-outline">تواصل معنا</Link>
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
        <AccessoriesClient initialProducts={products} categories={categories} />
      </div>
    </section>
  );
}
