"use client";

import { useEffect, useMemo, useRef } from "react";
import { useCart } from "@/components/CartProvider";
import { useSiteRuntime } from "@/components/SiteRuntimeProvider";
import { buildDynamicFaviconState } from "@/lib/dynamicFaviconModel";

const DEFAULT_FAVICON_PATH = "/favicon.svg";
const FAVICON_SIZE = 64;

/**
 * Draws the current dynamic favicon on a reusable offscreen canvas.
 *
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   state: { badgeText: string, hasNotificationDot: boolean }
 * }} options
 * @returns {string}
 */
function drawDynamicFavicon({ canvas, state }) {
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    return DEFAULT_FAVICON_PATH;
  }

  context.clearRect(0, 0, FAVICON_SIZE, FAVICON_SIZE);
  context.fillStyle = "#0b1020";
  context.beginPath();
  context.roundRect(4, 4, 56, 56, 18);
  context.fill();

  const gradient = context.createLinearGradient(8, 8, 56, 56);
  gradient.addColorStop(0, "#8338ec");
  gradient.addColorStop(1, "#00d9ff");
  context.fillStyle = gradient;
  context.font = "800 28px Inter, Cairo, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("TZ", 32, 33);

  if (state.badgeText) {
    context.fillStyle = "#f97316";
    context.beginPath();
    context.arc(49, 49, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "700 12px Inter, Cairo, sans-serif";
    context.fillText(state.badgeText, 49, 49);
  }

  if (state.hasNotificationDot) {
    context.fillStyle = "#ef4444";
    context.beginPath();
    context.arc(49, 14, 7, 0, Math.PI * 2);
    context.fill();
  }

  return canvas.toDataURL("image/png");
}

/**
 * Keeps the browser tab favicon aligned with cart and notification state.
 *
 * @returns {null}
 */
export default function DynamicFavicon() {
  const { cartCount } = useCart();
  const { unreadNotifications } = useSiteRuntime();
  const canvasRef = useRef(null);
  const previousStateKeyRef = useRef("");
  const faviconState = useMemo(
    () =>
      buildDynamicFaviconState({
        cartCount,
        unreadCount: unreadNotifications,
      }),
    [cartCount, unreadNotifications]
  );

  useEffect(() => {
    const nextStateKey = `${faviconState.badgeText}:${faviconState.hasNotificationDot ? "1" : "0"}`;

    if (previousStateKeyRef.current === nextStateKey) {
      return;
    }

    previousStateKeyRef.current = nextStateKey;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;
    const linkElement = document.querySelector('link[rel="icon"]') || document.createElement("link");
    const nextHref =
      faviconState.badgeText || faviconState.hasNotificationDot
        ? drawDynamicFavicon({ canvas, state: faviconState })
        : DEFAULT_FAVICON_PATH;

    linkElement.setAttribute("rel", "icon");
    if (linkElement.getAttribute("href") !== nextHref) {
      linkElement.setAttribute("href", nextHref);
    }

    if (!linkElement.parentNode) {
      document.head.appendChild(linkElement);
    }
  }, [faviconState]);

  return null;
}
