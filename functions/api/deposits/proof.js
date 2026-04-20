/**
 * Cloudflare Pages Function — Deposit Proof Upload (POST).
 *
 * POST /api/deposits/proof → Uploads a deposit proof image to Supabase Storage.
 */

import { createSupabaseAdmin, createSupabaseClient, extractBearerToken, errorResponse, successResponse } from '../../_lib/supabase.js';
import { handlePreflight, withCors } from '../../_lib/cors.js';

/* ─── Constants ─── */

/* CORS handled by shared _lib/cors.js module */

const DEPOSIT_PROOF_BUCKET_NAME = 'deposits';
const DEPOSIT_PROOF_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const DEPOSIT_PROOF_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const DEFAULT_PROOF_EXT = 'jpg';

/* ─── Helpers ─── */

/**
 * Validates the proof file type and size.
 *
 * @param {{ type?: string, size?: number } | null} file
 * @returns {string} Error message or empty string.
 */
function validateProofFile(file) {
  if (!file) return 'ملف إثبات الإيداع مطلوب.';

  const normalizedType = String(file.type || '').trim().toLowerCase();
  if (!DEPOSIT_PROOF_ALLOWED_TYPES.includes(normalizedType)) {
    return 'ملف الإثبات يجب أن يكون صورة صالحة.';
  }

  if (Number(file.size || 0) > DEPOSIT_PROOF_SIZE_LIMIT_BYTES) {
    return 'حجم صورة الإثبات أكبر من الحد المسموح.';
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
  const rawExt = String(fileName || '').includes('.')
    ? String(fileName).split('.').pop()
    : '';
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

  const msg = String(bucketResp?.error?.message || '').toLowerCase();
  if (bucketResp?.error && msg && !msg.includes('not found')) {
    throw new Error('تعذر تجهيز مساحة رفع صور الإثبات.');
  }

  const createResp = await admin.storage.createBucket(DEPOSIT_PROOF_BUCKET_NAME, {
    public: false,
    fileSizeLimit: DEPOSIT_PROOF_SIZE_LIMIT_BYTES,
    allowedMimeTypes: [...DEPOSIT_PROOF_ALLOWED_TYPES],
  });

  if (createResp?.error && !String(createResp.error.message || '').toLowerCase().includes('already exists')) {
    throw new Error('تعذر تجهيز مساحة رفع صور الإثبات.');
  }
}

/* ─── Handler ─── */

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return handlePreflight(context.request);
  }

  if (context.request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const { env, request } = context;

  /* Authenticate */
  const token = extractBearerToken(request);
  if (!token) {
    return errorResponse('Unauthorized', 401);
  }

  const supabase = createSupabaseClient(env);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return errorResponse('Unauthorized', 401);
  }

  /* Parse form data */
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('ملف إثبات الإيداع غير صالح.', 400);
  }

  const proofFile = formData.get('proof');
  if (!proofFile || typeof proofFile !== 'object' || typeof proofFile.arrayBuffer !== 'function') {
    return errorResponse('ملف إثبات الإيداع غير صالح.', 400);
  }

  /* Validate */
  const validationError = validateProofFile(proofFile);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  /* Upload */
  const admin = createSupabaseAdmin(env);

  try {
    await ensureBucket(admin);
  } catch (err) {
    return errorResponse(err.message || 'تعذر تجهيز مساحة الرفع', 500);
  }

  const objectPath = buildObjectPath(user.id, proofFile.name || '');
  const bucketApi = admin.storage.from(DEPOSIT_PROOF_BUCKET_NAME);

  const { error: uploadError } = await bucketApi.upload(objectPath, proofFile, {
    contentType: proofFile.type || 'application/octet-stream',
    upsert: false,
  });

  if (uploadError) {
    return errorResponse(`فشل رفع صورة الإثبات: ${uploadError.message || 'خطأ غير معروف'}`, 500);
  }

  const { data: { publicUrl } = {} } = bucketApi.getPublicUrl(objectPath);

  const response = successResponse({ data: { publicUrl: publicUrl || null } });
  return withCors(response, request);
}
