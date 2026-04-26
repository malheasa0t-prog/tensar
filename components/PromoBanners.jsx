"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import AppIcon from "@/components/AppIcon";
import { isOptimizableImageSrc, optimizeImageSrc } from "@/lib/imageUtils";
import {
  buildPromoBannerSlides,
  DEFAULT_BANNER_ROTATION_INTERVAL_MS,
  getCircularBannerOffset,
} from "@/lib/homePromoBanner";

const PROMO_SLIDE_TRAVEL_PERCENT = 88;
const PROMO_SLIDE_ACTIVE_SCALE = 1;
const PROMO_SLIDE_INACTIVE_SCALE = 0.94;
const PROMO_SLIDE_ACTIVE_OPACITY = 1;
const PROMO_SLIDE_NEIGHBOR_OPACITY = 0.3;
const PROMO_SLIDE_ACTIVE_Z_INDEX = 10;
const PROMO_SLIDE_INACTIVE_Z_INDEX = 2;
const PROMO_SLIDE_PARALLAX_DISTANCE_PX = 34;
const PROMO_BANNER_IMAGE_WIDTH = 1200;
const PROMO_BANNER_IMAGE_SIZES = "(max-width: 768px) 94vw, (max-width: 1280px) 92vw, 1280px";

const defaultBanners = [
  {
    id: 1,
    image:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=2670&auto=format&fit=crop",
    title: "أحدث التقنيات بين يديك",
    subtitle: "اكتشف أجهزة لابتوب وإكسسوارات بأسعار لا تقبل المنافسة",
    href: "/products",
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=2601&auto=format&fit=crop",
    title: "عروض الصيانة المميزة",
    subtitle: "صيانة احترافية وفريق مختص لإصلاح أجهزتك بأسرع وقت",
    href: "/services",
  },
  {
    id: 3,
    image:
      "https://images.unsplash.com/photo-1603302576837-37561b2e2302?q=80&w=2668&auto=format&fit=crop",
    title: "إكسسوارات لكل الأجهزة",
    subtitle: "تصفح أحدث السماعات والشواحن والكابلات الأصلية",
    href: "/products",
  },
];

/**
 * Renders one banner slide.
 *
 * @param {{
 *   banner: { id: string, image: string, title: string, subtitle: string, href: string },
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
  const optimizedImageSrc = optimizeImageSrc({
    quality: 80,
    src: banner.image,
    width: PROMO_BANNER_IMAGE_WIDTH,
  });

  return (
    <div
      className={`promo-banner-slide${isActive ? " is-active" : ""}`}
      aria-hidden={!isActive}
      style={{
        transform: `translateX(${offset * PROMO_SLIDE_TRAVEL_PERCENT}%) scale(${slideScale})`,
        opacity: slideOpacity,
        zIndex: isActive ? PROMO_SLIDE_ACTIVE_Z_INDEX : PROMO_SLIDE_INACTIVE_Z_INDEX,
        filter: isActive ? "none" : "saturate(0.7) brightness(0.76)",
        pointerEvents: isActive ? "auto" : "none",
      }}
    >
      <div className="promo-banner-slide-media">
        <Image
          src={optimizedImageSrc}
          alt={banner.title}
          className="promo-banner-image"
          fill
          quality={80}
          priority={index === 0}
          sizes={PROMO_BANNER_IMAGE_SIZES}
          unoptimized={!isOptimizableImageSrc(optimizedImageSrc)}
          style={{
            "--promo-banner-image-parallax": imageParallaxOffset,
          }}
        />
      </div>


    </div>
  );
}

/**
 * Renders the slider navigation buttons.
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
 * Renders the slide indicators.
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
 * Renders the homepage promo banner slider.
 *
 * @param {{ banners?: Array<{ id?: string | number, image?: string, title?: string, subtitle?: string, href?: string }> }} props
 * @returns {JSX.Element | null}
 */
export default function PromoBanners({ banners = defaultBanners }) {
  const slides = buildPromoBannerSlides(banners, defaultBanners);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    /**
     * Responds to global keyboard-driven promo navigation.
     *
     * @param {CustomEvent<{ direction?: number }>} event
     * @returns {void}
     */
    function handleBannerStep(event) {
      const direction = Number(event?.detail?.direction || 0);
      if (!direction) {
        return;
      }

      setCurrentIndex((previousIndex) => (previousIndex + direction + slides.length) % slides.length);
    }

    window.addEventListener("tz-promo-banner-step", handleBannerStep);
    return () => window.removeEventListener("tz-promo-banner-step", handleBannerStep);
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
          <PromoBannerIndicators
            slides={slides}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
          <PromoBannerControls onNext={handleNext} onPrevious={handlePrevious} />
        </div>
      ) : null}
    </div>
  );
}
