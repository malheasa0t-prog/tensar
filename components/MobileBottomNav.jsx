"use client";

import { useEffect } from "react";
import Link from "next/link";
import AppIcon from "./AppIcon";
import styles from "./MobileBottomNav.module.css";

/**
 * Resolves whether a mobile navigation item should appear active.
 *
 * @param {{ pathname: string, href: string }} params
 * @returns {boolean}
 */
function isMobileItemActive({ pathname, href }) {
  if (!pathname || !href) {
    return false;
  }

  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/products") {
    return (
      pathname.startsWith("/products") ||
      pathname.startsWith("/category/") ||
      pathname.startsWith("/accessories") ||
      pathname.startsWith("/subscriptions")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Renders the compact mobile bottom navigation for public pages.
 *
 * @param {{
 *   cartCount: number,
 *   favoriteCount: number,
 *   favoritesHref: string,
 *   isCartOpen: boolean,
 *   onCartOpen: () => void,
 *   pathname: string,
 * }} props
 * @returns {JSX.Element}
 */
export default function MobileBottomNav({
  cartCount,
  favoriteCount,
  favoritesHref,
  isCartOpen,
  onCartOpen,
  pathname,
}) {
  useEffect(() => {
    document.body.classList.add("mobile-bottom-nav-open");
    return () => {
      document.body.classList.remove("mobile-bottom-nav-open");
    };
  }, []);

  const items = [
    { href: "/", icon: "home", label: "الرئيسية" },
    { href: "/products", icon: "shopping-bag", label: "المنتجات" },
    { href: "/services", icon: "wrench", label: "الصيانة" },
    { href: favoritesHref, icon: "heart", label: "المفضلة", badge: favoriteCount },
  ];

  return (
    <nav className={styles.wrapper} aria-label="التنقل السفلي">
      <div className={styles.bar}>
        {items.map((item) => {
          const isActive = isMobileItemActive({ pathname, href: item.href });

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.iconShell}>
                <AppIcon name={item.icon} size={18} />
                {item.badge > 0 ? (
                  <span className={styles.badge}>{item.badge > 99 ? "99+" : item.badge}</span>
                ) : null}
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`${styles.item} ${styles.cartButton} ${isCartOpen ? styles.itemActive : ""}`}
          onClick={onCartOpen}
          aria-label="فتح السلة"
        >
          <span className={styles.iconShell}>
            <AppIcon name="cart" size={18} />
            {cartCount > 0 ? (
              <span className={styles.badge}>{cartCount > 99 ? "99+" : cartCount}</span>
            ) : null}
          </span>
          <span className={styles.label}>السلة</span>
        </button>
      </div>
    </nav>
  );
}
