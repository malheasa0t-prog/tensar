"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { useModalAccessibility } from "@/hooks/useModalAccessibility";
import styles from "./WelcomeOnboardingModal.module.css";

const WELCOME_MODAL_STORAGE_KEY = "tz_onboarding_seen";
const HIDDEN_PATH_PREFIXES = ["/admin", "/auth", "/checkout", "/compare", "/dashboard"];

export default function WelcomeOnboardingModal() {
  const pathname = usePathname();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const shouldRender = useMemo(
    () => Boolean(pathname) && !HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    [pathname]
  );
  const dismiss = useCallback(() => {
    window.localStorage.setItem(WELCOME_MODAL_STORAGE_KEY, "1");
    setIsOpen(false);
  }, []);
  const { handleKeyDown } = useModalAccessibility({
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    isOpen,
    onClose: dismiss,
  });

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

  if (!isOpen || !shouldRender) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={dismiss} role="presentation">
      <section
        className={styles.modal}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-onboarding-title"
        tabIndex={-1}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={dismiss}
          aria-label="إغلاق الترحيب"
          ref={closeButtonRef}
        >
          <AppIcon name="x" size={16} />
        </button>

        <span className={styles.eyebrow}>
          <AppIcon name="sparkles" size={14} />
          بداية سريعة
        </span>
        <h2 id="welcome-onboarding-title">مرحباً بك في TechZone</h2>
        <p className={styles.description}>
          استكشف الخدمات، احجز الصيانة، أو راجع الاشتراكات من واجهة واحدة مصممة لتوصلك
          مباشرة لما تحتاجه.
        </p>

        <div className={styles.features}>
          {[
            { icon: "zap", title: "خدمات رقمية", description: "اشتراكات وخدمات تقنية متنوعة." },
            { icon: "wrench", title: "صيانة مرنة", description: "احجز خدمة داخل المحل أو عن بعد." },
            { icon: "wallet", title: "رصيد واشتراكات", description: "إدارة أسهل للدفع والطلبات." },
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
          <Link href="/services" className={styles.primaryButton} onClick={dismiss}>
            استكشف الخدمات
          </Link>
          <Link href="/contact" className={styles.secondaryButton} onClick={dismiss}>
            تواصل معنا
          </Link>
        </div>
      </section>
    </div>
  );
}

