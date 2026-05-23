"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import ThemeProvider from "@/components/ThemeProvider";
import ToastProvider from "@/components/ToastProvider";
import CartProvider, { useCart } from "@/components/CartProvider";
import ComparisonProvider from "@/components/ComparisonProvider";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import FavoritesProvider from "@/components/FavoritesProvider";
import DynamicFavicon from "@/components/DynamicFavicon";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import SeoProvider from "@/components/SeoProvider";
import SiteRuntimeProvider from "@/components/SiteRuntimeProvider";
import ScrollProgress from "@/components/ScrollProgress";
import WelcomeOnboardingEntry from "@/components/WelcomeOnboardingEntry";
import WhatsappFloatingButton from "@/components/WhatsappFloatingButton";
import MaintenanceGate from "@/components/MaintenanceGate";

const ComparisonDock = lazy(() => import("@/components/ComparisonDock"));
const LiveChatWidget = lazy(() => import("@/components/LiveChatWidget"));
const BackToTop = lazy(() => import("@/components/BackToTop"));
const CartSidebar = lazy(() => import("@/components/CartSidebar"));
const DEFERRED_GLOBAL_WIDGET_TIMEOUT_MS = 2500;

/**
 * Enables non-critical floating widgets after navigation-critical work settles.
 *
 * @returns {boolean}
 */
function useDeferredGlobalWidgets() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let idleCallbackId = 0;
    let timeoutId = 0;

    /**
     * Allows global widgets to mount once the browser has breathing room.
     *
     * @returns {void}
     */
    function enableWidgets() {
      setEnabled(true);
    }

    if (typeof window.requestIdleCallback === "function") {
      idleCallbackId = window.requestIdleCallback(enableWidgets, {
        timeout: DEFERRED_GLOBAL_WIDGET_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(enableWidgets, DEFERRED_GLOBAL_WIDGET_TIMEOUT_MS);
    }

    return () => {
      if (idleCallbackId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return enabled;
}

/**
 * Loads the cart sidebar chunk only when the user opens the cart.
 *
 * @returns {JSX.Element | null}
 */
function CartSidebarSlot() {
  const cart = useCart();

  if (!cart?.sidebarOpen) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <CartSidebar />
    </Suspense>
  );
}

export default function ClientProviders({
  children,
  initialDynamicLinks,
  initialSiteSettings,
}) {
  const deferredGlobalWidgetsEnabled = useDeferredGlobalWidgets();

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
                  <MaintenanceGate>
                    {children}
                  </MaintenanceGate>
                  <CartSidebarSlot />
                  {deferredGlobalWidgetsEnabled ? <WelcomeOnboardingEntry /> : null}
                  <WhatsappFloatingButton />
                  {deferredGlobalWidgetsEnabled ? (
                    <>
                      <Suspense fallback={null}>
                        <ComparisonDock />
                      </Suspense>
                      <Suspense fallback={null}>
                        <LiveChatWidget />
                      </Suspense>
                      <Suspense fallback={null}>
                        <BackToTop />
                      </Suspense>
                    </>
                  ) : null}
                </ToastProvider>
              </CartProvider>
            </ComparisonProvider>
          </FavoritesProvider>
        </SeoProvider>
      </SiteRuntimeProvider>
    </ThemeProvider>
  );
}
