"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import AppIcon from "./AppIcon";
import styles from "./MobileMenu.module.css";
import { formatCurrency } from "@/lib/formatCurrency";
import { buildMobileAccountLinks, resolveMobileMenuIcon } from "@/lib/mobileMenuModel";

function isFocusable(element) {
  return !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true";
}

function MenuLink({ badge = "", href, icon, label, onClick, open }) {
  return (
    <Link href={href} className={styles.menuLink} onClick={onClick} tabIndex={open ? 0 : -1}>
      <span className={styles.menuLinkMain}>
        <span className={styles.menuLinkIcon}>
          <AppIcon name={icon} size={18} />
        </span>
        <span>{label}</span>
      </span>
      {badge ? <span className={styles.menuBadge}>{badge}</span> : <AppIcon name="chevron-left" size={16} />}
    </Link>
  );
}

export default function MobileMenu({
  compareCount = 0,
  favoriteCount = 0,
  links,
  onClose,
  onToggleTheme,
  open,
  pathname,
  socialLinks = [],
  themeLabel,
  unreadNotifications = 0,
  user,
  userLabel,
  walletBalance = 0,
}) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  const primaryLinks = useMemo(
    () =>
      (Array.isArray(links) ? links : []).map((link) => ({
        ...link,
        icon: resolveMobileMenuIcon(link.href),
      })),
    [links]
  );

  const accountLinks = useMemo(
    () =>
      buildMobileAccountLinks({
        favoriteCount,
        hasUser: Boolean(user),
        unreadNotifications,
      }),
    [favoriteCount, unreadNotifications, user]
  );

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function" &&
        document.contains(previousFocusRef.current)
      ) {
        previousFocusRef.current.focus();
      }
      return undefined;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frameId = window.requestAnimationFrame(() => {
      const firstFocusable = getFocusableElements(panelRef.current)[0];
      if (firstFocusable) {
        firstFocusable.focus();
        return;
      }
      panelRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleDocumentKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [onClose, open]);

  function handleKeyDown(event) {
    if (!open || event.key !== "Tab") {
      return;
    }

    const focusableElements = getFocusableElements(panelRef.current);
    if (focusableElements.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === firstElement || activeElement === panelRef.current)) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className={`${styles.overlay} ${open ? styles.overlayOpen : ""}`} onClick={onClose} aria-hidden={!open}>
      <aside
        className={styles.panel}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الرئيسية"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>
              <AppIcon name={user ? "user" : "lock"} size={18} />
            </div>
            <div className={styles.userCopy}>
              <strong>{user ? userLabel : "حسابك على TechZone"}</strong>
              <span>
                {user
                  ? `رصيدك: ${formatCurrency(walletBalance)}`
                  : "سجّل الدخول للوصول إلى الطلبات والإشعارات"}
              </span>
            </div>
          </div>

          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="إغلاق القائمة">
            <AppIcon name="x" size={18} />
          </button>
        </header>

        <div className={styles.scrollArea}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span>التنقل الرئيسي</span>
              <small>{pathname === "/" ? "أنت في الرئيسية" : "روابط الموقع الأساسية"}</small>
            </div>
            <div className={styles.linkList}>
              {primaryLinks.map((link) => (
                <MenuLink
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  onClick={onClose}
                  open={open}
                />
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span>حسابي</span>
              <small>{user ? "الوصول السريع إلى مركزك الشخصي" : "سجّل الدخول لإدارة حسابك"}</small>
            </div>
            <div className={styles.linkList}>
              {accountLinks.map((link) => (
                <MenuLink
                  key={link.href}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  badge={link.badge}
                  onClick={onClose}
                  open={open}
                />
              ))}
              {compareCount > 0 ? (
                <MenuLink
                  href="/compare"
                  icon="compare"
                  label="مقارنة المنتجات"
                  badge={String(compareCount)}
                  onClick={onClose}
                  open={open}
                />
              ) : null}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span>تواصل وإعدادات</span>
              <small>اختصارات سريعة للمساعدة وتخصيص العرض</small>
            </div>
            <div className={styles.linkList}>
              <MenuLink href="/contact" icon="message-circle" label="تواصل معنا" onClick={onClose} open={open} />
              <button type="button" className={styles.menuLinkButton} onClick={onToggleTheme}>
                <span className={styles.menuLinkMain}>
                  <span className={styles.menuLinkIcon}>
                    <AppIcon name={themeLabel === "الوضع الفاتح" ? "sun" : "moon"} size={18} />
                  </span>
                  <span>{themeLabel}</span>
                </span>
                <AppIcon name="refresh" size={16} />
              </button>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <Link href="/services" className={styles.ctaButton} onClick={onClose} tabIndex={open ? 0 : -1}>
            <AppIcon name="zap" size={16} />
            احجز صيانة الآن
          </Link>

          {socialLinks.length > 0 ? (
            <div className={styles.socialRow}>
              {socialLinks.slice(0, 5).map((link) => (
                <Link
                  key={`${link.key}-${link.href}`}
                  href={link.href}
                  className={styles.socialLink}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer" : undefined}
                  tabIndex={open ? 0 : -1}
                >
                  <AppIcon name={link.icon || link.key} size={18} />
                </Link>
              ))}
            </div>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

function getFocusableElements(container) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(isFocusable);
}
