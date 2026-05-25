"use client";

import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Returns the focusable descendants of the given container, in DOM order.
 *
 * @param {HTMLElement | null} container - Modal root element.
 * @returns {HTMLElement[]} Focusable elements ready to receive Tab navigation.
 */
function getFocusableElements(container) {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
  return nodes.filter((node) => {
    if (node.hasAttribute("disabled")) return false;
    if (node.getAttribute("aria-hidden") === "true") return false;
    if (node.tabIndex === -1) return false;
    return Boolean(node.offsetParent || node === document.activeElement);
  });
}

/**
 * Wires shared modal accessibility behaviour to a container ref.
 *
 * - Moves focus to the first focusable element on open (or to the container
 *   itself when none exists).
 * - Traps Tab/Shift+Tab so focus cannot leak to the page behind.
 * - Invokes `onClose` when the user presses Escape.
 * - Restores focus to the element that opened the modal on close.
 *
 * Components remain responsible for `role="dialog"` and `aria-modal="true"`
 * markup — this hook only handles the dynamic behaviour.
 *
 * @param {{
 *   isOpen: boolean,
 *   containerRef: { current: HTMLElement | null },
 *   onClose: () => void,
 *   initialFocusRef?: { current: HTMLElement | null },
 *   restoreFocus?: boolean,
 * }} input - Hook input.
 * @returns {{ handleKeyDown: (event: React.KeyboardEvent) => void }} Helpers to bind on the modal root.
 */
export function useModalAccessibility({
  isOpen,
  containerRef,
  onClose,
  initialFocusRef,
  restoreFocus = true,
}) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return undefined;
    }

    previouslyFocusedRef.current = document.activeElement;

    const focusInitial = () => {
      const explicitTarget = initialFocusRef?.current;
      if (explicitTarget && typeof explicitTarget.focus === "function") {
        explicitTarget.focus();
        return;
      }
      const focusables = getFocusableElements(containerRef.current);
      const fallback = focusables[0] || containerRef.current;
      if (fallback && typeof fallback.focus === "function") {
        fallback.focus({ preventScroll: false });
      }
    };

    const rafId = window.requestAnimationFrame(focusInitial);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (!restoreFocus) return;
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === "function") {
        previous.focus({ preventScroll: false });
      }
    };
  }, [containerRef, initialFocusRef, isOpen, restoreFocus]);

  const handleKeyDown = useCallback(
    (event) => {
      if (!isOpen) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = getFocusableElements(containerRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        containerRef.current?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [containerRef, isOpen, onClose]
  );

  return { handleKeyDown };
}
