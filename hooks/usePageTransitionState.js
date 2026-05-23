"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  PAGE_TRANSITION_ENTER_MS,
  PAGE_TRANSITION_EXIT_MS,
  buildRouteKey,
  resolveRouteTransition,
} from "@/lib/pageTransitionModel";
import { prefetchRouteModule } from "@/src/routePrefetch";

/**
 * Clears an active timeout reference if one exists.
 *
 * @param {{ current: number | null }} timerRef
 * @returns {void}
 */
function clearTimer(timerRef) {
  if (typeof window !== "undefined" && timerRef.current) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

/**
 * Watches the reduced-motion preference and exposes its latest value.
 *
 * @returns {boolean}
 */
function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

/**
 * Manages the global route transition state for the shared app shell.
 *
 * @returns {{
 *   phase: "idle" | "exit" | "enter",
 *   routeKey: string,
 *   pendingDestination: string,
 *   prefersReducedMotion: boolean,
 * }}
 */
export default function usePageTransitionState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotionPreference();
  const pendingTimerRef = useRef(null);
  const enterTimerRef = useRef(null);
  const [phase, setPhase] = useState(PAGE_TRANSITION_ENTER_MS > 0 ? "enter" : "idle");
  const [pendingDestination, setPendingDestination] = useState("");
  const search = searchParams?.toString() || "";
  const routeKey = useMemo(() => buildRouteKey({ pathname, search }), [pathname, search]);

  useEffect(() => {
    clearTimer(enterTimerRef);
    setPendingDestination("");

    if (prefersReducedMotion || PAGE_TRANSITION_ENTER_MS <= 0) {
      setPhase("idle");
      return undefined;
    }

    setPhase("enter");
    enterTimerRef.current = window.setTimeout(() => setPhase("idle"), PAGE_TRANSITION_ENTER_MS);
    return () => clearTimer(enterTimerRef);
  }, [prefersReducedMotion, routeKey]);

  useEffect(() => {
    if (prefersReducedMotion) {
      return undefined;
    }

    const handleClick = (event) => handleNavigationIntent({ event, routeKey, router, setPhase, setPendingDestination, pendingTimerRef });
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [prefersReducedMotion, routeKey, router]);

  useEffect(() => () => clearTimer(pendingTimerRef), []);

  return {
    phase,
    routeKey,
    pendingDestination,
    prefersReducedMotion,
  };
}

/**
 * Starts the exit animation and forwards the navigation to the Next router.
 *
 * @param {{
 *   event: MouseEvent,
 *   routeKey: string,
 *   router: ReturnType<typeof useRouter>,
 *   setPhase: React.Dispatch<React.SetStateAction<"idle" | "exit" | "enter">>,
 *   setPendingDestination: React.Dispatch<React.SetStateAction<string>>,
 *   pendingTimerRef: { current: number | null },
 * }} input
 * @returns {void}
 */
function handleNavigationIntent(input) {
  if (!(input.event.target instanceof Element)) {
    return;
  }

  const anchor = input.event.target.closest("a[href]");

  if (!(anchor instanceof HTMLAnchorElement)) {
    return;
  }

  const result = resolveRouteTransition({
    anchorAttributes: {
      href: anchor.getAttribute("href") || anchor.href,
      target: anchor.target,
      rel: anchor.rel,
      download: anchor.hasAttribute("download"),
      isAriaDisabled: anchor.getAttribute("aria-disabled") === "true",
      skipTransition: anchor.dataset.noTransition === "true",
    },
    clickDetails: {
      button: input.event.button,
      metaKey: input.event.metaKey,
      ctrlKey: input.event.ctrlKey,
      shiftKey: input.event.shiftKey,
      altKey: input.event.altKey,
    },
    currentRoute: input.routeKey,
    origin: window.location.origin,
  });

  if (!result.shouldIntercept || !result.destination) {
    return;
  }

  input.event.preventDefault();
  clearTimer(input.pendingTimerRef);

  /* Start loading the destination chunk immediately, in parallel with navigation */
  void prefetchRouteModule(result.destination);

  input.setPendingDestination(result.destination);
  input.setPhase("exit");
  startTransition(() => input.router.push(result.destination));
}
