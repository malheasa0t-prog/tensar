export default function SkeletonCard({ variant = "product", className = "" }) {
  const classes = `skeleton-card skeleton-card-${variant}${className ? ` ${className}` : ""}`;

  if (variant === "hero-category") {
    return (
      <div className={classes} aria-hidden="true">
        <span className="skeleton-block skeleton-hero-category-media" />
        <span className="skeleton-block skeleton-hero-category-title" />
        <span className="skeleton-block skeleton-hero-category-copy" />
        <span className="skeleton-block skeleton-hero-category-copy short" />
        <span className="skeleton-block skeleton-hero-category-cta" />
      </div>
    );
  }

  if (variant === "category") {
    return (
      <div className={classes} aria-hidden="true">
        <div className="skeleton-category-head">
          <span className="skeleton-block skeleton-category-icon" />
          <span className="skeleton-block skeleton-chip skeleton-category-pill" />
        </div>
        <span className="skeleton-block skeleton-category-title" />
        <span className="skeleton-block skeleton-category-copy" />
        <span className="skeleton-block skeleton-category-copy short" />
        <div className="skeleton-category-meta">
          <span className="skeleton-block skeleton-chip skeleton-category-meta-pill" />
          <span className="skeleton-block skeleton-chip skeleton-category-meta-pill short" />
        </div>
        <span className="skeleton-block skeleton-category-link" />
      </div>
    );
  }

  if (variant === "social") {
    return (
      <div className={classes} aria-hidden="true">
        <span className="skeleton-block skeleton-social-icon" />
        <div className="skeleton-social-copy">
          <span className="skeleton-block skeleton-social-title" />
          <span className="skeleton-block skeleton-social-line" />
        </div>
      </div>
    );
  }

  if (variant === "footer-link") {
    return (
      <div className={classes} aria-hidden="true">
        <span className="skeleton-block skeleton-footer-icon" />
        <div className="skeleton-footer-copy">
          <span className="skeleton-block skeleton-footer-label" />
          <span className="skeleton-block skeleton-footer-value" />
        </div>
      </div>
    );
  }

  return (
    <div className={classes} aria-hidden="true">
      <span className="skeleton-block skeleton-product-media" />
      <div className="skeleton-product-body">
        <span className="skeleton-block skeleton-chip skeleton-product-category" />
        <span className="skeleton-block skeleton-product-title" />
        <span className="skeleton-block skeleton-product-title short" />
        <span className="skeleton-block skeleton-product-copy" />
        <span className="skeleton-block skeleton-product-copy short" />
        <div className="skeleton-product-footer">
          <span className="skeleton-block skeleton-product-price" />
          <div className="skeleton-product-actions">
            <span className="skeleton-block skeleton-button ghost" />
            <span className="skeleton-block skeleton-button solid" />
          </div>
        </div>
      </div>
    </div>
  );
}
