/**
 * Browser idempotency-key helpers.
 */

const IDEMPOTENCY_FALLBACK_BYTES = 16;

/**
 * Generates a UUID v4 compatible idempotency key for retry-safe POST requests.
 *
 * @returns {string} UUID v4 string.
 */
export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("[IDM-501] Secure random generator is unavailable.");
  }

  const bytes = new Uint8Array(IDEMPOTENCY_FALLBACK_BYTES);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
