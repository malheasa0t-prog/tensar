/**
 * Cloudflare Pages Function for uploading private deposit proof images.
 */

import {
  createSupabaseAdmin,
  createSupabaseClient,
  extractBearerToken,
  errorResponse,
  successResponse,
} from "../../_lib/supabase.js";
import { handlePreflight, withCors } from "../../_lib/cors.js";

const DEPOSIT_PROOF_BUCKET_NAME = "deposits";
const DEPOSIT_PROOF_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const DEPOSIT_PROOF_ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DEPOSIT_PROOF_URL_TTL_SECONDS = 900;
const DEFAULT_PROOF_EXT = "jpg";

/**
 * Validates the proof file type and size.
 *
 * @param {{ type?: string, size?: number } | null} file
 * @returns {string}
 */
function validateProofFile(file) {
  if (!file) return "[DEP-101] ملف إثبات الإيداع مطلوب.";

  const normalizedType = String(file.type || "").trim().toLowerCase();
  if (!DEPOSIT_PROOF_ALLOWED_TYPES.includes(normalizedType)) {
    return "[DEP-102] ملف الإثبات يجب أن يكون صورة صالحة.";
  }

  if (Number(file.size || 0) > DEPOSIT_PROOF_SIZE_LIMIT_BYTES) {
    return "[DEP-103] حجم صورة الإثبات أكبر من الحد المسموح.";
  }

  return "";
}

/**
 * Builds the storage object path for one proof image.
 *
 * @param {string} userId
 * @param {string} fileName
 * @returns {string}
 */
function buildObjectPath(userId, fileName) {
  const timestamp = Date.now();
  const rawExt = String(fileName || "").includes(".") ? String(fileName).split(".").pop() : "";
  const ext = /^[a-z0-9]+$/i.test(rawExt || "") ? rawExt.toLowerCase() : DEFAULT_PROOF_EXT;
  return `${userId}/${timestamp}.${ext}`;
}

/**
 * Ensures the private deposit-proof bucket exists.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function ensureBucket(admin) {
  const bucketResponse = await admin.storage.getBucket(DEPOSIT_PROOF_BUCKET_NAME);
  if (bucketResponse?.data) {
    return;
  }

  const bucketMessage = String(bucketResponse?.error?.message || "").toLowerCase();
  if (bucketResponse?.error && bucketMessage && !bucketMessage.includes("not found")) {
    throw new Error("[DEP-301] تعذر تجهيز مساحة رفع صور الإثبات.");
  }

  const createResponse = await admin.storage.createBucket(DEPOSIT_PROOF_BUCKET_NAME, {
    public: false,
    fileSizeLimit: DEPOSIT_PROOF_SIZE_LIMIT_BYTES,
    allowedMimeTypes: [...DEPOSIT_PROOF_ALLOWED_TYPES],
  });

  if (createResponse?.error && !String(createResponse.error.message || "").toLowerCase().includes("already exists")) {
    throw new Error("[DEP-301] تعذر تجهيز مساحة رفع صور الإثبات.");
  }
}

/**
 * Builds one short-lived preview URL for a freshly uploaded proof image.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} objectPath
 * @returns {Promise<string | null>}
 */
async function createSignedProofUrl(admin, objectPath) {
  const bucketApi = admin.storage.from(DEPOSIT_PROOF_BUCKET_NAME);
  const { data, error } = await bucketApi.createSignedUrl(objectPath, DEPOSIT_PROOF_URL_TTL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

/**
 * Handles deposit proof uploads for authenticated users.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return handlePreflight(context.request);
  }

  if (context.request.method !== "POST") {
    return errorResponse("[DEP-203] Method not allowed", 405);
  }

  const { env, request } = context;
  const token = extractBearerToken(request);
  if (!token) {
    return errorResponse("[DEP-201] Unauthorized", 401);
  }

  const supabase = createSupabaseClient(env);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return errorResponse("[DEP-202] Unauthorized", 401);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("[DEP-104] Failed to parse deposit proof form.", error);
    return errorResponse("[DEP-104] ملف إثبات الإيداع غير صالح.", 400);
  }

  const proofFile = formData.get("proof");
  if (!proofFile || typeof proofFile !== "object" || typeof proofFile.arrayBuffer !== "function") {
    return errorResponse("[DEP-105] ملف إثبات الإيداع غير صالح.", 400);
  }

  const validationError = validateProofFile(proofFile);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  const admin = createSupabaseAdmin(env);
  try {
    await ensureBucket(admin);
  } catch (error) {
    console.error("[DEP-301] Failed to ensure deposit bucket.", error);
    return errorResponse("[DEP-301] تعذر تجهيز مساحة الرفع.", 500);
  }

  const objectPath = buildObjectPath(user.id, proofFile.name || "");
  const bucketApi = admin.storage.from(DEPOSIT_PROOF_BUCKET_NAME);
  const { error: uploadError } = await bucketApi.upload(objectPath, proofFile, {
    contentType: proofFile.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    console.error("[DEP-302] Failed to upload deposit proof.", uploadError);
    return errorResponse("[DEP-302] تعذر رفع صورة الإثبات. حاول مرة أخرى.", 500);
  }

  const signedUrl = await createSignedProofUrl(admin, objectPath);
  const response = successResponse({
    data: {
      objectPath,
      proofUrl: signedUrl,
    },
  });
  return withCors(response, request);
}
