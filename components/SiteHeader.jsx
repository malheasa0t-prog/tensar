"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MobileMenu from "./MobileMenu";
import { useTheme } from "./ThemeProvider";
import { useCart } from "./CartProvider";
import { supabase } from "@/lib/supabaseClient";
import AppIcon from "./AppIcon";
import { getBrandMark, normalizeSiteSettings } from "@/lib/contactChannels";

const DEFAULT_SITE_SETTINGS = normalizeSiteSettings();

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dynamicLinks, setDynamicLinks] = useState([]);
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [marqueeSettings, setMarqueeSettings] = useState(DEFAULT_SITE_SETTINGS.homepage.marquee);
  const [user, setUser] = useState(null);
  const [userLabel, setUserLabel] = useState("لوحتي");
  const [authLoading, setAuthLoading] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const { cartCount, openSidebar } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    async function fetchHeaderData() {
      const [{ data, error }, { data: settingsData }] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .is("parent_id", null)
          .order("sort_order", { ascending: true }),
        supabase.from("settings").select("data").limit(1).maybeSingle(),
      ]);

      const normalizedSettings = normalizeSiteSettings(settingsData?.data || {});
      setSiteSettings(normalizedSettings);
      setMarqueeSettings(normalizedSettings.homepage.marquee);

      if (!error && data) {
        const navMap = normalizedSettings.categoryNavVisibility || {};
        const mappedLinks = data
          .filter((category) => {
            const isActive = (category.status || "active") === "active";
            const bySettings = Object.prototype.hasOwnProperty.call(navMap, category.id)
              ? navMap[category.id] !== false
              : true;
            const byCategory =
              category.show_in_navbar !== false &&
              category.show_in_nav !== false &&
              category.showInNavbar !== false;

            return isActive && bySettings && byCategory;
          })
          .map((category) => ({
            href: `/category/${category.slug || category.id}`,
            label: category.name,
            id: category.id,
          }));

        setDynamicLinks(mappedLinks);
      }
    }

    async function checkAuth() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        const metadataName =
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.user_metadata?.display_name ||
          "";

        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("full_name")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        const fallbackName = currentUser.email ? currentUser.email.split("@")[0] : "حسابي";
        setUserLabel((profileData?.full_name || metadataName || fallbackName).trim() || "حسابي");
      } else {
        setUserLabel("لوحتي");
      }

      setUser(currentUser || null);
      setAuthLoading(false);
    }

    fetchHeaderData();
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const desktopLinks = [
    ...siteSettings.navigation.headerBefore,
    ...dynamicLinks.slice(0, 3),
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
  const marqueeItems = marqueeSettings?.items || [];
  const renderedMarqueeItems = marqueeItems.length > 0 ? [...marqueeItems, ...marqueeItems] : [];
  const showMarquee = pathname === "/" && marqueeSettings?.enabled !== false && marqueeItems.length > 0;
  const brandName = siteSettings.company.name || "TechZone";
  const brandMark = getBrandMark(brandName);

  const isPublicActive = (href) => {
    if (!href || href.includes("#")) return false;
    if (href === "/") return pathname === "/";
    if (href === "/products" && pathname?.startsWith("/category/")) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (pathname && (pathname.startsWith("/admin") || pathname.startsWith("/dashboard/admin"))) {
    return null;
  }

  return (
    <>
      <header className="site-header">
        <div className="container nav-shell">
          <Link href="/" className="brand">
            <span className="brand-mark">{brandMark}</span>
            <span className="brand-text">{brandName}</span>
          </Link>

          <nav className="main-nav" aria-label="روابط الموقع">
            {desktopLinks.map((link) => (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                className={isPublicActive(link.href) ? "is-active" : ""}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="nav-actions">
            <button className="nav-icon-btn" onClick={openSidebar} aria-label="سلة التسوق">
              <AppIcon name="cart" size={18} />
              {cartCount > 0 ? <span className="cart-badge">{cartCount}</span> : null}
            </button>

            <button
              className="nav-icon-btn"
              onClick={toggleTheme}
              aria-label="تبديل الوضع"
              title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
            >
              <AppIcon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>

            {!authLoading
              ? user
                ? (
                  <Link
                    href="/dashboard"
                    className="cta-link"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <AppIcon name="dashboard" size={16} />
                    {userLabel}
                  </Link>
                )
                : (
                  <Link
                    href="/auth/login"
                    className="cta-link"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <AppIcon name="lock" size={16} />
                    دخول
                  </Link>
                )
              : null}

            <button
              className="mobile-toggle"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="فتح القائمة"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu links={mobileLinks} open={menuOpen} onClose={() => setMenuOpen(false)} />

      {showMarquee ? (
        <div className="marquee-banner">
          <div className="marquee-content">
            {renderedMarqueeItems.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
