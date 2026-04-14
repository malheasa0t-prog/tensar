import Image from "next/image";
import { notFound } from "next/navigation";
import ProductPurchaseActions from "@/components/ProductPurchaseActions";
import AppIcon from "@/components/AppIcon";
import InternalPageHero from "@/components/InternalPageHero";
import { formatCurrency } from "@/lib/formatCurrency";
import { supabase } from "@/lib/supabaseClient";
import {
  ACCESSORY_PRODUCTS_SECTION_HREF,
  ACCESSORY_SECTION_NAME,
  isAccessoryProductCategoryId,
} from "@/lib/accessoryCatalog";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { buildProductStructuredData } from "@/lib/seo";
import { getPageMetadata } from "@/lib/siteMetadata";

export const revalidate = 60;

/**
 * Attempts to find a product or digital service by id.
 *
 * @param {string} id
 * @param {string} selectClause
 * @returns {Promise<{ data: Record<string, unknown> | null, isService: boolean }>}
 */
async function findItem(id, selectClause = '*') {
  const { data: product } = await supabase
    .from('products')
    .select(selectClause)
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (product) return { data: product, isService: false };

  const { data: service } = await supabase
    .from('services')
    .select(selectClause)
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  return { data: service || null, isService: true };
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { data: item } = await findItem(id, 'id,name,description,images,image');

  if (!item) {
    return getPageMetadata({
      title: "منتج غير موجود",
      description: "المنتج المطلوب غير متاح حاليًا.",
      pathname: `/products/${id}`,
    });
  }

  return getPageMetadata({
    title: item.name,
    description: item.description || "تفاصيل المنتج والسعر والتوفر.",
    pathname: `/products/${id}`,
    images: item.images || (item.image ? [item.image] : []),
  });
}

export default async function ProductDetailsPage({ params }) {
  const { id } = await params;
  const { data: item, isService } = await findItem(id);

  if (!item) {
    notFound();
  }

  const product = isService ? {
    ...item,
    images: item.image ? [item.image] : [],
    quantity: item.max_qty || 999,
    discount_price: null,
    brand: null,
    specs: [],
    variants: [],
    product_type: 'digital',
  } : item;

  const isAccessoryProduct = isAccessoryProductCategoryId(product.category_id);
  let category = null;

  if (!isAccessoryProduct) {
    const { data } = await supabase
      .from("categories")
      .select("name,slug")
      .eq("id", product.category_id)
      .maybeSingle();

    category = data || null;
  }

  const finalPrice = Number(product.discount_price || product.price || 0);
  const originalPrice = Number(product.price || 0);
  const hasDiscount = Number(product.discount_price || 0) > 0 && finalPrice < originalPrice;
  const image = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : "";
  const stockLabel = isService ? "خدمة رقمية فورية" : (Number(product.quantity || 0) > 0 ? "متوفر" : "حسب الطلب");
  const specs = Array.isArray(product.specs) ? product.specs.filter(Boolean) : [];
  const brandLabel = product.brand || "بدون علامة محددة";
  const categoryLabel = isAccessoryProduct ? ACCESSORY_SECTION_NAME : category?.name || "منتج تقني";
  const structuredData = buildProductStructuredData({
    pathname: `/products/${id}`,
    categoryName: categoryLabel,
    product,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <InternalPageHero
        currentPath={`/products/${id}`}
        items={[
          { href: "/", label: "الرئيسية" },
          { href: "/products", label: "المنتجات" },
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
          "واجهة تفاصيل أوضح تعرض المواصفات، حالة التوفر، ومسار الشراء بدون فراغات أو كتل معزولة."
        }
        stats={[
          { label: "السعر الحالي", value: formatCurrency(finalPrice), tone: "success" },
          { label: "التوفر", value: stockLabel },
          { label: "الفئة", value: categoryLabel, tone: "accent" },
        ]}
        summary={
          <div className="hero-summary-card">
            <div className="hero-summary-list">
              <div className="hero-summary-item">
                <span className="hero-summary-icon">
                  <AppIcon name="shield-check" size={18} />
                </span>
                <div>
                  <strong>معلومات أسرع وأوضح</strong>
                  <span>تظهر الحالة والسعر والمواصفات الأساسية بشكل واضح بدل الاعتماد على كتلة واحدة ثقيلة.</span>
                </div>
              </div>

              <div className="hero-summary-item">
                <span className="hero-summary-icon">
                  <AppIcon name="truck" size={18} />
                </span>
                <div>
                  <strong>مسار شراء مباشر</strong>
                  <span>الوصول إلى الإجراء الأساسي أصبح أوضح مع إبقاء الرجوع للقسم والشراء ضمن نفس السياق.</span>
                </div>
              </div>
            </div>
          </div>
        }
      />

      <section className="section" style={{ paddingTop: 0, paddingBottom: "4rem" }}>
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
                    <AppIcon name={categoryLabel || product.name || "package"} size={46} />
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
                <span>{hasDiscount ? "عرض مخفّض" : "سعر ثابت"}</span>
              </div>
            </div>
          </div>

          <div className="detail-stack">
            <div className="surface-card detail-content-card">
              <div className="detail-kicker">{categoryLabel}</div>

              <div className="detail-price-row">
                <div className="detail-price">
                  {formatCurrency(finalPrice)}
                </div>
                {hasDiscount ? <span className="detail-price-old">{formatCurrency(originalPrice)}</span> : null}
              </div>

              <p>
                {product.description ||
                  "وصف موجز للمنتج مع إبراز أهم المعلومات التي تساعد المستخدم على اتخاذ القرار بسرعة أكبر."}
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
                  <span>{hasDiscount ? "سعر محدّث مع خصم" : "متاح الآن للطلب"}</span>
                </div>
              </div>

              {specs.length > 0 ? (
                <div className="detail-specs">
                  {specs.map((spec, index) => (
                    <div key={`${spec.key || "spec"}-${index}`} className="detail-spec-row">
                      <strong>{spec.key || "المواصفة"}</strong>
                      <span>{spec.value || "-"}</span>
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
