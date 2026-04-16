/**
 * Subscriptions Page — Client-side version.
 *
 * Fetches digital subscription products on mount.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import AppIcon from '@/components/AppIcon';
import InternalPageHero from '@/components/InternalPageHero';
import ScrollReveal from '@/components/ScrollReveal';
import StatusPanel from '@/components/StatusPanel';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import { selectSubscriptionProducts } from '@/lib/subscriptionsModel';
import { supabase } from '@/lib/supabaseClient';

/**
 * Renders the subscriptions page.
 *
 * @returns {JSX.Element}
 */
export default function SubscriptionsPage() {
  const [digitalProducts, setDigitalProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [{ data: productsData, error: pErr }, { data: categoriesData, error: cErr }] = await Promise.all([
          supabase.from('products').select('*').eq('status', 'active'),
          supabase.from('categories').select('*'),
        ]);

        if (cancelled) return;

        if (pErr || cErr) {
          setError(true);
          return;
        }

        const categories = categoriesData || [];
        const categoryMap = {};
        categories.forEach((c) => { categoryMap[c.id] = c.name; });

        const filtered = selectSubscriptionProducts({
          products: productsData || [],
          categories,
        }).map((product) => ({
          id: product.id,
          name: product.name,
          category: categoryMap[product.category_id] || 'أخرى',
          categoryId: product.category_id,
          price: product.price,
          discountPrice: product.discount_price,
          quantity: product.quantity,
          description: product.description,
          badge: product.sold > 50 ? 'الأكثر طلبًا' : null,
          rating: product.rating,
          reviewCount: product.review_count || product.reviews_count || product.sold || null,
          images: product.images || [],
          icon: 'wallet',
          link: `/products/${product.id}`,
        }));

        setDigitalProducts(filtered);
      } catch (err) {
        console.error('SubscriptionsPage: failed to load', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <CatalogPageSkeleton productCount={4} />;

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل المنتجات الرقمية"
            title="حدث خلل أثناء فتح صفحة الشحن والاشتراكات"
            description="تعذر جلب المنتجات الرقمية. جرّب التحديث أو انتقل إلى التواصل المباشر."
            actions={
              <>
                <Link href="/subscriptions" className="btn btn-primary">إعادة المحاولة</Link>
                <Link href="/contact" className="btn btn-outline">تواصل معنا</Link>
              </>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <InternalPageHero
        currentPath="/subscriptions"
        items={[{ href: '/', label: 'الرئيسية' }, { label: 'شحن واشتراكات' }]}
        badgeIcon="wallet"
        badgeLabel="خدمات رقمية"
        title={<>شحن <span className="gradient-text">واشتراكات</span></>}
        description="منتجات رقمية فورية داخل واجهة أكثر تنظيمًا، مع إبراز واضح للعناصر المتاحة."
        stats={[
          { label: 'منتج رقمي', value: digitalProducts.length, tone: 'success' },
          { label: 'نوع الخدمة', value: 'فوري' },
          { label: 'الدعم', value: 'مباشر', tone: 'accent' },
        ]}
      />

      <section className="section" style={{ paddingTop: 0, paddingBottom: '4rem' }}>
        <div className="container">
          {digitalProducts.length > 0 ? (
            <ScrollReveal variant="fade-up">
              <div className="surface-panel section-shell">
                <div className="section-shell-head">
                  <div className="section-shell-copy">
                    <h2>الخدمات الرقمية المتاحة الآن</h2>
                    <p>بطاقات موحدة مع إبراز السعر والوصف ومسار الوصول للتفاصيل.</p>
                  </div>
                  <span className="section-count-badge">
                    <AppIcon name="wallet" size={14} />
                    {digitalProducts.length} منتج
                  </span>
                </div>
                <div className="balanced-card-grid">
                  {digitalProducts.map((item, index) => (
                    <ProductCard key={item.id} product={item} revealIndex={index} />
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ) : (
            <StatusPanel
              icon="wallet"
              eyebrow="قيد التحديث"
              title="لا توجد منتجات رقمية متاحة حاليًا"
              description="سيتم عرض بطاقات الشحن والاشتراكات هنا فور إضافتها."
              actions={
                <>
                  <Link href="/products" className="btn btn-primary">تصفح المنتجات</Link>
                  <Link href="/contact" className="btn btn-outline">اطلب خدمة مخصصة</Link>
                </>
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
