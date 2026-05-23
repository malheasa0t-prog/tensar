"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";
import { useComparison } from "./ComparisonProvider";
import { useFavorites } from "./FavoritesProvider";
import { useSiteRuntime } from "./SiteRuntimeProvider";
import { useTheme } from "./ThemeProvider";
import AppIcon from "./AppIcon";
import HeaderNotificationBell from "./HeaderNotificationBell";
import HeaderWalletBadge from "./HeaderWalletBadge";
import { getBrandMark, getSocialLinks, normalizeSiteSettings } from "@/lib/contactChannels";
import { resolveMobileMenuIcon } from "@/lib/mobileMenuModel";
import { prefetchRouteModule, shouldPrefetchRoute } from "@/src/routePrefetch";

const GlobalSearchOverlay = lazy(() => import("./GlobalSearchOverlay"));
const MobileMenu = lazy(() => import("./MobileMenu"));

const DEFAULT_SITE_SETTINGS = normalizeSiteSettings();
const DESKTOP_SIDEBAR_MEDIA_QUERY = "(min-width: 1024px)";
const HEADER_SCROLL_THRESHOLD_PX = 60;
const HEADER_ROUTE_PREFETCH_IDLE_TIMEOUT_MS = 1200;

/**
 * Determines whether the header should use the compact scrolled state.
 *
 * @returns {boolean}
 */
function shouldCompactHeaderOnScroll() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return !window.matchMedia(DESKTOP_SIDEBAR_MEDIA_QUERY).matches;
}

/**
 * Starts loading the search overlay before the click path needs it.
 *
 * @returns {void}
 */
function prefetchGlobalSearchOverlay() {
  void import("./GlobalSearchOverlay");
}

/**
 * Starts loading the mobile menu before the click path needs it.
 *
 * @returns {void}
 */
function prefetchMobileMenu() {
  void import("./MobileMenu");
}

/**
 * Starts loading the cart sidebar before the first open interaction.
 *
 * @returns {void}
 */
function prefetchCartSidebar() {
  void import("./CartSidebar");
}

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
      if (!shouldCompactHeaderOnScroll()) {
        setScrolled(false);
        return;
      }

      setScrolled(window.scrollY > HEADER_SCROLL_THRESHOLD_PX);
    }

    const desktopSidebarQuery = window.matchMedia(DESKTOP_SIDEBAR_MEDIA_QUERY);

    handleHeaderScroll();
    window.addEventListener("scroll", handleHeaderScroll, { passive: true });

    if (typeof desktopSidebarQuery.addEventListener === "function") {
      desktopSidebarQuery.addEventListener("change", handleHeaderScroll);
      return () => {
        window.removeEventListener("scroll", handleHeaderScroll);
        desktopSidebarQuery.removeEventListener("change", handleHeaderScroll);
      };
    }

    desktopSidebarQuery.addListener(handleHeaderScroll);
    return () => {
      window.removeEventListener("scroll", handleHeaderScroll);
      desktopSidebarQuery.removeListener(handleHeaderScroll);
    };
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

  const hasDynamicCategoryLinks = dynamicLinks.length > 0;
  const desktopBaseLinks = hasDynamicCategoryLinks
    ? siteSettings.navigation.headerBefore
    : siteSettings.navigation.headerBefore;
  const desktopLinks = [
    ...desktopBaseLinks,
    ...dynamicLinks,
    ...siteSettings.navigation.headerAfter,
  ];
  const mobileLinks = siteSettings.navigation.mobilePrimary.length > 0
    ? [
        ...siteSettings.navigation.mobilePrimary,
        ...dynamicLinks.filter(
          (link) => !siteSettings.navigation.mobilePrimary.some((existing) => existing.href === link.href)
        ),
      ]
    : [
        ...siteSettings.navigation.headerBefore,
        ...dynamicLinks,
        ...siteSettings.navigation.headerAfter,
      ];
  const headerPrefetchKey = desktopLinks
    .map((link) => link.href)
    .filter((href, index, hrefs) => shouldPrefetchRoute(href) && hrefs.indexOf(href) === index)
    .join("|");
  const desktopLinksWithIcons = desktopLinks.map((link) => ({
    ...link,
    icon: resolveMobileMenuIcon(link.href),
  }));
  const brandName = siteSettings.company.name || "TechZone";
  const brandMark = getBrandMark(brandName);
  const socialLinks = getSocialLinks(siteSettings);
  const favoritesHref = authLoading ? "/auth/login" : user ? "/dashboard/favorites" : "/auth/login";

  useEffect(() => {
    if (!headerPrefetchKey) {
      return undefined;
    }

    let idleCallbackId = 0;
    let timeoutId = 0;

    function warmHeaderRoutes() {
      const headerHrefs = headerPrefetchKey.split("|");

      for (const href of headerHrefs) {
        void prefetchRouteModule(href, { includeData: false });
      }

      prefetchGlobalSearchOverlay();
      prefetchMobileMenu();
      prefetchCartSidebar();
    }

    if (typeof window.requestIdleCallback === "function") {
      idleCallbackId = window.requestIdleCallback(warmHeaderRoutes, {
        timeout: HEADER_ROUTE_PREFETCH_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(warmHeaderRoutes, HEADER_ROUTE_PREFETCH_IDLE_TIMEOUT_MS);
    }

    return () => {
      if (idleCallbackId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [headerPrefetchKey]);

  function isPublicActive(href) {
    if (!href || href.includes("#")) return false;
    if (href === "/") return pathname === "/";
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
              onFocus={prefetchGlobalSearchOverlay}
              onMouseEnter={prefetchGlobalSearchOverlay}
              onTouchStart={prefetchGlobalSearchOverlay}
              aria-label="فتح البحث العام"
            >
              <AppIcon name="search" size={18} />
              <span>ابحث في الموقع</span>
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
              onFocus={prefetchCartSidebar}
              onMouseEnter={prefetchCartSidebar}
              onTouchStart={prefetchCartSidebar}
              aria-label="سلة التسوق"
            >
              <AppIcon name="cart" size={18} />
              {cartCount > 0 ? <span className="cart-badge is-bouncing">{cartCount}</span> : null}
            </button>

            <HeaderWalletBadge balance={walletBalance} user={user} />

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
              onFocus={prefetchMobileMenu}
              onMouseEnter={prefetchMobileMenu}
              onTouchStart={prefetchMobileMenu}
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

      {menuOpen ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}
      {searchOpen ? (
        <Suspense fallback={null}>
          <GlobalSearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
