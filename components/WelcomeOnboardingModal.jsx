"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppIcon from "./AppIcon";
import styles from "./WelcomeOnboardingModal.module.css";

const WELCOME_MODAL_STORAGE_KEY = "tz_onboarding_seen";
const HIDDEN_PATH_PREFIXES = ["/admin", "/auth", "/checkout", "/compare", "/dashboard"];

export default function WelcomeOnboardingModal() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const shouldRender = useMemo(
    () => Boolean(pathname) && !HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    [pathname]
  );

  useEffect(() => {
    if (!shouldRender) {
      return undefined;
    }

    if (window.localStorage.getItem(WELCOME_MODAL_STORAGE_KEY) === "1") {
      return undefined;
    }

    const timerId = window.setTimeout(() => setIsOpen(true), 1400);
    return () => window.clearTimeout(timerId);
  }, [shouldRender]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function dismiss() {
    window.localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, "1");
    setIsOpen(false);
  }

  if (!isOpen || !shouldRender) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={dismiss} role="presentation">
      <section
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-onboarding-title"
      >
        <button type="button" className={styles.closeButton} onClick={dismiss} aria-label="Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„ØªØ±Ø­ÙŠØ¨">
          <AppIcon name="x" size={16} />
        </button>

        <span className={styles.eyebrow}>
          <AppIcon name="sparkles" size={14} />
          Ø¨Ø¯Ø§ÙŠØ© Ø³Ø±ÙŠØ¹Ø©
        </span>
        <h2 id="welcome-onboarding-title">Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ùƒ ÙÙŠ TechZone</h2>
        <p className={styles.description}>
          Ø§Ø³ØªÙƒØ´Ù Ø§Ù„Ù…Ù†ØªØ¬Ø§ØªØŒ Ø§Ø­Ø¬Ø² Ø§Ù„ØµÙŠØ§Ù†Ø©ØŒ Ø£Ùˆ Ø±Ø§Ø¬Ø¹ Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª Ù…Ù† ÙˆØ§Ø¬Ù‡Ø© ÙˆØ§Ø­Ø¯Ø© Ù…ØµÙ…Ù…Ø© Ù„ØªÙˆØµÙ„Ùƒ
          Ù…Ø¨Ø§Ø´Ø±Ø© Ù„Ù…Ø§ ØªØ­ØªØ§Ø¬Ù‡.
        </p>

        <div className={styles.features}>
          {[
            { icon: "shopping-bag", title: "Ù…Ù†ØªØ¬Ø§Øª ÙˆØªÙ‚Ù†ÙŠØ§Øª", description: "Ø§Ø¨Ø­Ø« ÙˆÙ‚Ø§Ø±Ù† ÙˆØ£Ø¶Ù Ù„Ù„Ø³Ù„Ø© Ø¨Ø³Ø±Ø¹Ø©." },
            { icon: "wrench", title: "ØµÙŠØ§Ù†Ø© Ù…Ø±Ù†Ø©", description: "Ø§Ø­Ø¬Ø² Ø®Ø¯Ù…Ø© Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø­Ù„ Ø£Ùˆ Ø¹Ù† Ø¨Ø¹Ø¯." },
            { icon: "wallet", title: "Ø±ØµÙŠØ¯ ÙˆØ§Ø´ØªØ±Ø§ÙƒØ§Øª", description: "Ø¥Ø¯Ø§Ø±Ø© Ø£Ø³Ù‡Ù„ Ù„Ù„Ø¯ÙØ¹ ÙˆØ§Ù„Ø·Ù„Ø¨Ø§Øª." },
          ].map((item) => (
            <div key={item.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>
                <AppIcon name={item.icon} size={18} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Link href="/products" className={styles.primaryButton} onClick={dismiss}>
            Ø§Ø¨Ø¯Ø£ Ø§Ù„ØªØ³ÙˆÙ‚
          </Link>
          <Link href="/services" className={styles.secondaryButton} onClick={dismiss}>
            Ø§Ø³ØªÙƒØ´Ù Ø§Ù„Ø®Ø¯Ù…Ø§Øª
          </Link>
        </div>
      </section>
    </div>
  );
}

