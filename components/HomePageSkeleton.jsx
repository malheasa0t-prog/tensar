import SkeletonCard from "@/components/SkeletonCard";

export default function HomePageSkeleton() {
  return (
    <>
      <section className="hero" id="home" aria-busy="true">
        <div className="container">
          <div className="hero-content-grid hero-content-grid-categories">
            <div className="hero-text-col">
              <span className="skeleton-block skeleton-hero-badge" />
              <span className="skeleton-block skeleton-hero-title" />
              <span className="skeleton-block skeleton-hero-title short" />
              <span className="skeleton-block skeleton-hero-copy" />
              <span className="skeleton-block skeleton-hero-copy short" />

              <div className="hero-actions hero-actions-skeleton">
                <span className="skeleton-block skeleton-hero-button" />
                <span className="skeleton-block skeleton-hero-button secondary" />
              </div>

              <div className="hero-main-cards-shell">
                <div className="hero-main-cards-head">
                  <div className="skeleton-heading-stack">
                    <span className="skeleton-block skeleton-shell-title" />
                  </div>
                </div>

                <div className="hero-main-cards-grid">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonCard key={`hero-category-${index}`} variant="hero-category" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="section-header skeleton-page-header">
            <span className="skeleton-block skeleton-page-title" />
            <span className="skeleton-block skeleton-page-copy" />
          </div>

          <div className="contact-social-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={`social-${index}`} variant="social" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
