import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppIcon from "@/components/AppIcon";
import ScrollReveal from "@/components/ScrollReveal";
import { useCart } from "@/components/CartProvider";
import { useToast } from "@/components/ToastProvider";
import { buildCatalogServiceCartItem } from "@/lib/catalogServiceCartModel";
import { buildCategoryPurchaseService } from "@/lib/categoryPurchaseModel";
import { getCategoryHref } from "@/lib/categoryPageModel";
import { formatCurrency } from "@/lib/formatCurrency";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { getStaggeredRevealDelay } from "@/lib/scrollRevealModel";
import styles from "./CategorySubcategoriesSection.module.css";

const SUBCATEGORY_IMAGE_WIDTH = 280;
const SUBCATEGORY_IMAGE_HEIGHT = 158;

/**
 * Returns a trusted image source for a category card.
 *
 * @param {Record<string, unknown>} subCategory - Category row from Supabase.
 * @returns {string} Renderable image source, or an empty string for icon fallback.
 */
function getRenderableSubCategoryImage(subCategory) {
  const image = typeof subCategory.image === "string" ? subCategory.image.trim() : "";

  return isOptimizableImageSrc(image) ? image : "";
}

/**
 * Builds the purchasable snapshot for one leaf subcategory when price metadata is available.
 *
 * @param {Record<string, unknown>} subCategory - Child category row.
 * @param {string} categoryName - Parent category label.
 * @param {Record<string, number>} subCategoryChildrenCount - Direct child counts.
 * @returns {Record<string, unknown> | null} Buyable catalog service snapshot.
 */
function buildLeafPurchaseService(subCategory, categoryName, subCategoryChildrenCount) {
  return buildCategoryPurchaseService({
    category: subCategory,
    categoryLabel: categoryName,
    categorySlug: subCategory.slug || subCategory.id,
    childCountById: subCategoryChildrenCount,
  });
}

/**
 * Adds one purchasable leaf category to the shared cart.
 *
 * @param {Record<string, unknown>} service - Buyable catalog snapshot.
 * @param {{ addToCart: (product: Record<string, unknown>) => { ok: boolean, message?: string }, openSidebar: () => void, showToast: (message: string, options?: Record<string, unknown>) => void }} tools - Cart actions.
 * @param {boolean} [openSidebarOnSuccess=true] - Whether to open the cart sidebar after a successful add.
 * @returns {boolean} True when the cart update succeeds.
 */
function addLeafServiceToCart(service, tools, openSidebarOnSuccess = true) {
  const result = tools.addToCart(buildCatalogServiceCartItem({
    service,
    categoryLabel: service.categoryLabel || service.category || "",
  }));

  if (!result?.ok) {
    tools.showToast(result?.message || "[CRT-301] تعذر إضافة الخدمة حالياً.", { type: "error" });
    return false;
  }

  if (openSidebarOnSuccess) {
    tools.openSidebar();
  }
  tools.showToast("تمت إضافة الخدمة إلى السلة.", { type: "success" });
  return true;
}

/**
 * Lists subcategories for the current service category.
 *
 * @param {{
 *   categoryName: string,
 *   subCategories: Array<Record<string, unknown>>,
 *   subCategoryChildrenCount: Record<string, number>,
 *   subCategoryServiceCounts: Record<string, number>,
 * }} props - Section props.
 * @returns {JSX.Element | null} Subcategory section.
 */
export default function CategorySubcategoriesSection({
  categoryName,
  subCategories,
  subCategoryChildrenCount,
  subCategoryServiceCounts,
}) {
  const router = useRouter();
  const { addToCart, openSidebar } = useCart();
  const { showToast } = useToast();

  if (!subCategories.length) {
    return null;
  }

  const cartTools = { addToCart, openSidebar, showToast };

  return (
    <ScrollReveal variant="fade-up">
      <div className="surface-panel section-shell">
        <div className="section-shell-head">
          <div className="section-shell-copy">
            <h2>الفئات الفرعية</h2>
            <p>اختر الفئة الفرعية المناسبة لعرض خدمات الصيانة المرتبطة بها داخل بطاقات واضحة وسريعة للحجز.</p>
          </div>

          <span className="section-count-badge">
            <AppIcon name="folder" size={14} />
            {subCategories.length} فئة
          </span>
        </div>

        <div className="balanced-card-grid">
          {subCategories.map((subCategory, index) => {
            const image = getRenderableSubCategoryImage(subCategory);
            const purchaseService = buildLeafPurchaseService(
              subCategory,
              categoryName,
              subCategoryChildrenCount || {}
            );
            const detailsHref = getCategoryHref(subCategory);

            if (purchaseService) {
              return (
                <ScrollReveal
                  key={subCategory.id}
                  variant="slide-in-right"
                  delayMs={getStaggeredRevealDelay(index, 85)}
                >
                  <article className={`surface-card category-section-card ${styles.card} ${styles.buyableCard}`}>
                    <Link href={detailsHref} className={styles.mediaLink} aria-label={subCategory.name}>
                      <div className={styles.mediaFrame}>
                        {image ? (
                          <Image
                            src={image}
                            alt={subCategory.name}
                            fill
                            width={SUBCATEGORY_IMAGE_WIDTH}
                            height={SUBCATEGORY_IMAGE_HEIGHT}
                            loading="lazy"
                            quality={80}
                            sizes="(max-width: 700px) min(100vw - 3rem, 320px), 280px"
                            unoptimized={!isOptimizableImageSrc(image)}
                            className={styles.mediaImage}
                          />
                        ) : (
                          <div className={styles.iconFallback}>
                            <AppIcon name={subCategory.icon || subCategory.name || "folder"} size={52} />
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className={styles.copy}>
                      <div className={styles.badges}>
                        <span className={styles.categoryBadge}>
                          <AppIcon name="folder" size={13} />
                          {categoryName}
                        </span>
                        <span className={styles.subBadge}>خدمة فرعية قابلة للشراء</span>
                        <span className={styles.priceBadge}>
                          <AppIcon name="wallet" size={13} />
                          {formatCurrency(purchaseService.price)}
                        </span>
                      </div>

                      <h3 className={styles.title}>
                        <Link href={detailsHref}>{subCategory.name}</Link>
                      </h3>

                      <p className={styles.description}>
                        {subCategory.description ||
                          "خدمة رقمية قابلة للإضافة إلى السلة أو الشراء المباشر من هنا."}
                      </p>

                      <div className={styles.metaRow}>
                        <span>
                          <AppIcon name="layers" size={14} />
                          {subCategoryServiceCounts[subCategory.id] || 0} خدمة
                        </span>
                        <span>
                          <AppIcon name="bolt" size={14} />
                          متاحة للشراء
                        </span>
                      </div>

                      <div className={styles.actions}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => addLeafServiceToCart(purchaseService, cartTools)}
                        >
                          أضف للسلة
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            const added = addLeafServiceToCart(purchaseService, cartTools, false);
                            if (added) {
                              router.push("/checkout");
                            }
                          }}
                        >
                          اشتر الآن
                        </button>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              );
            }

            return (
              <ScrollReveal
                key={subCategory.id}
                variant="slide-in-right"
                delayMs={getStaggeredRevealDelay(index, 85)}
              >
                <Link
                  href={detailsHref}
                  className={`surface-card category-section-card ${styles.card}`}
                >
                  <div className={styles.mediaFrame}>
                    {image ? (
                      <Image
                        src={image}
                        alt={subCategory.name}
                        fill
                        width={SUBCATEGORY_IMAGE_WIDTH}
                        height={SUBCATEGORY_IMAGE_HEIGHT}
                        loading="lazy"
                        quality={80}
                        sizes="(max-width: 700px) min(100vw - 3rem, 320px), 280px"
                        unoptimized={!isOptimizableImageSrc(image)}
                        className={styles.mediaImage}
                      />
                    ) : (
                      <div className={styles.iconFallback}>
                        <AppIcon name={subCategory.icon || subCategory.name || "folder"} size={52} />
                      </div>
                    )}
                  </div>

                  <div className={styles.copy}>
                    <h3 className={styles.title}>{subCategory.name}</h3>
                    <p className={styles.description}>
                      {subCategory.description ||
                        "ادخل إلى هذه الفئة لاستعراض خدمات الصيانة الخاصة بها داخل بطاقات واضحة ومباشرة."}
                    </p>
                  </div>

                  <span className={`section-count-badge ${styles.countBadge}`}>
                    <AppIcon name="wrench" size={14} />
                    {subCategoryServiceCounts[subCategory.id] || 0} خدمة
                  </span>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </ScrollReveal>
  );
}
