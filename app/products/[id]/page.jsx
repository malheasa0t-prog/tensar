/**
 * Product details page rendered on the client.
 */

'use client';

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Image from 'next/image';
import AppIcon from '@/components/AppIcon';
import InternalPageHero from '@/components/InternalPageHero';
import ProductDetailsSkeleton from '@/components/ProductDetailsSkeleton';
import ProductPurchaseActions from '@/components/ProductPurchaseActions';
import { formatCurrency } from '@/lib/formatCurrency';
import { usePageSeo } from '@/hooks/usePageSeo';
import { isOptimizableImageSrc } from '@/lib/imageUtils';
import { buildProductStructuredData } from '@/lib/seo';
import { loadProductDetailSnapshot } from '@/services/productDetailService';

/**
 * Builds the breadcrumb items for the detail page.
 *
 * @param {{
 *   category: Record<string, unknown> | null,
 *   categoryId: string,
 *   isAccessoryProduct: boolean,
 *   name: string,
 * }} input
 * @returns {Array<{ href?: string, label: string }>}
 */
function buildBreadcrumbItems({ category, categoryId, name }) {
  return [
    { href: '/', label: 'الرئيسية' },
    { href: '/products', label: 'المنتجات' },
    category?.name
      ? { href: `/category/${category.slug || categoryId}`, label: category.name }
      : null,
    { label: name },
  ].filter(Boolean);
}

/**
 * Builds JSON-LD for the current detail page.
 *
 * @param {{
 *   categoryLabel: string,
 *   id: string,
 *   product: Record<string, unknown>,
 * }} input
 * @returns {Array<Record<string, unknown>>}
 */
function buildDetailStructuredData({ categoryLabel, id, product }) {
  return [
    buildProductStructuredData({
      pathname: `/products/${id}`,
      categoryName: categoryLabel,
      product,
    }),
  ];
}

/**
 * Renders the product details page.
 *
 * @returns {JSX.Element | null}
 */
export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  const categoryLabel = category?.name || 'منتج تقني';
  const image = product && Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '';

  usePageSeo(product ? {
    title: product.name,
    description:
      product.description ||
      `اطلع على سعر ${product.name} ومواصفاته وحالة التوفر وخطوات الشراء لدى TechZone.`,
    image,
    type: 'product',
    canonicalPath: `/products/${id}`,
    breadcrumbItems: buildBreadcrumbItems({
      category,
      categoryId: product.category_id,
      name: product.name,
    }),
    breadcrumbLabel: product.name,
    structuredData: buildDetailStructuredData({
      categoryLabel,
      id,
      product,
    }),
  } : null);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const snapshot = await loadProductDetailSnapshot({ id });

        if (cancelled) return;

        if (!snapshot.product) {
          navigate('/not-found', { replace: true });
          return;
        }

        setProduct(snapshot.product);
        setCategory(snapshot.category);
      } catch (error) {
        console.error('[PPG-500] ProductDetailPage: failed to load', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (loading) {
    return <ProductDetailsSkeleton />;
  }

  if (!product) {
    return null;
  }

  const finalPrice = Number(product.discount_price || product.price || 0);
  const originalPrice = Number(product.price || 0);
  const hasDiscount = Number(product.discount_price || 0) > 0 && finalPrice < originalPrice;
  const stockLabel = Number(product.quantity || 0) > 0 ? 'متوفر' : 'حسب الطلب';
  const specs = Array.isArray(product.specs) ? product.specs.filter(Boolean) : [];
  const brandLabel = product.brand || 'بدون علامة محددة';
  const breadcrumbItems = buildBreadcrumbItems({
    category,
    categoryId: product.category_id,
    name: product.name,
  });

  return (
    <>
      <InternalPageHero
        currentPath={`/products/${id}`}
        items={breadcrumbItems}
        badgeIcon="shopping-bag"
        badgeLabel="تفاصيل المنتج"
        title={product.name}
        description={
          product.description ||
          'واجهة تفاصيل أوضح تعرض المواصفات وحالة التوفر ومسار الشراء دون فراغات أو كتل معزولة.'
        }
        stats={[
          { label: 'السعر الحالي', value: formatCurrency(finalPrice), tone: 'success' },
          { label: 'التوفر', value: stockLabel },
          { label: 'الفئة', value: categoryLabel, tone: 'accent' },
        ]}
      />

      <section className="section" style={{ paddingTop: 0, paddingBottom: '4rem' }}>
        <div className="container detail-layout">
          <div className="detail-stack">
            <div className="surface-card detail-media-card">
              <div className="detail-media-frame">
                {image ? (
                  <Image
                    src={image}
                    alt={product.name}
                    width={1080}
                    height={1080}
                    loading="lazy"
                    quality={80}
                    sizes="(max-width: 900px) 100vw, 540px"
                    unoptimized={!isOptimizableImageSrc(image)}
                  />
                ) : (
                  <div className="detail-media-placeholder">
                    <AppIcon name={categoryLabel || product.name || 'package'} size={46} />
                  </div>
                )}
              </div>
            </div>

            <div className="detail-subgrid">
              <div className="detail-subcard">
                <strong>العلامة التجارية</strong>
                <span>{brandLabel}</span>
              </div>
              <div className="detail-subcard">
                <strong>الحالة</strong>
                <span>{stockLabel}</span>
              </div>
              <div className="detail-subcard">
                <strong>نوع السعر</strong>
                <span>{hasDiscount ? 'عرض مخفّض' : 'سعر ثابت'}</span>
              </div>
            </div>
          </div>

          <div className="detail-stack">
            <div className="surface-card detail-content-card">
              <div className="detail-kicker">{categoryLabel}</div>

              <div className="detail-price-row">
                <div className="detail-price">{formatCurrency(finalPrice)}</div>
                {hasDiscount ? (
                  <span className="detail-price-old">{formatCurrency(originalPrice)}</span>
                ) : null}
              </div>

              <p>
                {product.description ||
                  'وصف موجز للمنتج مع إبراز أهم المعلومات التي تساعد المستخدم على اتخاذ القرار بسرعة أكبر.'}
              </p>

              <div className="detail-meta-grid">
                <div className="detail-meta-card">
                  <strong>الكمية المتاحة</strong>
                  <span>{Number(product.quantity || 0)}</span>
                </div>
                <div className="detail-meta-card">
                  <strong>الفئة</strong>
                  <span>{categoryLabel}</span>
                </div>
                <div className="detail-meta-card">
                  <strong>العلامة</strong>
                  <span>{brandLabel}</span>
                </div>
                <div className="detail-meta-card">
                  <strong>التحديث</strong>
                  <span>{hasDiscount ? 'سعر محدّث مع خصم' : 'متاح الآن للطلب'}</span>
                </div>
              </div>

              {specs.length > 0 ? (
                <div className="detail-specs">
                  {specs.map((spec, index) => (
                    <div key={`${spec.key || 'spec'}-${index}`} className="detail-spec-row">
                      <strong>{spec.key || 'المواصفة'}</strong>
                      <span>{spec.value || '-'}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <ProductPurchaseActions product={{ ...product, categoryName: categoryLabel }} />
            </div>

            <div className="detail-side-card">
              <h2>لماذا هذا المنتج؟</h2>
              <div className="detail-note-list">
                <div className="detail-note-item">
                  <span className="detail-note-icon">
                    <AppIcon name="sparkles" size={18} />
                  </span>
                  <div>
                    <strong>بطاقة أكثر اكتمالًا</strong>
                    <span>
                      الصفحة تعرض الآن المعلومات الأساسية والمواصفات والإجراء الرئيسي دون أن تبدو
                      كمساحة فارغة.
                    </span>
                  </div>
                </div>
                <div className="detail-note-item">
                  <span className="detail-note-icon">
                    <AppIcon name="message-circle" size={18} />
                  </span>
                  <div>
                    <strong>قرار أسرع للمستخدم</strong>
                    <span>
                      السعر والتوفر والفئة أصبحت في نقاط واضحة تسهّل التقييم بدل البحث داخل الصفحة.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
