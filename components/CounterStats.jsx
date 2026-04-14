"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { useSiteRuntime } from "./SiteRuntimeProvider";
import { normalizeSiteSettings } from "@/lib/contactChannels";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  buildRevealClassName,
  getStaggeredRevealDelay,
  resolveRevealDelay,
} from "@/lib/scrollRevealModel";

const FALLBACK_STATS = normalizeSiteSettings().stats;
const DEFAULT_LIMIT = 3;
const DEFAULT_OFFSET = 1;

/**
 * Animates a numeric value once its parent card becomes visible.
 *
 * @param {{ isVisible: boolean, suffix: string, target: number }} props
 * @returns {JSX.Element}
 */
function AnimatedNumber({ isVisible, suffix, target }) {
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!isVisible || started.current) {
      return undefined;
    }

    started.current = true;
    const duration = 1800;
    const start = performance.now();

    /**
     * Progresses the visible counter with an eased animation curve.
     *
     * @param {number} now
     * @returns {void}
     */
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(target * easedProgress));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
    return undefined;
  }, [isVisible, target]);

  return (
    <span>
      {count.toLocaleString("ar-JO")}
      {suffix}
    </span>
  );
}

/**
 * Renders a single counter-stat card with the shared scroll reveal treatment.
 *
 * @param {{
 *   compact: boolean,
 *   delayMs: number,
 *   stat: { accent?: string, glow?: string, hint?: string, icon?: string, label: string, suffix?: string, value?: number }
 * }} props
 * @returns {JSX.Element}
 */
function CounterStatCard({ compact, delayMs, stat }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.25 });
  const cardClassName = compact ? "stat-card stat-card-compact" : "stat-card";

  return (
    <div
      ref={ref}
      className={buildRevealClassName(cardClassName, "fade-up", isVisible)}
      style={{
        "--stat-accent": stat.accent,
        "--stat-glow": stat.glow,
        "--reveal-delay": resolveRevealDelay(delayMs),
      }}
    >
      <div className="stat-card-head">
        <span className="stat-card-icon">
          <AppIcon name={stat.icon} size={compact ? 15 : 18} />
        </span>
      </div>

      <strong>
        <AnimatedNumber
          isVisible={isVisible}
          target={Number(stat.value) || 0}
          suffix={stat.suffix || ""}
        />
      </strong>
      <span>{stat.label}</span>
      <small>{stat.hint}</small>
    </div>
  );
}

function StatsSkeleton({ compact, count }) {
  const rowClassName = compact ? "stats-row stats-row-compact" : "stats-row";
  const cardClassName = compact ? "stat-card stat-card-compact" : "stat-card";

  return (
    <div className={rowClassName} aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`stat-skeleton-${index}`} className={cardClassName} aria-hidden="true">
          <div className="stat-card-head">
            <span className="stat-card-icon skeleton-block" />
          </div>
          <span className="skeleton-block" style={{ width: "5.5rem", height: "1.6rem" }} />
          <span className="skeleton-block" style={{ width: "5rem", height: "0.9rem" }} />
          <span className="skeleton-block" style={{ width: "100%", height: "0.8rem" }} />
        </div>
      ))}
    </div>
  );
}

function sliceStats(stats, offset, limit) {
  if (!Array.isArray(stats)) return [];
  return stats.slice(offset, offset + limit);
}

export default function CounterStats({
  compact = false,
  limit = DEFAULT_LIMIT,
  offset = DEFAULT_OFFSET,
}) {
  const { siteSettings } = useSiteRuntime();
  const stats = Array.isArray(siteSettings?.stats) ? siteSettings.stats : FALLBACK_STATS;
  const visibleStats = sliceStats(stats, offset, limit);
  const rowClassName = compact ? "stats-row stats-row-compact" : "stats-row";

  if (visibleStats.length === 0) {
    return <StatsSkeleton compact={compact} count={limit} />;
  }

  return (
    <div className={rowClassName}>
      {visibleStats.map((stat, index) => (
        <CounterStatCard
          key={stat.label}
          compact={compact}
          delayMs={getStaggeredRevealDelay(index)}
          stat={stat}
        />
      ))}
    </div>
  );
}
