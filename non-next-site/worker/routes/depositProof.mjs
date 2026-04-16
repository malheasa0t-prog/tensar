import {
  uploadDepositProofFile,
  validateDepositProofFile
} from "../../../services/depositProofUploadService.js";

import { getUserFromRequest } from "../lib/auth.mjs";
import { createAdminSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse } from "../lib/http.mjs";

const INVALID_PROOF_REQUEST_MESSAGE = "ملف إثبات الإيداع غير صالح.";
const PROOF_UPLOAD_ERROR_MESSAGE = "تعذر رفع صورة الإثبات حاليًا.";

/**
 * Uploads one deposit proof file through the worker.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleDepositProofRequest(request, env) {
  const { error, user } = await getUserFromRequest(request, env);
  if (error || !user) {
    return errorResponse("Unauthorized", 401);
  }

  let formData = null;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(INVALID_PROOF_REQUEST_MESSAGE, 400);
  }

  const proofFile = formData.get("proof");
  if (!proofFile || typeof proofFile !== "object" || typeof proofFile.arrayBuffer !== "function") {
    return errorResponse(INVALID_PROOF_REQUEST_MESSAGE, 400);
  }

  const validationError = validateDepositProofFile(proofFile);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  try {
    const adminClient = createAdminSupabaseClient(env);
    const publicUrl = await uploadDepositProofFile({
      proofFile,
      storageApi: adminClient.storage,
      userId: user.id
    });

    return jsonResponse({ success: true, data: { publicUrl } });
  } catch (error) {
    return errorResponse(
      error instanceof Error && error.message ? error.message : PROOF_UPLOAD_ERROR_MESSAGE,
      500
    );
  }
}
