/**
 * Helpers for converting stored deposit-proof references into signed admin URLs.
 */

const DEPOSIT_PROOF_BUCKET = "deposits";
const DEPOSIT_PROOF_TTL_SECONDS = 3600;
const DEPOSIT_PUBLIC_PATH_PATTERN = /\/object\/(?:public|sign)\/deposits\/([^?]+)/i;

/**
 * Extracts one storage object path from a stored proof reference.
 *
 * @param {unknown} proofReference
 * @returns {string}
 */
function resolveDepositProofPath(proofReference) {
  const normalizedReference = String(proofReference || "").trim();
  if (!normalizedReference) {
    return "";
  }

  if (!/^https?:\/\//i.test(normalizedReference)) {
    return normalizedReference;
  }

  const pathMatch = normalizedReference.match(DEPOSIT_PUBLIC_PATH_PATTERN);
  return pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : "";
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
    return /^https?:\/\//i.test(String(proofReference || "").trim())
      ? String(proofReference).trim()
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
