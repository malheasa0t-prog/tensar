import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import {
  buildPromoBannerSlides,
  DEFAULT_BANNER_ROTATION_INTERVAL_MS,
  getCircularBannerOffset
} from "@/lib/homePromoBanner";

const PROMO_SLIDE_TRAVEL_PERCENT = 88;
const PROMO_SLIDE_ACTIVE_SCALE = 1;
const PROMO_SLIDE_INACTIVE_SCALE = 0.94;
const PROMO_SLIDE_ACTIVE_OPACITY = 1;
const PROMO_SLIDE_NEIGHBOR_OPACITY = 0.3;
const PROMO_SLIDE_ACTIVE_Z_INDEX = 10;
const PROMO_SLIDE_INACTIVE_Z_INDEX = 2;
const PROMO_SLIDE_PARALLAX_DISTANCE_PX = 34;

const DEFAULT_BANNERS = [
  {
    id: 1,
    image:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=2670&auto=format&fit=crop",
    title: "أحدث التقنيات بين يديك",
    subtitle: "اكتشف أجهزة لابتوب وإكسسوارات بأسعار لا تقبل المنافسة",
    href: "/products"
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=2601&auto=format&fit=crop",
    title: "عروض الصيانة المميزة",
    subtitle: "صيانة احترافية وفريق مختص لإصلاح أجهزتك بأسرع وقت",
    href: "/services"
  },
  {
    id: 3,
    image:
      "https://images.unsplash.com/photo-1603302576837-37561b2e2302?q=80&w=2668&auto=format&fit=crop",
    title: "إكسسوارات لكل الأجهزة",
    subtitle: "تصفح أحدث السماعات والشواحن والكابلات الأصلية",
    href: "/accessories"
  }
];

/**
 * Checks whether the banner image uses a data URL.
 *
 * @param {unknown} src
 * @returns {boolean}
 */
function isDataImageUrl(src) {
  return typeof src === "string" && src.startsWith("data:image/");
}

/**
 * Converts large data URLs into object URLs for more stable browser rendering.
 *
 * @param {string} src
 * @returns {Promise<{ cleanup: (() => void) | null, src: string }>}
 */
async function resolveBannerImageSource(src) {
  if (!isDataImageUrl(src) || typeof fetch !== "function" || typeof URL.createObjectURL !== "function") {
    return { cleanup: null, src };
  }

  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return {
      cleanup: () => URL.revokeObjectURL(objectUrl),
      src: objectUrl
    };
  } catch {
    return { cleanup: null, src };
  }
}

/**
 * Resolves banner image URLs while cleaning up temporary object URLs.
 *
 * @param {Array<{ href: string, id: string, image: string, subtitle: string, title: string }>} slides
 * @param {(slides: Array<{ href: string, id: string, image: string, subtitle: string, title: string }>) => void} onReady
 * @returns {() => void}
 */
function hydrateBannerImages(slides, onReady) {
  let active = true;
  let cleanupHandlers = [];

  async function hydrate() {
    const resolvedSlides = await Promise.all(
      slides.map(async (slide) => {
        const resolvedImage = await resolveBannerImageSource(slide.image);
        return { ...slide, cleanup: resolvedImage.cleanup, image: resolvedImage.src };
      })
    );

    if (!active) {
      resolvedSlides.forEach((slide) => slide.cleanup?.());
      return;
    }

    cleanupHandlers = resolvedSlides.map((slide) => slide.cleanup).filter(Boolean);
    onReady(resolvedSlides.map(({ cleanup, ...slide }) => slide));
  }

  void hydrate();

  return () => {
    active = false;
    cleanupHandlers.forEach((cleanup) => cleanup?.());
  };
}

/**
 * Renders one banner slide for the local no-Next copy.
 *
 * @param {{
 *   banner: { href: string, id: string, image: string, subtitle: string, title: string },
 *   currentIndex: number,
 *   index: number,
 *   totalSlides: number
 * }} props
 * @returns {JSX.Element}
 */
function PromoBannerSlide({ banner, currentIndex, index, totalSlides }) {
  const offset = getCircularBannerOffset(index, currentIndex, totalSlides);
  const isActive = offset === 0;
  const isNeighbor = Math.abs(offset) === 1;
  const slideScale = isActive ? PROMO_SLIDE_ACTIVE_SCALE : PROMO_SLIDE_INACTIVE_SCALE;
  const slideOpacity = isActive ? PROMO_SLIDE_ACTIVE_OPACITY : isNeighbor ? PROMO_SLIDE_NEIGHBOR_OPACITY : 0;
  const imageParallaxOffset = `${offset * PROMO_SLIDE_PARALLAX_DISTANCE_PX}px`;

  return (
    <div
      className={`promo-banner-slide${isActive ? " is-active" : ""}`}
      aria-hidden={!isActive}
      style={{
        filter: isActive ? "none" : "saturate(0.7) brightness(0.76)",
        opacity: slideOpacity,
        pointerEvents: isActive ? "auto" : "none",
        transform: `translateX(${offset * PROMO_SLIDE_TRAVEL_PERCENT}%) scale(${slideScale})`,
        zIndex: isActive ? PROMO_SLIDE_ACTIVE_Z_INDEX : PROMO_SLIDE_INACTIVE_Z_INDEX
      }}
    >
      <div
        className="promo-banner-slide-media"
        style={{
          backgroundImage: `url("${banner.image}")`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover"
        }}
      >
        <Link
          href={banner.href || "/"}
          aria-label={banner.title}
          style={{ display: "block", height: "100%", inset: 0, position: "absolute", width: "100%" }}
        >
          <img
            src={banner.image}
            alt={banner.title}
            className="promo-banner-image"
            decoding="async"
            draggable={false}
            loading={index === 0 ? "eager" : "lazy"}
            style={{ "--promo-banner-image-parallax": imageParallaxOffset }}
          />
        </Link>
      </div>
    </div>
  );
}

/**
 * Renders the banner controls.
 *
 * @param {{ onNext: () => void, onPrevious: () => void }} props
 * @returns {JSX.Element}
 */
function PromoBannerControls({ onNext, onPrevious }) {
  return (
    <div className="promo-banner-controls">
      <button type="button" onClick={onPrevious} className="promo-banner-control" aria-label="السابق">
        <AppIcon name="chevron-right" size={18} />
      </button>
      <button type="button" onClick={onNext} className="promo-banner-control" aria-label="التالي">
        <AppIcon name="chevron-left" size={18} />
      </button>
    </div>
  );
}

/**
 * Renders the banner indicators.
 *
 * @param {{
 *   slides: Array<{ id: string }>,
 *   currentIndex: number,
 *   onSelect: (index: number) => void
 * }} props
 * @returns {JSX.Element}
 */
function PromoBannerIndicators({ slides, currentIndex, onSelect }) {
  return (
    <div className="promo-banner-indicators">
      {slides.map((banner, index) => (
        <button
          key={banner.id}
          type="button"
          onClick={() => onSelect(index)}
          className={`promo-banner-indicator${index === currentIndex ? " is-active" : ""}`}
          aria-label={`انتقل إلى الشريحة ${index + 1}`}
        />
      ))}
    </div>
  );
}

/**
 * Renders the promo banners in the non-Next copy.
 *
 * @param {{ banners?: Array<{ id?: string | number, image?: string, title?: string, subtitle?: string, href?: string }> }} props
 * @returns {JSX.Element | null}
 */
export default function PromoBanners({ banners = DEFAULT_BANNERS }) {
  const baseSlides = useMemo(() => buildPromoBannerSlides(banners, DEFAULT_BANNERS), [banners]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState(baseSlides);

  useEffect(() => hydrateBannerImages(baseSlides, setSlides), [baseSlides]);

  useEffect(() => {
    if (currentIndex >= slides.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || typeof window === "undefined") {
      return undefined;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((previousIndex) => (previousIndex + 1) % slides.length);
    }, DEFAULT_BANNER_ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (slides.length === 0) {
    return null;
  }

  const handleNext = () => {
    setCurrentIndex((previousIndex) => (previousIndex + 1) % slides.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((previousIndex) => (previousIndex - 1 + slides.length) % slides.length);
  };

  return (
    <div className="promo-banner">
      <div className="promo-banner-viewport">
        {slides.map((banner, index) => (
          <PromoBannerSlide
            key={banner.id}
            banner={banner}
            currentIndex={currentIndex}
            index={index}
            totalSlides={slides.length}
          />
        ))}
      </div>

      {slides.length > 1 ? (
        <div className="promo-banner-navigation">
          <PromoBannerIndicators slides={slides} currentIndex={currentIndex} onSelect={setCurrentIndex} />
          <PromoBannerControls onNext={handleNext} onPrevious={handlePrevious} />
        </div>
      ) : null}
    </div>
  );
}
