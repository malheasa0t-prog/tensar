/**
 * Helpers for converting stored deposit-proof references into signed admin URLs.
 */

const DEPOSIT_PROOF_BUCKET = "deposits";
const DEPOSIT_PROOF_TTL_SECONDS = 3600;
const DEPOSIT_PUBLIC_PATH_PATTERN = /\/object\/(?:public|sign)\/deposits\/([^?]+)/i;
const DEPOSIT_STORAGE_URL_PATTERN = /\/object\/(?:public|sign)\/deposits\//i;
const SAFE_OBJECT_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/;

/**
 * Safely decodes a percent-encoded storage path.
 *
 * @param {string} value
 * @returns {string}
 */
function decodeStoragePath(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    void error;
    return "";
  }
}

/**
 * Normalizes and validates one Supabase Storage object path.
 *
 * @param {string} value
 * @returns {string}
 */
function sanitizeDepositProofPath(value) {
  const normalizedPath = decodeStoragePath(String(value || "").trim())
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const segments = normalizedPath.split("/");

  if (
    !SAFE_OBJECT_PATH_PATTERN.test(normalizedPath)
    || segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return "";
  }

  return normalizedPath;
}

/**
 * Extracts one storage object path from a stored proof reference.
 *
 * @param {unknown} proofReference
 * @returns {string}
 */
export function resolveDepositProofPath(proofReference) {
  const normalizedReference = String(proofReference || "").trim();
  if (!normalizedReference) {
    return "";
  }

  if (!/^https?:\/\//i.test(normalizedReference)) {
    return sanitizeDepositProofPath(normalizedReference);
  }

  const pathMatch = normalizedReference.match(DEPOSIT_PUBLIC_PATH_PATTERN);
  return pathMatch?.[1] ? sanitizeDepositProofPath(pathMatch[1]) : "";
}

/**
 * Builds one short-lived signed URL for a deposit proof.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {unknown} proofReference
 * @returns {Promise<string | null>}
 */
async function buildSignedDepositProofUrl(client, proofReference) {
  const objectPath = resolveDepositProofPath(proofReference);
  if (!objectPath) {
    const reference = String(proofReference || "").trim();
    return /^https?:\/\//i.test(reference) && !DEPOSIT_STORAGE_URL_PATTERN.test(reference)
      ? reference
      : null;
  }

  const { data, error } = await client.storage
    .from(DEPOSIT_PROOF_BUCKET)
    .createSignedUrl(objectPath, DEPOSIT_PROOF_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Rewrites stored deposit proof references to signed URLs for admin responses.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {unknown} rows
 * @returns {Promise<unknown>}
 */
export async function hydrateDepositProofUrls(client, rows) {
  if (Array.isArray(rows)) {
    return Promise.all(rows.map(async (row) => {
      if (!row || typeof row !== "object") {
        return row;
      }

      return {
        ...row,
        proof_url: await buildSignedDepositProofUrl(client, row.proof_url),
      };
    }));
  }

  if (!rows || typeof rows !== "object") {
    return rows;
  }

  return {
    ...rows,
    proof_url: await buildSignedDepositProofUrl(client, rows.proof_url),
  };
}
