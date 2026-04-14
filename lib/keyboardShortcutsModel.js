/**
 * Shared keyboard shortcut helpers for the public storefront.
 */

export const KEYBOARD_SHORTCUT_ACTIONS = Object.freeze({
  cart: "cart",
  close: "close",
  promoNext: "promo-next",
  promoPrevious: "promo-previous",
  search: "search",
  theme: "theme",
});

/**
 * Determines whether the pressed key uses blocking modifier keys.
 *
 * @param {{ altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean }} event
 * @returns {boolean}
 */
function hasBlockingModifier(event) {
  return Boolean(event?.altKey || event?.metaKey || event?.shiftKey);
}

/**
 * Checks whether the current focus target is an editable element.
 *
 * @param {EventTarget | null | undefined} target
 * @returns {boolean}
 */
export function isEditableKeyboardTarget(target) {
  return Boolean(
    target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT")
  );
}

/**
 * Resolves the matching shortcut action for a keyboard event.
 *
 * @param {{ altKey?: boolean, ctrlKey?: boolean, key?: string, metaKey?: boolean, shiftKey?: boolean }} event
 * @returns {string}
 */
export function getKeyboardShortcutAction(event) {
  const key = String(event?.key || "").toLowerCase();

  if (key === "escape") {
    return KEYBOARD_SHORTCUT_ACTIONS.close;
  }

  if ((event?.ctrlKey || event?.metaKey) && key === "k" && !event?.altKey) {
    return KEYBOARD_SHORTCUT_ACTIONS.search;
  }

  if (event?.ctrlKey || event?.metaKey || hasBlockingModifier(event)) {
    return "";
  }

  if (key === "/") {
    return KEYBOARD_SHORTCUT_ACTIONS.search;
  }

  if (key === "c") {
    return KEYBOARD_SHORTCUT_ACTIONS.cart;
  }

  if (key === "t") {
    return KEYBOARD_SHORTCUT_ACTIONS.theme;
  }

  if (key === "arrowright") {
    return KEYBOARD_SHORTCUT_ACTIONS.promoNext;
  }

  if (key === "arrowleft") {
    return KEYBOARD_SHORTCUT_ACTIONS.promoPrevious;
  }

  return "";
}
