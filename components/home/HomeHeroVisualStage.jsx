"use client";

import { useEffect } from "react";
import Image from "next/image";
import AppIcon from "@/components/AppIcon";
import HeroBenefitChips from "@/components/home/HeroBenefitChips";
import { buildMagneticOffset, buildParallaxOffset, buildPointerGlowPosition } from "@/lib/interactiveEffectsModel";
import {
  getHeroStageHighlights,
  getHeroVisualItems,
} from "@/lib/homeHeroVisualModel";
import { isOptimizableImageSrc } from "@/lib/imageUtils";
import styles from "./HomeHeroVisualStage.module.css";

const HERO_STAGE_PARTICLES = Object.freeze([
  { x: "12%", y: "16%", size: "10px", delay: "0s", duration: "7s" },
  { x: "78%", y: "12%", size: "12px", delay: "0.8s", duration: "8.4s" },
  { x: "22%", y: "72%", size: "9px", delay: "1.3s", duration: "7.6s" },
  { x: "88%", y: "68%", size: "13px", delay: "0.4s", duration: "9.2s" },
  { x: "56%", y: "20%", size: "7px", delay: "1.8s", duration: "6.8s" },
  { x: "48%", y: "82%", size: "11px", delay: "0.6s", duration: "8.8s" },
]);

function HeroVisualMedia({ item }) {
  if (item.image) {
    return (
      <Image
        src={item.image}
        alt={item.name}
        fill
        quality={80}
        className={styles.primaryImage}
        unoptimized={!isOptimizableImageSrc(item.image)}
      />
    );
  }

  return (
    <div className={styles.primaryFallback}>
      <AppIcon name={item.icon} size={82} />
    </div>
  );
}

export default function HomeHeroVisualStage({ featuredCategories, trustBar }) {
  const { primaryItem, floatingItems } = getHeroVisualItems(featuredCategories);
  const highlights = getHeroStageHighlights(trustBar);

  useEffect(() => {
    function handleScroll() {
      const root = document.documentElement;
      root.style.setProperty("--hero-parallax-slow", `${buildParallaxOffset({ multiplier: 0.03, scrollY: window.scrollY })}px`);
      root.style.setProperty("--hero-parallax-medium", `${buildParallaxOffset({ multiplier: 0.05, scrollY: window.scrollY })}px`);
      root.style.setProperty("--hero-parallax-fast", `${buildParallaxOffset({ multiplier: 0.075, scrollY: window.scrollY })}px`);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = buildPointerGlowPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      rect,
    });
    const tilt = buildMagneticOffset({
      clientX: event.clientX,
      clientY: event.clientY,
      rect,
      maxOffset: 8,
    });

    event.currentTarget.style.setProperty("--spotlight-x", position.x);
    event.currentTarget.style.setProperty("--spotlight-y", position.y);
    event.currentTarget.style.setProperty("--hero-tilt-x", `${tilt.x / 2}deg`);
    event.currentTarget.style.setProperty("--hero-tilt-y", `${tilt.y / -2}deg`);
  }

  function handlePointerLeave(event) {
    event.currentTarget.style.setProperty("--spotlight-x", "50%");
    event.currentTarget.style.setProperty("--spotlight-y", "35%");
    event.currentTarget.style.setProperty("--hero-tilt-x", "0deg");
    event.currentTarget.style.setProperty("--hero-tilt-y", "0deg");
  }

  return (
    <div
      className={styles.visualStage}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className={styles.meshBackdrop} />
      <div className={styles.spotlight} />
      <div className={`${styles.orbitRing} ${styles.orbitRingPrimary}`} />
      <div className={`${styles.orbitRing} ${styles.orbitRingSecondary}`} />

      {HERO_STAGE_PARTICLES.map((particle, index) => (
        <span
          key={`hero-particle-${index + 1}`}
          className={styles.particle}
          style={{
            "--particle-x": particle.x,
            "--particle-y": particle.y,
            "--particle-size": particle.size,
            "--particle-delay": particle.delay,
            "--particle-duration": particle.duration,
          }}
        />
      ))}

      {floatingItems.map((item, index) => (
        <div
          key={item.id}
          className={`${styles.floatingCard} ${
            index === 0 ? styles.floatingCardTop : styles.floatingCardBottom
          }`}
        >
          <span className={styles.floatingIcon}>
            <AppIcon name={item.icon} size={20} />
          </span>
          <strong>{item.name}</strong>
          <span>واجهة أسرع للوصول إلى قسمك المفضل</span>
        </div>
      ))}

      <div className={styles.deviceShell}>
        <div className={styles.deviceCard}>
          <div className={styles.primaryMedia}>
            <HeroVisualMedia item={primaryItem} />
          </div>

          <div className={styles.devicePanel}>
            <span className={styles.deviceKicker}>واجهة تقنية بتركيز أعلى</span>
            <strong>{primaryItem.name}</strong>
            <p>منتجات، صيانة، وإكسسوارات ضمن مشهد بصري أسرع وأسهل للتصفح من أول ثانية.</p>
            <HeroBenefitChips highlights={highlights} />
          </div>
        </div>
      </div>
    </div>
  );
}
