"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { normalizeSiteSettings } from "@/lib/contactChannels";
import { loadSiteSettingsClient } from "@/lib/siteSettingsClient";

const FALLBACK_STATS = normalizeSiteSettings().stats;

function AnimatedNumber({ target, suffix }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;

        started.current = true;
        const duration = 2000;
        const start = performance.now();

        function step(now) {
          const progress = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 4);
          setCount(Math.round(target * ease));

          if (progress < 1) {
            requestAnimationFrame(step);
          }
        }

        requestAnimationFrame(step);
      },
      { threshold: 0.3 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count.toLocaleString("ar-JO")}
      {suffix}
    </span>
  );
}

function StatsSkeleton() {
  return (
    <div className="stats-row" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`stat-skeleton-${index}`} className="stat-card" aria-hidden="true">
          <div className="stat-card-head">
            <span className="stat-card-icon skeleton-block" />
            <span className="skeleton-block" style={{ width: "6rem", height: "0.85rem" }} />
          </div>
          <span className="skeleton-block" style={{ width: "7rem", height: "1.9rem" }} />
          <span className="skeleton-block" style={{ width: "5.5rem", height: "0.95rem" }} />
          <span className="skeleton-block" style={{ width: "100%", height: "0.85rem" }} />
          <span className="skeleton-block" style={{ width: "80%", height: "0.85rem" }} />
        </div>
      ))}
    </div>
  );
}

export default function CounterStats() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      try {
        const siteSettings = await loadSiteSettingsClient();
        if (!mounted) return;
        setStats(siteSettings.stats);
      } catch {
        if (!mounted) return;
        setStats(FALLBACK_STATS);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <StatsSkeleton />;
  }

  return (
    <div className="stats-row">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="stat-card"
          style={{
            "--stat-accent": stat.accent,
            "--stat-glow": stat.glow,
          }}
        >
          <div className="stat-card-head">
            <span className="stat-card-icon">
              <AppIcon name={stat.icon} size={18} />
            </span>
            <span className="stat-card-kicker">مؤشر مباشر</span>
          </div>

          <strong>
            <AnimatedNumber target={Number(stat.value) || 0} suffix={stat.suffix || ""} />
          </strong>
          <span>{stat.label}</span>
          <small>{stat.hint}</small>
        </div>
      ))}
    </div>
  );
}
