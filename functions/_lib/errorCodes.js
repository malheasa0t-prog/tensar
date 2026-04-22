/**
 * Shared error-code helpers for Cloudflare Pages Functions.
 */

const ERROR_CODE_PATTERN = /\[([A-Z]{2,4}-\d{3})\]/;
const FALLBACK_ERROR_MESSAGE = "Unknown error";

/**
 * Extracts a standardized error code from a message-like value.
 *
 * @param {unknown} value - Message or error-like value to inspect.
 * @returns {string | null} The extracted code, or null when absent.
 */
export function extractErrorCode(value) {
  const message = typeof value === "string"
    ? value
    : value instanceof Error
      ? value.message
      : String(value ?? "");
  const match = message.match(ERROR_CODE_PATTERN);
  return match ? match[1] : null;
}

/**
 * Prefixes a message with its standardized error code.
 *
 * @param {string} code - Module-scoped error code (for example CHK-500).
 * @param {string} message - Human-readable Arabic or English message.
 * @returns {string} Formatted error message.
 */
export function formatErrorMessage(code, message) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const normalizedMessage = String(message || "").trim();
  return normalizedCode
    ? `[${normalizedCode}] ${normalizedMessage}`
    : normalizedMessage || FALLBACK_ERROR_MESSAGE;
}

/**
 * Builds the standard JSON payload for API error responses.
 *
 * @param {unknown} error - Message or error-like value to serialize.
 * @returns {{ success: false, error: string, code?: string }} Response payload.
 */
export function buildErrorPayload(error) {
  const normalizedError = typeof error === "string"
    ? error.trim()
    : error instanceof Error
      ? String(error.message || "").trim()
      : String(error ?? "").trim();
  const errorMessage = normalizedError || FALLBACK_ERROR_MESSAGE;
  const code = extractErrorCode(errorMessage);

  return code
    ? { success: false, error: errorMessage, code }
    : { success: false, error: errorMessage };
}
