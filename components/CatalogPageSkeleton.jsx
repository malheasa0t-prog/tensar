import SkeletonCard from "@/components/SkeletonCard";
import AppIcon from "@/components/AppIcon";

export default function CatalogPageSkeleton({
  showCategories = false,
  showProducts = true,
  categoryCount = 4,
  productCount = 6,
}) {
  return (
    <section className="section page-top skeleton-page-shell" style={{ paddingBottom: "4rem" }} aria-busy="true">
      <div className="container" style={{ display: "grid", gap: "1.5rem" }}>
        <div className="section-header skeleton-page-header" style={{ marginBottom: 0 }}>
          <span className="skeleton-block skeleton-page-title" />
          <span className="skeleton-block skeleton-page-copy" />
        </div>

        {showCategories ? (
          <div className="surface-panel section-shell">
            <div className="section-shell-head">
              <div className="section-shell-copy">
                <span className="skeleton-block skeleton-shell-title" />
                <span className="skeleton-block skeleton-shell-copy" />
              </div>

              <span className="section-count-badge skeleton-count-badge">
                <AppIcon name="folder-open" size={14} />
                جاري التحميل
              </span>
            </div>

            <div className="balanced-card-grid">
              {Array.from({ length: categoryCount }).map((_, index) => (
                <SkeletonCard key={`category-${index}`} variant="category" />
              ))}
            </div>
          </div>
        ) : null}

        {showProducts ? (
          <div className="surface-panel section-shell">
            <div className="section-shell-head">
              <div className="section-shell-copy">
                <span className="skeleton-block skeleton-shell-title" />
                <span className="skeleton-block skeleton-shell-copy" />
              </div>

              <span className="section-count-badge skeleton-count-badge">
                <AppIcon name="shopping-bag" size={14} />
                جاري التحميل
              </span>
            </div>

            <div className="balanced-card-grid">
              {Array.from({ length: productCount }).map((_, index) => (
                <SkeletonCard key={`product-${index}`} variant="product" />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
