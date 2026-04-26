import { validateDepositProofFile } from "./depositProofUploadService.js";

const INVALID_SESSION_MESSAGE = "[DPT-201] تعذر التحقق من جلسة تسجيل الدخول لرفع إثبات الإيداع.";
const PROOF_UPLOAD_ERROR_MESSAGE = "[DPT-301] تعذر رفع صورة الإثبات حالياً.";

/**
 * Uploads a deposit proof image through the authenticated API endpoint.
 *
 * @param {{ client: { auth: { getSession: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } }, proofFile?: File | null }} input
 * @returns {Promise<string | null>}
 * @throws {Error}
 */
export async function uploadDepositProof({ client, proofFile }) {
  if (!proofFile) {
    return null;
  }

  const validationError = validateDepositProofFile(proofFile);
  if (validationError) {
    throw new Error(validationError);
  }

  const sessionResponse = await client.auth.getSession();
  const accessToken = String(sessionResponse?.data?.session?.access_token || "").trim();
  if (!accessToken) {
    throw new Error(INVALID_SESSION_MESSAGE);
  }

  const formData = new FormData();
  formData.set("proof", proofFile);

  const response = await fetch("/api/deposits/proof", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || PROOF_UPLOAD_ERROR_MESSAGE);
  }

  return payload?.data?.objectPath || null;
}
