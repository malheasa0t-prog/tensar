/**
 * Cloudflare Pages Function — Deposit Proof Upload (POST).
 *
 * POST /api/deposits/proof → Uploads a deposit proof image to Supabase Storage.
 */

import { createSupabaseAdmin, createSupabaseClient, extractBearerToken, errorResponse, successResponse } from '../../_lib/supabase.js';
import { handlePreflight, withCors } from '../../_lib/cors.js';

const DEPOSIT_PROOF_BUCKET_NAME = 'deposits';
const DEPOSIT_PROOF_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const DEPOSIT_PROOF_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const DEFAULT_PROOF_EXT = 'jpg';

/**
 * Validates the proof file type and size.
 *
 * @param {{ type?: string, size?: number } | null} file
 * @returns {string} Error message or empty string.
 */
function validateProofFile(file) {
  if (!file) return '[DEP-101] ملف إثبات الإيداع مطلوب.';

  const normalizedType = String(file.type || '').trim().toLowerCase();
  if (!DEPOSIT_PROOF_ALLOWED_TYPES.includes(normalizedType)) {
    return '[DEP-102] ملف الإثبات يجب أن يكون صورة صالحة.';
  }

  if (Number(file.size || 0) > DEPOSIT_PROOF_SIZE_LIMIT_BYTES) {
    return '[DEP-103] حجم صورة الإثبات أكبر من الحد المسموح.';
  }

  return '';
}

/**
 * Builds the storage object path for a proof image.
 *
 * @param {string} userId
 * @param {string} fileName
 * @returns {string}
 */
function buildObjectPath(userId, fileName) {
  const timestamp = Date.now();
  const rawExt = String(fileName || '').includes('.') ? String(fileName).split('.').pop() : '';
  const ext = /^[a-z0-9]+$/i.test(rawExt || '') ? rawExt.toLowerCase() : DEFAULT_PROOF_EXT;
  return `${userId}/${timestamp}.${ext}`;
}

/**
 * Ensures the deposit proof storage bucket exists.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @returns {Promise<void>}
 */
async function ensureBucket(admin) {
  const bucketResp = await admin.storage.getBucket(DEPOSIT_PROOF_BUCKET_NAME);
  if (bucketResp?.data) return;

  const message = String(bucketResp?.error?.message || '').toLowerCase();
  if (bucketResp?.error && message && !message.includes('not found')) {
    throw new Error('[DEP-301] تعذر تجهيز مساحة رفع صور الإثبات.');
  }

  const createResp = await admin.storage.createBucket(DEPOSIT_PROOF_BUCKET_NAME, {
    public: false,
    fileSizeLimit: DEPOSIT_PROOF_SIZE_LIMIT_BYTES,
    allowedMimeTypes: [...DEPOSIT_PROOF_ALLOWED_TYPES],
  });

  if (createResp?.error && !String(createResp.error.message || '').toLowerCase().includes('already exists')) {
    throw new Error('[DEP-301] تعذر تجهيز مساحة رفع صور الإثبات.');
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return handlePreflight(context.request);
  }

  if (context.request.method !== 'POST') {
    return errorResponse('[DEP-203] Method not allowed', 405);
  }

  const { env, request } = context;
  const token = extractBearerToken(request);
  if (!token) {
    return errorResponse('[DEP-201] Unauthorized', 401);
  }

  const supabase = createSupabaseClient(env);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return errorResponse('[DEP-202] Unauthorized', 401);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (parseError) {
    console.error('[DEP-104] Failed to parse deposit proof form:', parseError);
    return errorResponse('[DEP-104] ملف إثبات الإيداع غير صالح.', 400);
  }

  const proofFile = formData.get('proof');
  if (!proofFile || typeof proofFile !== 'object' || typeof proofFile.arrayBuffer !== 'function') {
    return errorResponse('[DEP-105] ملف إثبات الإيداع غير صالح.', 400);
  }

  const validationError = validateProofFile(proofFile);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  const admin = createSupabaseAdmin(env);
  try {
    await ensureBucket(admin);
  } catch (err) {
    console.error('[DEP-301] Failed to ensure deposit bucket:', err);
    return errorResponse(err.message || '[DEP-301] تعذر تجهيز مساحة الرفع', 500);
  }

  const objectPath = buildObjectPath(user.id, proofFile.name || '');
  const bucketApi = admin.storage.from(DEPOSIT_PROOF_BUCKET_NAME);
  const { error: uploadError } = await bucketApi.upload(objectPath, proofFile, {
    contentType: proofFile.type || 'application/octet-stream',
    upsert: false,
  });

  if (uploadError) {
    return errorResponse(`[DEP-302] فشل رفع صورة الإثبات: ${uploadError.message || 'خطأ غير معروف'}`, 500);
  }

  const { data: { publicUrl } = {} } = bucketApi.getPublicUrl(objectPath);
  const response = successResponse({ data: { publicUrl: publicUrl || null } });
  return withCors(response, request);
}
