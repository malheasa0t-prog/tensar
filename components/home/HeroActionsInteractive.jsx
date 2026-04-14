"use client";

import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import styles from "./HeroActionsInteractive.module.css";
import { buildMagneticOffset } from "@/lib/interactiveEffectsModel";

const HERO_ACTIONS = [
  { href: "/products", icon: "shopping-bag", label: "استكشف المنتجات", variant: "primary" },
  { href: "/services", icon: "wrench", label: "احجز صيانة الآن", variant: "secondary" },
  { href: "/deposit", icon: "wallet", label: "إيداع رصيد", variant: "outline" },
];

export default function HeroActionsInteractive() {
  function handlePointerMove(event) {
    const offset = buildMagneticOffset({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: event.currentTarget.getBoundingClientRect(),
      maxOffset: 10,
    });

    event.currentTarget.style.setProperty("--magnetic-x", `${offset.x}px`);
    event.currentTarget.style.setProperty("--magnetic-y", `${offset.y}px`);
  }

  function handlePointerLeave(event) {
    event.currentTarget.style.setProperty("--magnetic-x", "0px");
    event.currentTarget.style.setProperty("--magnetic-y", "0px");
  }

  return (
    <div className={`hero-actions ${styles.actions}`}>
      {HERO_ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`btn btn-${action.variant} btn-lg ${styles.magneticButton}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <span className={styles.buttonInner}>
            <AppIcon name={action.icon} size={18} />
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
