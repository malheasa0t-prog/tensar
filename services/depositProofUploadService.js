/**
 * Client-side helpers for validating and uploading private deposit proof files.
 */

import {
  DEPOSIT_PROOF_BUCKET_NAME,
  buildDepositProofObjectPath,
} from "../lib/depositPageModel.js";

export const DEPOSIT_PROOF_ALLOWED_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
export const DEPOSIT_PROOF_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;

const INVALID_PROOF_FILE_MESSAGE = "[DPU-101] ملف الإثبات يجب أن يكون صورة صالحة.";
const OVERSIZED_PROOF_FILE_MESSAGE = "[DPU-102] حجم صورة الإثبات أكبر من الحد المسموح.";
const BUCKET_PREPARATION_ERROR_MESSAGE = "[DPU-301] تعذر تجهيز مساحة رفع صور الإثبات.";

/**
 * Validates the uploaded deposit proof before any storage call.
 *
 * @param {File | { type?: string, size?: number } | null | undefined} proofFile
 * @returns {string}
 */
export function validateDepositProofFile(proofFile) {
  if (!proofFile) {
    return "";
  }

  const normalizedType = String(proofFile.type || "").trim().toLowerCase();
  if (!DEPOSIT_PROOF_ALLOWED_MIME_TYPES.includes(normalizedType)) {
    return INVALID_PROOF_FILE_MESSAGE;
  }

  const normalizedSize = Number(proofFile.size || 0);
  if (normalizedSize > DEPOSIT_PROOF_SIZE_LIMIT_BYTES) {
    return OVERSIZED_PROOF_FILE_MESSAGE;
  }

  return "";
}

/**
 * Ensures the deposit-proof bucket exists and remains private.
 *
 * @param {{ getBucket?: (name: string) => Promise<{ data?: unknown, error?: { message?: string } | null }>, createBucket?: (name: string, options: { public: boolean, fileSizeLimit: number, allowedMimeTypes: string[] }) => Promise<{ error?: { message?: string } | null }> }} storageApi
 * @returns {Promise<void>}
 * @throws {Error}
 */
export async function ensureDepositProofBucket(storageApi) {
  if (!storageApi || typeof storageApi.getBucket !== "function" || typeof storageApi.createBucket !== "function") {
    throw new Error(BUCKET_PREPARATION_ERROR_MESSAGE);
  }

  const bucketResponse = await storageApi.getBucket(DEPOSIT_PROOF_BUCKET_NAME);
  if (bucketResponse?.data) {
    return;
  }

  const bucketMessage = String(bucketResponse?.error?.message || "").toLowerCase();
  if (bucketResponse?.error && bucketMessage && !bucketMessage.includes("not found")) {
    throw new Error(BUCKET_PREPARATION_ERROR_MESSAGE);
  }

  const createResponse = await storageApi.createBucket(DEPOSIT_PROOF_BUCKET_NAME, {
    public: false,
    fileSizeLimit: DEPOSIT_PROOF_SIZE_LIMIT_BYTES,
    allowedMimeTypes: [...DEPOSIT_PROOF_ALLOWED_MIME_TYPES],
  });

  if (createResponse?.error && !String(createResponse.error.message || "").toLowerCase().includes("already exists")) {
    throw new Error(BUCKET_PREPARATION_ERROR_MESSAGE);
  }
}

/**
 * Uploads a deposit proof image and returns its private object path.
 *
 * @param {{ storageApi: { getBucket: (name: string) => Promise<{ data?: unknown, error?: { message?: string } | null }>, createBucket: (name: string, options: { public: boolean, fileSizeLimit: number, allowedMimeTypes: string[] }) => Promise<{ error?: { message?: string } | null }>, from: (bucketName: string) => { upload: (path: string, file: File | { name?: string, type?: string }, options?: { contentType?: string, upsert?: boolean }) => Promise<{ error?: { message?: string } | null }> } }, proofFile: File | { name?: string, type?: string, size?: number }, userId: string, now?: () => number }} input
 * @returns {Promise<string | null>}
 * @throws {Error}
 */
export async function uploadDepositProofFile({ storageApi, proofFile, userId, now = Date.now }) {
  const validationError = validateDepositProofFile(proofFile);
  if (validationError) {
    throw new Error(validationError);
  }

  await ensureDepositProofBucket(storageApi);

  const objectPath = buildDepositProofObjectPath({
    userId,
    fileName: proofFile?.name || "",
    now: now(),
  });
  const bucketApi = storageApi.from(DEPOSIT_PROOF_BUCKET_NAME);
  const { error } = await bucketApi.upload(objectPath, proofFile, {
    contentType: proofFile?.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`[DPU-302] فشل رفع صورة الإثبات: ${error.message || "خطأ غير معروف."}`);
  }

  return objectPath;
}
