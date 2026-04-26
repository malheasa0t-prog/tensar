"use client";

import { lazy, Suspense } from "react";
import ThemeProvider from "@/components/ThemeProvider";
import ToastProvider from "@/components/ToastProvider";
import CartProvider from "@/components/CartProvider";
import ComparisonProvider from "@/components/ComparisonProvider";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import FavoritesProvider from "@/components/FavoritesProvider";
import CartSidebar from "@/components/CartSidebar";
import DynamicFavicon from "@/components/DynamicFavicon";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import SeoProvider from "@/components/SeoProvider";
import SiteRuntimeProvider from "@/components/SiteRuntimeProvider";
import ScrollProgress from "@/components/ScrollProgress";
import WelcomeOnboardingEntry from "@/components/WelcomeOnboardingEntry";
import WhatsappFloatingButton from "@/components/WhatsappFloatingButton";

const ComparisonDock = lazy(() => import("@/components/ComparisonDock"));
const LiveChatWidget = lazy(() => import("@/components/LiveChatWidget"));
const BackToTop = lazy(() => import("@/components/BackToTop"));

export default function ClientProviders({
  children,
  initialDynamicLinks,
  initialSiteSettings,
}) {
  return (
    <ThemeProvider>
      <AnalyticsProvider />
      <SiteRuntimeProvider
        initialDynamicLinks={initialDynamicLinks}
        initialSiteSettings={initialSiteSettings}
      >
        <SeoProvider>
          <FavoritesProvider>
            <ComparisonProvider>
              <CartProvider>
                <ToastProvider>
                  <KeyboardShortcuts />
                  <DynamicFavicon />
                  <ScrollProgress />
                  {children}
                  <WelcomeOnboardingEntry />
                  <CartSidebar />
                  <Suspense fallback={null}>
                    <ComparisonDock />
                  </Suspense>
                  <Suspense fallback={null}>
                    <LiveChatWidget />
                  </Suspense>
                  <WhatsappFloatingButton />
                  <Suspense fallback={null}>
                    <BackToTop />
                  </Suspense>
                </ToastProvider>
              </CartProvider>
            </ComparisonProvider>
          </FavoritesProvider>
        </SeoProvider>
      </SiteRuntimeProvider>
    </ThemeProvider>
  );
}
