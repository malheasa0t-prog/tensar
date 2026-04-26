"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const WELCOME_MODAL_STORAGE_KEY = "tz_onboarding_seen";
const HIDDEN_PATH_PREFIXES = ["/admin", "/auth", "/checkout", "/compare", "/dashboard"];
const WelcomeOnboardingModal = lazy(() => import("@/components/WelcomeOnboardingModal"));

/**
 * Determines whether the onboarding modal chunk should be loaded for the current route.
 *
 * @param {string | null} pathname
 * @returns {boolean}
 */
function shouldLoadWelcomeOnboarding(pathname) {
  return Boolean(pathname) && !HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Lazily hydrates the onboarding modal only for first-time visitors on public pages.
 *
 * @returns {JSX.Element | null}
 */
export default function WelcomeOnboardingEntry() {
  const pathname = usePathname();
  const [shouldHydrate, setShouldHydrate] = useState(false);

  useEffect(() => {
    if (!shouldLoadWelcomeOnboarding(pathname)) {
      setShouldHydrate(false);
      return;
    }

    setShouldHydrate(window.localStorage.getItem(WELCOME_MODAL_STORAGE_KEY) !== "1");
  }, [pathname]);

  if (!shouldHydrate) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <WelcomeOnboardingModal />
    </Suspense>
  );
}
