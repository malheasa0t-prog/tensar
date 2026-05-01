/**
 * Helpers for normalizing Supabase auth errors.
 */

/**
 * Checks whether Supabase reported the expected guest-session state.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isMissingAuthSessionError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "").toLowerCase();

  return name === "AuthSessionMissingError" || message.includes("auth session missing");
}
