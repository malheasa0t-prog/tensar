'use client';

import Image from 'next/image';
import Link from 'next/link';
import AppIcon from '@/components/AppIcon';
import ScrollReveal from '@/components/ScrollReveal';
import { useCart } from '@/components/CartProvider';
import { useToast } from '@/components/ToastProvider';
import { formatCurrency } from '@/lib/formatCurrency';
import { isOptimizableImageSrc } from '@/lib/imageUtils';
import { getStaggeredRevealDelay } from '@/lib/scrollRevealModel';
import styles from './CategoryServicesSection.module.css';

/**
 * Returns a safe image value for a repair service card.
 *
 * @param {Record<string, unknown>} service - Repair service row.
 * @returns {string} Renderable image source.
 */
function getServiceImage(service) {
  return typeof service.image === 'string' ? service.image.trim() : '';
}

/**
 * Returns the booking URL with the selected service pre-filled.
 *
 * @param {Record<string, unknown>} service - Repair service row.
 * @returns {string} Booking form URL.
 */
function getBookingHref(service) {
  return `/services?service=${encodeURIComponent(service.id || service.slug || '')}#repair-booking-form`;
}

/**
 * Returns the public details URL for a repair service.
 *
 * @param {Record<string, unknown>} service - Repair service row.
 * @returns {string} Service details URL.
 */
function getDetailsHref(service) {
  if (service.sourceType === 'catalog-service') {
    return `/category/${service.categorySlug || service.category_id || ''}`;
  }

  return `/services/${service.slug || service.id || ''}`;
}

/**
 * Builds a cart-safe payload for a catalog service.
 *
 * @param {Record<string, unknown>} service - Catalog service row.
 * @returns {Record<string, unknown>} Cart item payload.
 */
function buildCatalogServiceCartItem(service) {
  return {
    id: service.id,
    name: service.name,
    originalPrice: Number(service.price || 0),
    price: Number(service.price || 0),
    category: service.categoryLabel || service.category || 'خدمة',
    description: service.description || '',
    icon: service.icon || 'wrench',
    images: service.image ? [service.image] : [],
    quantity: Number(service.max_qty || 9999),
    status: service.status || 'active',
    product_type: 'digital',
    provider_fields: service.metadata?.provider_fields || [],
    link_required: Boolean(service.metadata?.link_required),
  };
}

/**
 * Lists visible repair services that belong to the current category tree.
 *
 * @param {{
 *   services: Array<Record<string, unknown>>,
 *   categoryName: string,
 *   hasSubCategories: boolean,
 * }} props - Section props.
 * @returns {JSX.Element | null} Services section.
 */
export default function CategoryServicesSection({ services, categoryName, hasSubCategories }) {
  const { addToCart, openSidebar } = useCart();
  const { showToast } = useToast();

  if (!services.length) {
    return null;
  }

  /**
   * Adds a catalog service to the cart.
   *
   * @param {Record<string, unknown>} service - Catalog service row.
   * @returns {void}
   */
  function handleAddCatalogService(service) {
    const result = addToCart(buildCatalogServiceCartItem(service));

    if (!result?.ok) {
      showToast(result?.message || '[CRT-301] تعذر إضافة الخدمة حالياً.', { type: 'error' });
      return;
    }

    openSidebar();
    showToast('تمت إضافة الخدمة إلى السلة.', { type: 'success' });
  }

  return (
    <ScrollReveal variant="fade-up">
      <div className="surface-panel section-shell">
        <div className="section-shell-head">
          <div className="section-shell-copy">
            <h2>{hasSubCategories ? 'خدمات مرتبطة بالفئات الفرعية' : `خدمات ${categoryName}`}</h2>
            <p>
              اختر الخدمة المناسبة مباشرة من الفئة الحالية، وكل بطاقة توضّح إن كانت الخدمة تابعة
              لفئة فرعية حتى يكون الحجز أسرع وأوضح.
            </p>
          </div>

          <span className="section-count-badge">
            <AppIcon name="wrench" size={14} />
            {services.length} خدمة
          </span>
        </div>

        <div className={styles.grid}>
          {services.map((service, index) => {
            const image = getServiceImage(service);
            const detailsHref = getDetailsHref(service);

            return (
              <ScrollReveal
                key={service.id}
                variant="slide-in-right"
                delayMs={getStaggeredRevealDelay(index, 75)}
              >
                <article className={`surface-card ${styles.card}`}>
                  <Link href={detailsHref} className={styles.mediaLink} aria-label={service.name}>
                    <div className={styles.mediaFrame}>
                      {image ? (
                        <Image
                          src={image}
                          alt={service.name || 'خدمة صيانة'}
                          fill
                          loading="lazy"
                          quality={82}
                          sizes="(max-width: 700px) min(100vw - 3rem, 360px), 320px"
                          unoptimized={!isOptimizableImageSrc(image)}
                          className={styles.mediaImage}
                        />
                      ) : (
                        <div className={styles.iconFallback}>
                          <AppIcon name={service.icon || 'wrench'} size={48} />
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className={styles.copy}>
                    <div className={styles.badges}>
                      <span className={styles.categoryBadge}>
                        <AppIcon name="folder" size={13} />
                        {service.categoryLabel || service.category || categoryName}
                      </span>
                      {service.isSubCategoryService ? (
                        <span className={styles.subBadge}>خدمة فرعية من فئة فرعية</span>
                      ) : null}
                    </div>

                    <h3 className={styles.title}>
                      <Link href={detailsHref}>{service.name}</Link>
                    </h3>

                    <p className={styles.description}>
                      {service.description || 'خدمة صيانة متاحة للحجز من TechZone.'}
                    </p>

                    <div className={styles.metaRow}>
                      <span>
                        <AppIcon name="wallet" size={15} />
                        {formatCurrency(service.price)}
                      </span>
                      {service.duration ? (
                        <span>
                          <AppIcon name="clock" size={15} />
                          {service.duration}
                        </span>
                      ) : null}
                    </div>

                    <div className={styles.actions}>
                      {service.sourceType === 'catalog-service' ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleAddCatalogService(service)}
                        >
                          أضف للسلة
                        </button>
                      ) : (
                        <Link href={getBookingHref(service)} className="btn btn-primary">
                          احجز الخدمة
                        </Link>
                      )}
                      <Link href={detailsHref} className="btn btn-outline">
                        التفاصيل
                      </Link>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </ScrollReveal>
  );
}
