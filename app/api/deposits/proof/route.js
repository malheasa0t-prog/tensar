import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  uploadDepositProofFile,
  validateDepositProofFile,
} from "@/services/depositProofUploadService";

export const runtime = "nodejs";

const INVALID_PROOF_REQUEST_MESSAGE = "ملف إثبات الإيداع غير صالح.";
const PROOF_UPLOAD_ERROR_MESSAGE = "تعذر رفع صورة الإثبات حالياً.";

/**
 * Uploads a deposit proof file through the server so storage can be prepared safely.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: INVALID_PROOF_REQUEST_MESSAGE }, { status: 400 });
  }

  const proofFile = formData.get("proof");
  if (!proofFile || typeof proofFile !== "object" || typeof proofFile.arrayBuffer !== "function") {
    return NextResponse.json({ success: false, error: INVALID_PROOF_REQUEST_MESSAGE }, { status: 400 });
  }

  const validationError = validateDepositProofFile(proofFile);
  if (validationError) {
    return NextResponse.json({ success: false, error: validationError }, { status: 400 });
  }

  try {
    const publicUrl = await uploadDepositProofFile({
      storageApi: supabaseAdmin.storage,
      proofFile,
      userId: user.id,
    });

    return NextResponse.json({ success: true, data: { publicUrl } });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : PROOF_UPLOAD_ERROR_MESSAGE;
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
