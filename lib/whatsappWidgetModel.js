/**
 * Helpers used by the floating WhatsApp support widget.
 */

export const WHATSAPP_WELCOME_DELAY_MS = 5000;
export const WHATSAPP_WELCOME_AUTO_HIDE_MS = 7000;
export const WHATSAPP_WELCOME_SESSION_KEY = "tz_whatsapp_welcome_seen";
export const WHATSAPP_WELCOME_MESSAGE = "مرحباً! هل تحتاج مساعدة في اختيار المنتج المناسب؟";

/**
 * Determines whether the floating WhatsApp widget should render.
 *
 * @param {{
 *   href?: string | null,
 *   pathname?: string | null,
 * }} input
 * @returns {boolean}
 */
export function shouldRenderWhatsappWidget(input) {
  const href = String(input?.href || "").trim();
  const pathname = String(input?.pathname || "").trim();

  if (!href) {
    return false;
  }

  return !pathname.startsWith("/auth") && !pathname.startsWith("/admin");
}

/**
 * Determines whether the welcome bubble should be scheduled.
 *
 * @param {{
 *   hasSeenSession: boolean,
 *   href?: string | null,
 *   pathname?: string | null,
 * }} input
 * @returns {boolean}
 */
export function shouldScheduleWhatsappWelcome(input) {
  return !input?.hasSeenSession && shouldRenderWhatsappWidget(input);
}
