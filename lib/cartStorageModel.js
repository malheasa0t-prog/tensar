/**
 * Cart storage ownership helpers.
 */

const CART_STORAGE_PREFIX = "tz_next_cart";
const CART_GUEST_OWNER_KEY = "guest";

/**
 * Resolves the cart owner key from an auth session snapshot.
 *
 * @param {{ user?: { id?: string | null } | null } | null | undefined} session
 * @returns {string}
 */
export function resolveCartOwnerKey(session) {
  const userId = String(session?.user?.id || "").trim();
  return userId ? `user:${userId}` : CART_GUEST_OWNER_KEY;
}

/**
 * Builds the localStorage key for one cart owner.
 *
 * @param {string} ownerKey
 * @returns {string}
 */
export function buildCartStorageKey(ownerKey) {
  const normalizedOwnerKey = String(ownerKey || CART_GUEST_OWNER_KEY).trim() || CART_GUEST_OWNER_KEY;
  return `${CART_STORAGE_PREFIX}:${normalizedOwnerKey}`;
}

/**
 * Parses stored cart JSON into a safe item array.
 *
 * @param {string | null | undefined} rawValue
 * @returns {Array<Record<string, unknown>>}
 */
export function parseStoredCartItems(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch (error) {
    void error;
    return [];
  }
}

export {
  CART_GUEST_OWNER_KEY,
  CART_STORAGE_PREFIX,
};
