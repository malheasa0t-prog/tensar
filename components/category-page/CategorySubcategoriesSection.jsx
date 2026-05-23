import Image from "next/image";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import ScrollReveal from "@/components/ScrollReveal";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import { getStaggeredRevealDelay } from "@/lib/scrollRevealModel";
import { getCategoryHref } from "@/lib/categoryPageModel";
import styles from "./CategorySubcategoriesSection.module.css";

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
 * Lists subcategories for the current service category.
 *
 * @param {{
 *   subCategories: Array<Record<string, unknown>>,
 *   subCategoryServiceCounts: Record<string, number>,
 * }} props - Section props.
 * @returns {JSX.Element | null} Subcategory section.
 */
export default function CategorySubcategoriesSection({
  subCategories,
  subCategoryServiceCounts,
}) {
  if (!subCategories.length) {
    return null;
  }

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

            return (
              <ScrollReveal
                key={subCategory.id}
                variant="slide-in-right"
                delayMs={getStaggeredRevealDelay(index, 85)}
              >
                <Link
                  href={getCategoryHref(subCategory)}
                  className={`surface-card category-section-card ${styles.card}`}
                >
                  <div className={styles.mediaFrame}>
                    {image ? (
                      <Image
                        src={image}
                        alt={subCategory.name}
                        fill
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
