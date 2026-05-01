"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MobileMenu from "./MobileMenu";
import { useCart } from "./CartProvider";
import { useComparison } from "./ComparisonProvider";
import { useFavorites } from "./FavoritesProvider";
import { useSiteRuntime } from "./SiteRuntimeProvider";
import { useTheme } from "./ThemeProvider";
import AppIcon from "./AppIcon";
import HeaderNotificationBell from "./HeaderNotificationBell";
import { getBrandMark, getSocialLinks, normalizeSiteSettings } from "@/lib/contactChannels";
import { resolveMobileMenuIcon } from "@/lib/mobileMenuModel";

const GlobalSearchOverlay = lazy(() => import("./GlobalSearchOverlay"));

const DEFAULT_SITE_SETTINGS = normalizeSiteSettings();

/**
 * Main public site header with dynamic navigation and quick actions.
 *
 * @returns {JSX.Element | null}
 */
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const {
    authLoading,
    dynamicLinks,
    siteSettings = DEFAULT_SITE_SETTINGS,
    unreadNotifications,
    user,
    userLabel,
    walletBalance,
  } = useSiteRuntime();
  const { cartCount, openSidebar } = useCart();
  const { comparisonCount } = useComparison();
  const { favoriteCount } = useFavorites();
  const { themeLabel, toggleTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    function handleHeaderScroll() {
      setScrolled(window.scrollY > 60);
    }

    handleHeaderScroll();
    window.addEventListener("scroll", handleHeaderScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleHeaderScroll);
  }, []);

  useEffect(() => {
    function handleOpenSearch() {
      setSearchOpen(true);
    }

    function handleCloseOverlays() {
      setMenuOpen(false);
      setSearchOpen(false);
    }

    window.addEventListener("tz-open-global-search", handleOpenSearch);
    window.addEventListener("tz-close-overlays", handleCloseOverlays);

    return () => {
      window.removeEventListener("tz-open-global-search", handleOpenSearch);
      window.removeEventListener("tz-close-overlays", handleCloseOverlays);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const desktopLinks = [
    ...siteSettings.navigation.headerBefore,
    ...dynamicLinks.slice(0, 2),
    ...siteSettings.navigation.headerAfter,
  ];
  const mobileBaseLinks =
    siteSettings.navigation.mobilePrimary.length > 0
      ? siteSettings.navigation.mobilePrimary
      : [...siteSettings.navigation.headerBefore, ...siteSettings.navigation.headerAfter];
  const mobileLinks = [
    ...mobileBaseLinks,
    ...dynamicLinks.filter(
      (link) => !mobileBaseLinks.some((existingLink) => existingLink.href === link.href)
    ),
  ];
  const desktopLinksWithIcons = desktopLinks.map((link) => ({
    ...link,
    icon: resolveMobileMenuIcon(link.href),
  }));
  const brandName = siteSettings.company.name || "TechZone";
  const brandMark = getBrandMark(brandName);
  const socialLinks = getSocialLinks(siteSettings);
  const favoritesHref = authLoading ? "/auth/login" : user ? "/dashboard/favorites" : "/auth/login";
  function isPublicActive(href) {
    if (!href || href.includes("#")) return false;
    if (href === "/") return pathname === "/";
    if (href === "/products" && pathname?.startsWith("/category/")) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (pathname && pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
        <div className="nav-shell">
          <Link href="/" className="brand">
            <span className="brand-mark">{brandMark}</span>
            <span className="brand-text">{brandName}</span>
          </Link>

          <div className="nav-actions">
            <button
              type="button"
              className="nav-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-keyshortcuts="Control+K /"
              aria-label="فتح البحث العام"
            >
              <AppIcon name="search" size={18} />
              <span>ابحث في الموقع</span>
              <small>Ctrl + K</small>
            </button>

            <HeaderNotificationBell user={user} authLoading={authLoading} />

            <Link
              href={favoritesHref}
              className="nav-icon-btn nav-favorites-btn"
              aria-label="المفضلة"
              title="المفضلة"
            >
              <AppIcon name="heart" size={18} />
              {favoriteCount > 0 ? <span className="cart-badge">{favoriteCount}</span> : null}
            </Link>

            <button
              className="nav-icon-btn nav-cart-btn"
              onClick={openSidebar}
              aria-label="سلة التسوق"
            >
              <AppIcon name="cart" size={18} />
              {cartCount > 0 ? <span className="cart-badge is-bouncing">{cartCount}</span> : null}
            </button>

            {!authLoading
              ? user
                ? (
                  <Link href="/dashboard" className="cta-link">
                    <AppIcon name="dashboard" size={16} />
                    <span className="cta-link-label">{userLabel}</span>
                  </Link>
                )
                : (
                  <Link href="/auth/login" className="cta-link">
                    <AppIcon name="lock" size={16} />
                    <span className="cta-link-label">{userLabel}</span>
                  </Link>
                )
              : null}

            <button
              className="mobile-toggle"
              onClick={() => setMenuOpen((previousState) => !previousState)}
              aria-label="فتح القائمة"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          <nav className="main-nav" aria-label="روابط الموقع">
            {desktopLinksWithIcons.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className={isPublicActive(link.href) ? "is-active" : ""}
              >
                <span className="main-nav-link-icon" aria-hidden="true">
                  <AppIcon name={link.icon} size={16} />
                </span>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <MobileMenu
        compareCount={comparisonCount}
        favoriteCount={favoriteCount}
        links={mobileLinks}
        onClose={() => setMenuOpen(false)}
        onToggleTheme={toggleTheme}
        open={menuOpen}
        pathname={pathname || ""}
        socialLinks={socialLinks}
        themeLabel={themeLabel}
        unreadNotifications={unreadNotifications}
        user={user}
        userLabel={userLabel}
        walletBalance={walletBalance}
      />
      <Suspense fallback={null}>
        <GlobalSearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </Suspense>
    </>
  );
}
