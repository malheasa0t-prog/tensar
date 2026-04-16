/**
 * Product Details Page — Client-side version.
 *
 * Fetches a single product by ID from the URL params,
 * loads category info, then renders the product details view.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Image from 'next/image';
import ProductPurchaseActions from '@/components/ProductPurchaseActions';
import ProductDetailsSkeleton from '@/components/ProductDetailsSkeleton';
import AppIcon from '@/components/AppIcon';
import InternalPageHero from '@/components/InternalPageHero';
import { formatCurrency } from '@/lib/formatCurrency';
import { supabase } from '@/lib/supabaseClient';
import {
  ACCESSORY_PRODUCTS_SECTION_HREF,
  ACCESSORY_SECTION_NAME,
  isAccessoryProductCategoryId,
} from '@/lib/accessoryCatalog';
import { isOptimizableImageSrc } from '@/lib/imageUtils';

/**
 * Attempts to find a product or digital service by id.
 *
 * @param {string} id
 * @returns {Promise<{ data: Record<string, unknown> | null, isService: boolean }>}
 */
async function findItem(id) {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (product) return { data: product, isService: false };

  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  return { data: service || null, isService: true };
}

/**
 * Renders the product/service details page.
 *
 * @returns {JSX.Element}
 */
export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [category, setCategory] = useState(null);
  const [isService, setIsService] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const result = await findItem(id);

        if (cancelled) return;

        if (!result.data) {
          navigate('/not-found', { replace: true });
          return;
        }

        let item = result.data;

        if (result.isService) {
          item = {
            ...item,
            images: item.image ? [item.image] : [],
            quantity: item.max_qty || 999,
            discount_price: null,
            brand: null,
            specs: [],
            variants: [],
            product_type: 'digital',
          };
        }

        setProduct(item);
        setIsService(result.isService);

        const isAccessory = isAccessoryProductCategoryId(item.category_id);
        if (!isAccessory && item.category_id) {
          const { data: catData } = await supabase
            .from('categories')
            .select('name,slug')
            .eq('id', item.category_id)
            .maybeSingle();

          if (!cancelled) setCategory(catData || null);
        }
      } catch (error) {
        console.error('ProductDetailPage: failed to load', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProduct();
    return () => { cancelled = true; };
  }, [id, navigate]);

  if (loading) {
    return <ProductDetailsSkeleton />;
  }

  if (!product) return null;

  const isAccessoryProduct = isAccessoryProductCategoryId(product.category_id);
  const finalPrice = Number(product.discount_price || product.price || 0);
  const originalPrice = Number(product.price || 0);
  const hasDiscount = Number(product.discount_price || 0) > 0 && finalPrice < originalPrice;
  const image = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '';
  const stockLabel = isService
    ? 'خدمة رقمية فورية'
    : Number(product.quantity || 0) > 0
      ? 'متوفر'
      : 'حسب الطلب';
  const specs = Array.isArray(product.specs) ? product.specs.filter(Boolean) : [];
  const brandLabel = product.brand || 'بدون علامة محددة';
  const categoryLabel = isAccessoryProduct
    ? ACCESSORY_SECTION_NAME
    : category?.name || 'منتج تقني';

  return (
    <>
      <InternalPageHero
        currentPath={`/products/${id}`}
        items={[
          { href: '/', label: 'الرئيسية' },
          { href: '/products', label: 'المنتجات' },
          isAccessoryProduct
            ? { href: ACCESSORY_PRODUCTS_SECTION_HREF, label: ACCESSORY_SECTION_NAME }
            : category?.name
              ? { href: `/category/${category.slug || product.category_id}`, label: category.name }
              : null,
          { label: product.name },
        ].filter(Boolean)}
        badgeIcon="shopping-bag"
        badgeLabel="تفاصيل المنتج"
        title={product.name}
        description={
          product.description ||
          'واجهة تفاصيل أوضح تعرض المواصفات، حالة التوفر، ومسار الشراء بدون فراغات أو كتل معزولة.'
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
                    fill
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
                {hasDiscount ? <span className="detail-price-old">{formatCurrency(originalPrice)}</span> : null}
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
                    <span>الصفحة تعرض الآن المعلومات الأساسية، المواصفات، والإجراء الرئيسي بدون أن تبدو كمساحة فارغة.</span>
                  </div>
                </div>
                <div className="detail-note-item">
                  <span className="detail-note-icon">
                    <AppIcon name="message-circle" size={18} />
                  </span>
                  <div>
                    <strong>قرار أسرع للمستخدم</strong>
                    <span>السعر، التوفر، والفئة أصبحت في نقاط واضحة تسهّل التقييم بدل البحث داخل الصفحة.</span>
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
