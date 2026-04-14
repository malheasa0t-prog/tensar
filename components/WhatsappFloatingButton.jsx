"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppIcon from "@/components/AppIcon";
import { useSiteRuntime } from "@/components/SiteRuntimeProvider";
import styles from "@/components/WhatsappFloatingButton.module.css";
import { getWhatsappSupportLink, normalizeSiteSettings } from "@/lib/contactChannels";
import {
  WHATSAPP_WELCOME_AUTO_HIDE_MS,
  WHATSAPP_WELCOME_DELAY_MS,
  WHATSAPP_WELCOME_MESSAGE,
  WHATSAPP_WELCOME_SESSION_KEY,
  shouldRenderWhatsappWidget,
  shouldScheduleWhatsappWelcome,
} from "@/lib/whatsappWidgetModel";

/**
 * Floating WhatsApp entry point that stays visible across the storefront.
 *
 * @returns {JSX.Element | null}
 */
export default function WhatsappFloatingButton() {
  const pathname = usePathname();
  const { siteSettings } = useSiteRuntime();
  const [showWelcome, setShowWelcome] = useState(false);
  const whatsappHref = getWhatsappSupportLink(siteSettings || normalizeSiteSettings());

  useEffect(() => {
    const hasSeenSession = window.sessionStorage.getItem(WHATSAPP_WELCOME_SESSION_KEY) === "1";

    if (!shouldScheduleWhatsappWelcome({ hasSeenSession, href: whatsappHref, pathname })) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setShowWelcome(true);
      window.sessionStorage.setItem(WHATSAPP_WELCOME_SESSION_KEY, "1");
    }, WHATSAPP_WELCOME_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [pathname, whatsappHref]);

  useEffect(() => {
    if (!showWelcome) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setShowWelcome(false);
    }, WHATSAPP_WELCOME_AUTO_HIDE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [showWelcome]);

  if (!shouldRenderWhatsappWidget({ href: whatsappHref, pathname })) {
    return null;
  }

  return (
    <div className={styles.shell}>
      {showWelcome ? (
        <div className={styles.welcomeBubble}>
          <p>{WHATSAPP_WELCOME_MESSAGE}</p>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={() => setShowWelcome(false)}
            aria-label="إغلاق رسالة واتساب"
          >
            <AppIcon name="x" size={14} />
          </button>
        </div>
      ) : null}

      <Link
        href={whatsappHref}
        className={styles.button}
        target="_blank"
        rel="noreferrer"
        aria-label="افتح واتساب للتواصل المباشر"
        title="تواصل عبر واتساب"
        onClick={() => setShowWelcome(false)}
      >
        <AppIcon name="whatsapp" size={28} />
      </Link>

      <div className={styles.note}>واتساب مباشر مع فريق TECHZONE</div>
    </div>
  );
}
