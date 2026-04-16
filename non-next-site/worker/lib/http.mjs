/**
 * Builds one JSON response with standard content headers.
 *
 * @param {unknown} payload
 * @param {number} [status=200]
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

/**
 * Builds one JSON error response.
 *
 * @param {string} message
 * @param {number} [status=500]
 * @param {Record<string, unknown>} [extra]
 * @returns {Response}
 */
export function errorResponse(message, status = 500, extra = {}) {
  return jsonResponse({ success: false, error: message, ...extra }, status);
}

/**
 * Parses JSON safely and returns null for invalid payloads.
 *
 * @param {Request} request
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}
