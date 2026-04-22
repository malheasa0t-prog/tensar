/**
 * Cloudflare Pages Function - Back-in-stock alerts API.
 *
 * Handles POST /api/stock-alerts requests for authenticated users.
 */

import { handlePreflight, withCors } from "../_lib/cors.js";
import {
  createSupabaseAdmin,
  createSupabaseClient,
  errorResponse,
  extractBearerToken,
  successResponse,
} from "../_lib/supabase.js";
import {
  buildRestockSubscriptionPayload,
  isStockAlertEligibleProduct,
  normalizeStockAlertProductId,
  RESTOCK_SUBSCRIPTION_REFERENCE_TYPE,
} from "../../lib/stockAlertModel.js";

const STOCK_ALERT_SAVE_ERROR_MESSAGE = "[SAL-301] تعذر تفعيل تنبيه التوفر حالياً.";

/**
 * Authenticates the request and returns the active user when available.
 *
 * @param {Request} request
 * @param {Record<string, string>} env
 * @returns {Promise<{ error: string, user: Record<string, unknown> | null }>}
 */
async function authenticateStockAlertRequest(request, env) {
  const token = extractBearerToken(request);
  if (!token) {
    return { error: "[SAL-201] سجل الدخول أولاً لتفعيل تنبيه التوفر.", user: null };
  }

  const supabase = createSupabaseClient(env);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: "[SAL-202] جلسة تسجيل الدخول غير صالحة.", user: null };
  }

  return { error: "", user };
}

/**
 * Reads the product id from the incoming JSON payload.
 *
 * @param {Request} request
 * @returns {Promise<string>}
 */
async function readProductId(request) {
  const body = await request.json();
  return normalizeStockAlertProductId(body?.productId);
}

/**
 * Returns whether the user already has an active restock subscription.
 *
 * @param {{ admin: Record<string, unknown>, productId: string, userId: string }} input
 * @returns {Promise<boolean>}
 * @throws {Error}
 */
async function hasExistingSubscription({ admin, productId, userId }) {
  const response = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("reference_type", RESTOCK_SUBSCRIPTION_REFERENCE_TYPE)
    .eq("reference_id", productId)
    .limit(1);

  if (response.error) {
    throw new Error(STOCK_ALERT_SAVE_ERROR_MESSAGE);
  }

  return Array.isArray(response.data) && response.data.length > 0;
}

/**
 * Handles stock alert subscription requests.
 *
 * @param {Request} request
 * @param {Record<string, string>} env
 * @returns {Promise<Response>}
 */
async function handlePost(request, env) {
  const auth = await authenticateStockAlertRequest(request, env);
  if (auth.error || !auth.user) {
    return errorResponse(auth.error || "[SAL-202] Unauthorized", 401);
  }

  let productId = "";
  try {
    productId = await readProductId(request);
  } catch (parseError) {
    console.error("[SAL-101] Failed to parse stock alert payload:", parseError);
    return errorResponse("[SAL-101] بيانات الطلب غير صالحة.", 400);
  }

  if (!productId) {
    return errorResponse("[SAL-102] معرف المنتج مطلوب.", 400);
  }

  const admin = createSupabaseAdmin(env);
  const productResponse = await admin
    .from("products")
    .select("id,name,status,quantity,product_type")
    .eq("id", productId)
    .maybeSingle();

  if (productResponse.error || !productResponse.data) {
    return errorResponse("[SAL-303] المنتج غير موجود أو لم يعد متاحاً.", 404);
  }

  if (!isStockAlertEligibleProduct(productResponse.data)) {
    return errorResponse("[SAL-103] المنتج متوفر الآن بالفعل.", 409);
  }

  if (await hasExistingSubscription({ admin, productId, userId: auth.user.id })) {
    return successResponse({
      alreadySubscribed: true,
      productName: productResponse.data.name,
      subscribed: true,
    });
  }

  const payload = buildRestockSubscriptionPayload({
    productId,
    productName: String(productResponse.data.name || "").trim(),
    userId: auth.user.id,
  });
  const insertResponse = await admin.from("notifications").insert([payload]);
  if (insertResponse.error) {
    return errorResponse(STOCK_ALERT_SAVE_ERROR_MESSAGE, 500);
  }

  return successResponse(
    {
      alreadySubscribed: false,
      productName: productResponse.data.name,
      subscribed: true,
    },
    201
  );
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return handlePreflight(context.request, "POST, OPTIONS");
  }

  const method = context.request.method.toUpperCase();
  const response = method === "POST"
    ? await handlePost(context.request, context.env)
    : errorResponse("[SAL-203] Method not allowed", 405);
  return withCors(response, context.request, "POST, OPTIONS");
}
