"use client";

import dynamic from "next/dynamic";
import ThemeProvider from "@/components/ThemeProvider";
import ToastProvider from "@/components/ToastProvider";
import CartProvider from "@/components/CartProvider";
import ComparisonProvider from "@/components/ComparisonProvider";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import FavoritesProvider from "@/components/FavoritesProvider";
import CartSidebar from "@/components/CartSidebar";
import DynamicFavicon from "@/components/DynamicFavicon";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import SiteRuntimeProvider from "@/components/SiteRuntimeProvider";
import ScrollProgress from "@/components/ScrollProgress";
import WelcomeOnboardingEntry from "@/components/WelcomeOnboardingEntry";
import WhatsappFloatingButton from "@/components/WhatsappFloatingButton";

const ComparisonDock = dynamic(() => import("@/components/ComparisonDock"), {
  loading: () => null,
  ssr: false,
});
const LiveChatWidget = dynamic(() => import("@/components/LiveChatWidget"), {
  loading: () => null,
  ssr: false,
});
const BackToTop = dynamic(() => import("@/components/BackToTop"), {
  loading: () => null,
  ssr: false,
});

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
                <ComparisonDock />
                <LiveChatWidget />
                <WhatsappFloatingButton />
                <BackToTop />
              </ToastProvider>
            </CartProvider>
          </ComparisonProvider>
        </FavoritesProvider>
      </SiteRuntimeProvider>
    </ThemeProvider>
  );
}
