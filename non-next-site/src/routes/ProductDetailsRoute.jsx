import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import AppIcon from "@/components/AppIcon";
import InternalPageHero from "@/components/InternalPageHero";
import ProductPurchaseActions from "@/components/ProductPurchaseActions";
import StatusPanel from "@/components/StatusPanel";
import { ACCESSORY_PRODUCTS_SECTION_HREF, ACCESSORY_SECTION_NAME } from "@/lib/accessoryCatalog";
import { useAsyncPageData } from "../hooks/useAsyncPageData.js";
import {
  formatCurrency,
  isOptimizableImageSrc,
  loadProductDetailsSnapshot
} from "../data/publicPageData.js";

/**
 * Builds the product hero breadcrumbs while preserving the original site structure.
 *
 * @param {Record<string, unknown>} snapshot
 * @param {string} productId
 * @returns {Array<Record<string, string>>}
 */
function buildProductBreadcrumbs(snapshot, productId) {
  const category = snapshot.category;
  const accessoryCrumb = snapshot.isAccessory
    ? { href: ACCESSORY_PRODUCTS_SECTION_HREF, label: ACCESSORY_SECTION_NAME }
    : null;
  const categoryCrumb =
    !snapshot.isAccessory && category?.name
      ? { href: `/category/${category.slug || productId}`, label: category.name }
      : null;

  return [
    { href: "/", label: "الرئيسية" },
    { href: "/products", label: "المنتجات" },
    accessoryCrumb || categoryCrumb,
    { label: snapshot.item.name }
  ].filter(Boolean);
}

/**
 * Renders the public product details page in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function ProductDetailsRoute() {
  const params = useParams();
  const productId = String(params.id || "").trim();
  const loader = useMemo(() => () => loadProductDetailsSnapshot(productId), [productId]);
  const { data, error } = useAsyncPageData(loader, [loader], null);

  if (error || !data?.item) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="shopping-bag"
            eyebrow="المنتج غير متاح"
            title="لم نتمكن من العثور على هذا المنتج"
            description="قد يكون الرابط غير صحيح أو أن هذا المنتج لم يعد منشورًا حاليًا."
            actions={
              <>
                <Link href="/products" className="btn btn-primary">
                  العودة إلى المنتجات
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

  const product = data.item;
  const specs = Array.isArray(product.specs) ? product.specs.filter(Boolean) : [];
  const image = data.primaryImage || "";
  const stockLabel = data.stockLabel || "متوفر";

  return (
    <>
      {data.structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data.structuredData) }}
        />
      ) : null}

      <InternalPageHero
        currentPath={`/products/${productId}`}
        items={buildProductBreadcrumbs(data, productId)}
        badgeIcon="shopping-bag"
        badgeLabel="تفاصيل المنتج"
        title={product.name}
        description={
          product.description ||
          "واجهة تفاصيل أوضح تعرض المواصفات، حالة التوفر، ومسار الشراء بدون فراغات أو كتل معزولة."
        }
        stats={[
          { label: "السعر الحالي", value: formatCurrency(data.finalPrice), tone: "success" },
          { label: "التوفر", value: stockLabel },
          { label: "الفئة", value: data.categoryLabel, tone: "accent" }
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
                    <AppIcon name={data.categoryLabel || product.name || "package"} size={46} />
                  </div>
                )}
              </div>
            </div>

            <div className="detail-subgrid">
              <div className="detail-subcard">
                <strong>العلامة التجارية</strong>
                <span>{data.brandLabel}</span>
              </div>
              <div className="detail-subcard">
                <strong>الحالة</strong>
                <span>{stockLabel}</span>
              </div>
              <div className="detail-subcard">
                <strong>نوع السعر</strong>
                <span>{data.hasDiscount ? "عرض مخفّض" : "سعر ثابت"}</span>
              </div>
            </div>
          </div>

          <div className="detail-stack">
            <div className="surface-card detail-content-card">
              <div className="detail-kicker">{data.categoryLabel}</div>

              <div className="detail-price-row">
                <div className="detail-price">{formatCurrency(data.finalPrice)}</div>
                {data.hasDiscount ? (
                  <span className="detail-price-old">{formatCurrency(data.originalPrice)}</span>
                ) : null}
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
                  <span>{data.categoryLabel}</span>
                </div>
                <div className="detail-meta-card">
                  <strong>العلامة</strong>
                  <span>{data.brandLabel}</span>
                </div>
                <div className="detail-meta-card">
                  <strong>التحديث</strong>
                  <span>{data.hasDiscount ? "سعر محدّث مع خصم" : "متاح الآن للطلب"}</span>
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

              <ProductPurchaseActions product={{ ...product, categoryName: data.categoryLabel }} />
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
