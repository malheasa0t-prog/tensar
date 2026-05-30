/**
 * Cloudflare Pages Function — Checkout API.
 *
 * Handles POST /api/checkout — creates physical product orders.
 */

import { createClient } from "@supabase/supabase-js";

import { finalizeCheckoutResponse } from "./checkout-cors.js";
import { guardGuestCheckoutRateLimit } from "../_lib/checkoutGuestRateLimit.js";
import { withIdempotency } from "../_lib/idempotency.js";
import {
  createSupabaseAdmin,
  errorResponse,
  extractBearerToken,
  successResponse,
} from "../_lib/supabase.js";
import { createProviderOrder } from "../_lib/providerApi.js";
import {
  applyCheckoutInventoryAdjustments,
  buildCheckoutInventoryAdjustments,
  rollbackCheckoutProcessing,
} from "./checkout-inventory.js";
import {
  createCheckoutOrderRecord,
  sendCheckoutNotification,
  syncCheckoutProviderOrders,
} from "./checkout-order.js";
import {
  buildCheckoutOrderItems,
  loadCheckoutCatalog,
  parseCheckoutRequest,
  resolveCheckoutUserId,
  validateCheckoutDigitalContact,
} from "./checkout-validator.js";

/**
 * Creates one request-scoped Supabase auth client when a bearer token exists.
 *
 * @param {{
 *   createClientImpl?: typeof createClient,
 *   env: Record<string, string>,
 *   request: Request,
 * }} input
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function createCheckoutRequestClient({ createClientImpl = createClient, env, request }) {
  const token = extractBearerToken(request);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClientImpl(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * POST /api/checkout — creates a product order.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequestPost(context) {
  return createCheckoutHandler()(context);
}
export { onRequestOptions } from "./checkout-cors.js";

/**
 * Creates the checkout POST handler with injectable dependencies for tests.
 *
 * @param {{
 *   applyInventoryAdjustments?: typeof import('../../services/checkoutInventoryService.js').applyInventoryAdjustments,
 *   buildInventoryAdjustments?: typeof import('../../services/checkoutInventoryService.js').buildInventoryAdjustments,
 *   createCheckoutRequestClient?: typeof createCheckoutRequestClient,
  *   createProviderOrder?: typeof createProviderOrder,
  *   createSupabaseAdmin?: typeof createSupabaseAdmin,
 *   guardGuestCheckoutRateLimit?: typeof guardGuestCheckoutRateLimit,
 *   resolveCheckoutUserId?: typeof resolveCheckoutUserId,
 *   rollbackCheckoutState?: typeof import('../../services/checkoutRollbackService.js').rollbackCheckoutState,
 * }} [dependencies]
 * @returns {(context: EventContext) => Promise<Response>}
 */
export function createCheckoutHandler(dependencies = {}) {
  const applyInventoryAdjustmentsImpl =
    dependencies.applyInventoryAdjustments;
  const buildInventoryAdjustmentsImpl =
    dependencies.buildInventoryAdjustments;
  const createCheckoutRequestClientImpl =
    dependencies.createCheckoutRequestClient || createCheckoutRequestClient;
  const createProviderOrderImpl = dependencies.createProviderOrder || createProviderOrder;
  const createSupabaseAdminImpl = dependencies.createSupabaseAdmin || createSupabaseAdmin;
  const guardGuestCheckoutRateLimitImpl =
    dependencies.guardGuestCheckoutRateLimit || guardGuestCheckoutRateLimit;
  const resolveCheckoutUserIdImpl = dependencies.resolveCheckoutUserId || resolveCheckoutUserId;
  const rollbackCheckoutStateImpl = dependencies.rollbackCheckoutState;

  return async function handleCheckoutPost(context) {
    const { env, request } = context;

    const guestCheckoutRateLimitResponse = await guardGuestCheckoutRateLimitImpl({
      env,
      request,
    });
    if (guestCheckoutRateLimitResponse) {
      return finalizeCheckoutResponse({
        request,
        response: guestCheckoutRateLimitResponse,
      });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 50_000) {
      return finalizeCheckoutResponse({
        request,
        response: errorResponse('[CHK-100] حجم الطلب كبير جداً', 413),
      });
    }

    let rawBody = "";
    try {
      rawBody = await request.text();
    } catch (readError) {
      console.error("[CHK-501] Failed to read checkout request body.", readError);
      return finalizeCheckoutResponse({
        request,
        response: errorResponse("[CHK-501] تعذر قراءة بيانات الطلب", 400),
      });
    }

    // The idempotency layer fingerprints the raw body and caches the resulting
    // response, so a double-click on "Pay" or a retry on network error replays
    // the original 200 instead of producing a second order.
    const pipelineResponse = await withIdempotency({
      env,
      request,
      requestBody: rawBody,
      scope: "checkout",
      handler: () => runCheckoutPipeline({ env, rawBody, request }),
    });

    return finalizeCheckoutResponse({ request, response: pipelineResponse });

    /**
     * Runs the parse → validate → reserve inventory → create order → provider
     * sync pipeline. Returns plain Response objects so the idempotency layer
     * can cache them; the surrounding handler adds CORS once at the end.
     *
     * @param {{ env: Record<string, unknown>, rawBody: string, request: Request }} pipelineInput - Pipeline input.
     * @returns {Promise<Response>} Pipeline response (success or mapped error).
     */
    async function runCheckoutPipeline({ env: pipelineEnv, rawBody: pipelineRawBody, request: pipelineRequest }) {
      let parsedBody;
      try {
        parsedBody = pipelineRawBody ? JSON.parse(pipelineRawBody) : {};
      } catch (parseError) {
        void parseError;
        return errorResponse("[CHK-108] هيكل الطلب غير صالح", 400);
      }

      try {
        const checkoutRequest = parseCheckoutRequest(parsedBody);
        const admin = createSupabaseAdminImpl(pipelineEnv);
        const requestClient = createCheckoutRequestClientImpl({ env: pipelineEnv, request: pipelineRequest });
        const hasBearerToken = Boolean(extractBearerToken(pipelineRequest));
        const userId = await resolveCheckoutUserIdImpl({ admin, request: pipelineRequest, requestClient });

        if (hasBearerToken && !userId) {
          return errorResponse('[CHK-104] جلسة غير صالحة. أعد تسجيل الدخول.', 401);
        }

        const checkoutCatalog = await loadCheckoutCatalog({
          admin,
          items: checkoutRequest.items,
        });

        validateCheckoutDigitalContact({
          customerContactLink: checkoutRequest.customerContactLink,
          serviceProducts: checkoutCatalog.serviceProducts,
        });

        const { orderItems, subtotal } = buildCheckoutOrderItems({
          items: checkoutRequest.items,
          productMap: checkoutCatalog.productMap,
        });
        const inventoryAdjustments = buildCheckoutInventoryAdjustments({
          buildInventoryAdjustmentsImpl,
          items: checkoutRequest.items,
          physicalProducts: checkoutCatalog.physicalProducts,
        });

        // Step 1: deduct inventory first. deduct_inventory RPC uses FOR UPDATE
        // locks so concurrent attempts are serialized at the DB level.
        const appliedInventoryAdjustments = await applyCheckoutInventoryAdjustments({
          admin,
          adjustments: inventoryAdjustments,
          applyInventoryAdjustmentsImpl,
        });

        // Step 2: create the order record after inventory is secured.
        let orderId;
        let displayNumber;
        let total;
        try {
          const orderResult = await createCheckoutOrderRecord({
            admin,
            customerEmail: checkoutRequest.customerEmail,
            customerName: checkoutRequest.customerName,
            customerPhone: checkoutRequest.customerPhone,
            deliveryMethod: checkoutRequest.deliveryMethod,
            notes: checkoutRequest.notes,
            orderItems,
            paymentMethod: checkoutRequest.paymentMethod,
            subtotal,
            couponCode: checkoutRequest.couponCode,
            userId,
          });
          orderId = orderResult.orderId;
          displayNumber = orderResult.displayNumber;
          total = orderResult.total;
        } catch (orderError) {
          await rollbackCheckoutProcessing({
            admin,
            appliedInventoryAdjustments,
            orderId: null,
            rollbackCheckoutStateImpl,
          });
          throw orderError;
        }

        // Step 3: provider sync + notification. Failures here trigger full rollback.
        try {
          await syncCheckoutProviderOrders({
            admin,
            createProviderOrderImpl,
            customerContactLink: checkoutRequest.customerContactLink,
            customerPhone: checkoutRequest.customerPhone,
            env: pipelineEnv,
            items: checkoutRequest.items,
            orderId,
            productMap: checkoutCatalog.productMap,
          });

          await sendCheckoutNotification({
            admin,
            displayNumber,
            orderId,
            orderItemsCount: orderItems.length,
            total,
            userId,
          });

          return successResponse({
            data: {
              order_id: orderId,
              display_number: displayNumber,
              total,
              items_count: orderItems.length,
            },
          });
        } catch (processingError) {
          await rollbackCheckoutProcessing({
            admin,
            appliedInventoryAdjustments:
              processingError?.appliedInventoryAdjustments || appliedInventoryAdjustments,
            orderId,
            rollbackCheckoutStateImpl,
          });
          throw processingError;
        }
      } catch (error) {
        return mapCheckoutErrorToResponse(error);
      }
    }
  };
}

/**
 * Maps a checkout pipeline error to the appropriate HTTP response.
 *
 * Defined at module scope so the catch path stays focused on classification
 * and never leaks the raw `error.message` to the client for unmapped codes.
 *
 * @param {unknown} error - Thrown error from the checkout pipeline.
 * @returns {Response} Public-safe error response.
 */
function mapCheckoutErrorToResponse(error) {
  const errorMessage = String(error?.message || "").trim();
  console.error("[CHK-500] Checkout API error:", error);

  if (["[CHK-101]", "[CHK-102]", "[CHK-103]", "[CHK-106]", "[CHK-107]", "[CHK-108]", "[CHK-112]"]
    .some((code) => errorMessage.startsWith(code))) {
    return errorResponse(errorMessage, 400);
  }
  if (errorMessage.startsWith("[CHK-104]")) {
    return errorResponse(errorMessage, 403);
  }
  if (["[CHK-105]", "[CHK-109]", "[CHK-110]", "[CHK-113]", "[CHK-114]"].some((code) =>
    errorMessage.startsWith(code)
  )) {
    return errorResponse(errorMessage, 500);
  }
  if (errorMessage.startsWith("[CKP-302]")) {
    return errorResponse(errorMessage, 409);
  }
  if (errorMessage.startsWith("[CKP-301]") || errorMessage.startsWith("[CKP-303]")) {
    return errorResponse(errorMessage, 500);
  }

  // Final fallback — never echo error.message to the client.
  return errorResponse("[CHK-500] حدث خطأ غير متوقع أثناء معالجة الطلب", 500);
}
