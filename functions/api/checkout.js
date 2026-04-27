/**
 * Cloudflare Pages Function — Checkout API.
 *
 * Handles POST /api/checkout — creates physical product orders.
 */

import { createClient } from "@supabase/supabase-js";

import { finalizeCheckoutResponse } from "./checkout-cors.js";
import { guardGuestCheckoutRateLimit } from "../_lib/checkoutGuestRateLimit.js";
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

    try {
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

      const checkoutRequest = parseCheckoutRequest(await request.json());
      const admin = createSupabaseAdminImpl(env);
      const requestClient = createCheckoutRequestClientImpl({ env, request });
      const hasBearerToken = Boolean(extractBearerToken(request));
      const userId = await resolveCheckoutUserIdImpl({ admin, request, requestClient });

      if (hasBearerToken && !userId) {
        return finalizeCheckoutResponse({
          request,
          response: errorResponse('[CHK-104] جلسة غير صالحة. أعد تسجيل الدخول.', 401),
        });
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

      // Step 1: Deduct inventory FIRST to prevent overselling.
      // The deduct_inventory RPC uses FOR UPDATE locks, so concurrent
      // requests will be serialized at the DB level.
      let appliedInventoryAdjustments = [];

      try {
        appliedInventoryAdjustments = await applyCheckoutInventoryAdjustments({
          admin,
          adjustments: inventoryAdjustments,
          applyInventoryAdjustmentsImpl,
        });
      } catch (inventoryError) {
        // No order was created yet, so no cleanup needed — just fail
        throw inventoryError;
      }

      // Step 2: Create the order record AFTER inventory is secured
      let orderId;
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
          userId,
        });
        orderId = orderResult.orderId;
        total = orderResult.total;
      } catch (orderError) {
        // Order creation failed after inventory was deducted — rollback inventory
        await rollbackCheckoutProcessing({
          admin,
          appliedInventoryAdjustments,
          orderId: null,
          rollbackCheckoutStateImpl,
        });
        throw orderError;
      }

      // Step 3: Provider sync + notification (failures here trigger full rollback)
      try {
        await syncCheckoutProviderOrders({
          admin,
          createProviderOrderImpl,
          customerContactLink: checkoutRequest.customerContactLink,
          customerPhone: checkoutRequest.customerPhone,
          env,
          items: checkoutRequest.items,
          orderId,
          productMap: checkoutCatalog.productMap,
        });

        await sendCheckoutNotification({
          admin,
          orderId,
          orderItemsCount: orderItems.length,
          total,
          userId,
        });

        return finalizeCheckoutResponse({
          request,
          response: successResponse({
            data: {
              order_id: orderId,
              total,
              items_count: orderItems.length,
            },
          }),
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
      const errorMessage = String(error?.message || "").trim();
      console.error("[CHK-500] Checkout API error:", error);

      if (["[CHK-101]", "[CHK-102]", "[CHK-103]", "[CHK-106]", "[CHK-107]", "[CHK-108]", "[CHK-112]"]
        .some((code) => errorMessage.startsWith(code))) {
        return finalizeCheckoutResponse({
          request,
          response: errorResponse(errorMessage, 400),
        });
      }

      if (errorMessage.startsWith("[CHK-104]")) {
        return finalizeCheckoutResponse({
          request,
          response: errorResponse(errorMessage, 403),
        });
      }

      if (
        ["[CHK-105]", "[CHK-109]", "[CHK-110]", "[CHK-113]", "[CHK-114]"].some((code) =>
          errorMessage.startsWith(code)
        )
      ) {
        return finalizeCheckoutResponse({
          request,
          response: errorResponse(errorMessage, 500),
        });
      }

      if (errorMessage.startsWith("[CKP-302]")) {
        return finalizeCheckoutResponse({
          request,
          response: errorResponse(errorMessage, 409),
        });
      }

      if (errorMessage.startsWith("[CKP-301]") || errorMessage.startsWith("[CKP-303]")) {
        return finalizeCheckoutResponse({
          request,
          response: errorResponse(errorMessage, 500),
        });
      }

      return finalizeCheckoutResponse({
        request,
        response: errorResponse(
          `[CHK-500] حدث خطأ غير متوقع: ${errorMessage}`,
          500
        ),
      });
    }
  };
}
