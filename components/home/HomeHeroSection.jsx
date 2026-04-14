import Image from "next/image";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import CounterStats from "@/components/CounterStats";
import HeroActionsInteractive from "@/components/home/HeroActionsInteractive";
import PromoBanners from "@/components/PromoBanners";
import { getHeroStageHighlights } from "@/lib/homeHeroVisualModel";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import styles from "./HomeHeroSection.module.css";

function FeaturedCategoryCard({ category }) {
  const hasImage = Boolean(category.image);

  return (
    <Link href={`/category/${category.slug || category.id}`} className="hero-category-card">
      <div className="hero-category-card-body">
        <div className={`hero-category-card-media${hasImage ? " has-image" : ""}`}>
          <div className={`hero-category-card-media-frame${hasImage ? " has-image" : ""}`}>
            {hasImage ? (
              <Image
                src={category.image}
                alt={category.name}
                className="hero-category-card-image"
                fill
                quality={80}
                unoptimized={!isOptimizableImageSrc(category.image)}
              />
            ) : (
              <AppIcon name={category.icon || category.name || "folder"} size={42} />
            )}
          </div>
        </div>

        <div className="hero-category-card-copy hero-category-card-copy--title-only">
          <h3>{category.name}</h3>
        </div>
      </div>
    </Link>
  );
}

function FeaturedCategories({ featuredCategories }) {
  if (!featuredCategories.length) {
    return null;
  }

  return (
    <div className="hero-main-cards-shell hero-categories-shell" aria-label="الفئات الرئيسية">
      <div className="hero-categories-head">
        <div className="section-header hero-categories-copy">
          <span className="section-badge">
            <AppIcon name="folder-open" size={14} />
            الفئات الرئيسية
          </span>
          <p>ابدأ من أكثر الأقسام طلبًا مباشرة من أول شاشة داخل الصفحة الرئيسية.</p>
        </div>
      </div>

      <div className="hero-category-cards-grid hero-category-cards-grid--hero">
        {featuredCategories.map((category) => (
          <FeaturedCategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}

function TrustBarItem({ item }) {
  return (
    <div className="trust-item">
      <div className="stat-card-icon">
        <AppIcon name={item.icon || "shield-check"} size={18} />
      </div>
      <div>
        <strong>{item.title}</strong>
        <span>{item.subtitle}</span>
      </div>
    </div>
  );
}

export default function HomeHeroSection({
  featuredCategories,
  hero,
  promoBanners,
  trustBar,
}) {
  const safeFeaturedCategories = Array.isArray(featuredCategories) ? featuredCategories : [];
  const safeHero = hero && typeof hero === "object" ? hero : {};
  const safeTrustBar =
    Array.isArray(trustBar) && trustBar.length > 0
      ? trustBar
      : getHeroStageHighlights(undefined);
  const heroTrustBadge = String(safeHero.trustBadge || "").trim();
  const heroTitle = String(safeHero.title || "").trim();
  const heroTitleHighlight = String(safeHero.titleHighlight || "").trim();
  const heroDescription = String(safeHero.description || "").trim();

  return (
    <>
      <section className={`hero home-hero ${styles.heroRoot}`} id="home">
        <div className="home-hero-banner-shell">
          <PromoBanners banners={promoBanners || undefined} />
        </div>

        <div className="container home-hero-content-shell">
          <div className={`home-hero-inline-row ${styles.heroInlineRow}`}>
            <div className={styles.heroInlineTitle}>
              <h1 className={styles.heroTitle}>
                <span>{heroTitle}</span>
                {heroTitleHighlight ? (
                  <span className={styles.typewriterLine}>
                    <span className="gradient-text hero-title-highlight">
                      {heroTitleHighlight}
                    </span>
                  </span>
                ) : null}
              </h1>
            </div>

            <div className={styles.heroInlineActions}>
              <HeroActionsInteractive />
            </div>
          </div>

          <div className="hero-categories-panel hero-categories-panel--fullwidth">
            <FeaturedCategories featuredCategories={safeFeaturedCategories} />
          </div>

          <div className="hero-stats-shell">
            <CounterStats limit={4} />
          </div>
        </div>
      </section>

      <section className="trust-bar">
        <div className="container">
          <div className="trust-items">
            {safeTrustBar.map((item) => (
              <TrustBarItem key={`${item.icon}-${item.title}`} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
