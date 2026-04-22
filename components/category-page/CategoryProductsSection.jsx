import ProductCard from "@/components/ProductCard";
import AppIcon from "@/components/AppIcon";
import ScrollReveal from "@/components/ScrollReveal";
import { mapCategoryProductCard } from "@/lib/categoryPageModel";

/**
 * Lists products that belong directly to the current category.
 *
 * @param {{
 *   products: Array<Record<string, unknown>>,
 *   categoryName: string,
 *   hasSubCategories: boolean,
 * }} props
 * @returns {JSX.Element | null}
 */
export default function CategoryProductsSection({ products, categoryName, hasSubCategories }) {
  if (!products.length) {
    return null;
  }

  return (
    <ScrollReveal variant="fade-up">
      <div className="surface-panel section-shell">
        <div className="section-shell-head">
          <div className="section-shell-copy">
            <h2>{hasSubCategories ? "عناصر مباشرة داخل هذه الفئة" : "منتجات هذه الفئة"}</h2>
            <p>
              {hasSubCategories
                ? "هذه العناصر مرتبطة بهذه الفئة مباشرة وتظهر هنا بجانب الأقسام الفرعية عند توفرها."
                : "جميع المنتجات هنا مرتبطة بهذه الفئة مباشرة داخل بطاقات موحدة وأسهل للمقارنة."}
            </p>
          </div>

          <span className="section-count-badge">
            <AppIcon name="shopping-bag" size={14} />
            {products.length} منتج
          </span>
        </div>

        <div className="balanced-card-grid category-products-grid">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={mapCategoryProductCard(product, categoryName)}
              revealIndex={index}
            />
          ))}
        </div>
      </div>
    </ScrollReveal>
  );
}
