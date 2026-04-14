"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";
import { useTheme } from "@/components/ThemeProvider";
import {
  KEYBOARD_SHORTCUT_ACTIONS,
  getKeyboardShortcutAction,
  isEditableKeyboardTarget,
} from "@/lib/keyboardShortcutsModel";

/**
 * Registers the shared storefront keyboard shortcuts.
 *
 * @returns {null}
 */
export default function KeyboardShortcuts() {
  const { closeSidebar, openSidebar, sidebarOpen } = useCart();
  const { toggleTheme } = useTheme();

  useEffect(() => {
    /**
     * Handles the active keyboard shortcuts when the user is not typing.
     *
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    function handleKeyDown(event) {
      const action = getKeyboardShortcutAction(event);
      const isEditableTarget = isEditableKeyboardTarget(event.target);

      if (!action || (isEditableTarget && action !== KEYBOARD_SHORTCUT_ACTIONS.close)) {
        return;
      }

      if (action === KEYBOARD_SHORTCUT_ACTIONS.search) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("tz-open-global-search"));
        return;
      }

      if (action === KEYBOARD_SHORTCUT_ACTIONS.close) {
        window.dispatchEvent(new CustomEvent("tz-close-overlays"));
        if (sidebarOpen) {
          event.preventDefault();
          closeSidebar();
        }
        return;
      }

      if (isEditableTarget) {
        return;
      }

      if (action === KEYBOARD_SHORTCUT_ACTIONS.cart) {
        event.preventDefault();
        if (!sidebarOpen) {
          openSidebar();
        }
        return;
      }

      if (action === KEYBOARD_SHORTCUT_ACTIONS.theme) {
        event.preventDefault();
        toggleTheme();
        return;
      }

      if (action === KEYBOARD_SHORTCUT_ACTIONS.promoNext) {
        window.dispatchEvent(new CustomEvent("tz-promo-banner-step", { detail: { direction: 1 } }));
        return;
      }

      if (action === KEYBOARD_SHORTCUT_ACTIONS.promoPrevious) {
        window.dispatchEvent(new CustomEvent("tz-promo-banner-step", { detail: { direction: -1 } }));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSidebar, openSidebar, sidebarOpen, toggleTheme]);

  return null;
}
