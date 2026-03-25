import SkeletonCard from "@/components/SkeletonCard";

function FooterLinkStack() {
  return (
    <div className="footer-links-list footer-links-list-skeleton" aria-hidden="true">
      <span className="skeleton-block skeleton-footer-link-line" />
      <span className="skeleton-block skeleton-footer-link-line short" />
      <span className="skeleton-block skeleton-footer-link-line" />
      <span className="skeleton-block skeleton-footer-link-line short" />
    </div>
  );
}

export default function FooterSkeleton() {
  return (
    <footer className="site-footer" aria-busy="true">
      <div className="container">
        <div className="footer-main footer-main-skeleton">
          <div className="footer-brand">
            <div className="footer-skeleton-brand">
              <span className="skeleton-block skeleton-footer-brand-mark" />
              <span className="skeleton-block skeleton-footer-brand-text" />
            </div>

            <div className="footer-skeleton-copy">
              <span className="skeleton-block skeleton-footer-copy-line" />
              <span className="skeleton-block skeleton-footer-copy-line short" />
            </div>

            <div className="footer-payment">
              <span className="skeleton-block skeleton-footer-heading" />
              <div className="payment-icons">
                <span className="skeleton-block skeleton-footer-chip" />
                <span className="skeleton-block skeleton-footer-chip" />
                <span className="skeleton-block skeleton-footer-chip" />
              </div>
            </div>
          </div>

          <div className="footer-links-panel">
            <span className="skeleton-block skeleton-footer-heading" />

            <div className="footer-link-columns">
              <div className="footer-link-group">
                <span className="skeleton-block skeleton-footer-group-label" />
                <FooterLinkStack />
              </div>

              <div className="footer-link-group">
                <span className="skeleton-block skeleton-footer-group-label" />
                <FooterLinkStack />
              </div>
            </div>
          </div>

          <div className="footer-contact-block">
            <div className="footer-contact-head">
              <span className="skeleton-block skeleton-footer-heading" />
              <span className="skeleton-block skeleton-footer-copy-line short" />
            </div>

            <div className="footer-contact-stack">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonCard key={`footer-link-${index}`} variant="footer-link" />
              ))}
            </div>
          </div>
        </div>

        <div className="footer-mobile-sheet footer-mobile-sheet-skeleton">
          <div className="footer-mobile-top">
            <div className="footer-skeleton-brand">
              <span className="skeleton-block skeleton-footer-brand-mark" />
              <span className="skeleton-block skeleton-footer-brand-text" />
            </div>

            <div className="footer-skeleton-copy">
              <span className="skeleton-block skeleton-footer-copy-line" />
              <span className="skeleton-block skeleton-footer-copy-line short" />
            </div>
          </div>

          <div className="footer-mobile-links">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={`mobile-link-${index}`} className="footer-mobile-link footer-mobile-link-skeleton">
                <span className="skeleton-block skeleton-footer-mobile-link" />
              </span>
            ))}
          </div>

          <div className="footer-mobile-contacts">
            {Array.from({ length: 2 }).map((_, index) => (
              <SkeletonCard key={`footer-mobile-${index}`} variant="footer-link" />
            ))}
          </div>
        </div>

        <div className="footer-bar footer-bar-skeleton">
          <span className="skeleton-block skeleton-footer-bar-copy" />
          <div className="footer-bar-links">
            <span className="skeleton-block skeleton-footer-bar-link" />
            <span className="skeleton-block skeleton-footer-bar-link" />
          </div>
        </div>
      </div>
    </footer>
  );
}
