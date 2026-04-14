export const TOAST_DEFAULT_DURATION = 3200;
export const TOAST_MIN_DURATION = 1800;
export const TOAST_MAX_DURATION = 9000;
export const TOAST_DEFAULT_TYPE = "info";

export const TOAST_VARIANTS = Object.freeze({
  success: {
    icon: "badge-check",
    title: "نجاح",
  },
  error: {
    icon: "circle-alert",
    title: "خطأ",
  },
  warning: {
    icon: "triangle-alert",
    title: "تنبيه",
  },
  info: {
    icon: "info",
    title: "معلومة",
  },
});

/**
 * Clamps the toast duration inside the supported visual range.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeToastDuration(value) {
  const duration = Number(value);

  if (!Number.isFinite(duration)) {
    return TOAST_DEFAULT_DURATION;
  }

  return Math.min(TOAST_MAX_DURATION, Math.max(TOAST_MIN_DURATION, Math.round(duration)));
}

/**
 * Resolves the supported toast type.
 *
 * @param {unknown} value
 * @returns {"success" | "error" | "warning" | "info"}
 */
export function normalizeToastType(value) {
  const type = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TOAST_VARIANTS, type) ? type : TOAST_DEFAULT_TYPE;
}

/**
 * Normalizes a toast request into a render-ready object.
 *
 * @param {string} message
 * @param {number | { duration?: unknown, title?: unknown, type?: unknown }} [options]
 * @returns {{
 *   duration: number,
 *   message: string,
 *   title: string,
 *   type: "success" | "error" | "warning" | "info",
 *   icon: string,
 * }}
 */
export function normalizeToastPayload(message, options = {}) {
  const normalizedMessage = String(message || "").trim();
  const normalizedOptions =
    typeof options === "number"
      ? { duration: options }
      : options && typeof options === "object"
        ? options
        : {};
  const type = normalizeToastType(normalizedOptions.type);
  const variant = TOAST_VARIANTS[type];
  const title = String(normalizedOptions.title || variant.title).trim() || variant.title;

  return {
    duration: normalizeToastDuration(normalizedOptions.duration),
    message: normalizedMessage,
    title,
    type,
    icon: variant.icon,
  };
}
