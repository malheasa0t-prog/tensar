import {
  applyInventoryAdjustments,
  buildInventoryAdjustments,
  INVENTORY_CONFLICT_ERROR_MESSAGE
} from "../../../services/checkoutInventoryService.js";
import {
  CHECKOUT_ROLLBACK_ERROR_MESSAGE,
  rollbackCheckoutState
} from "../../../services/checkoutRollbackService.js";

import {
  buildValidatedOrderLines,
  createCheckoutOrderId,
  loadCheckoutCategories,
  loadCheckoutDeliveryMethods,
  normalizeCheckoutItems,
  normalizeCheckoutPayload,
  resolveCheckoutTotals,
  resolveInitialCheckoutStatus,
  validateCheckoutCustomer
} from "../lib/checkout.mjs";
import { getUserFromRequest } from "../lib/auth.mjs";
import { createAdminSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse, parseJsonBody } from "../lib/http.mjs";

const BANNED_ACCOUNT_MESSAGE = "حسابك محظور. تواصل مع الإدارة.";

/**
 * Determines whether the provided profile status represents a banned account.
 *
 * @param {unknown} status
 * @returns {boolean}
 */
function isProfileBanned(status) {
  return typeof status === "string" && status.trim().toLowerCase() === "banned";
}

/**
 * Loads the optional authenticated user id and banned flag for checkout.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {import("@supabase/supabase-js").SupabaseClient} adminClient
 * @returns {Promise<{ isBanned: boolean, userId: string | null }>}
 */
async function getOptionalUserAccessState(request, env, adminClient) {
  const { error, user } = await getUserFromRequest(request, env);
  if (error || !user?.id) {
    return { isBanned: false, userId: null };
  }

  const response = await adminClient
    .from("user_profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (response.error) {
    throw new Error("تعذر التحقق من حالة المستخدم.");
  }

  return {
    isBanned: isProfileBanned(response.data?.status),
    userId: user.id
  };
}

/**
 * Executes rollback side effects after a checkout persistence failure.
 *
 * @param {{
 *   adminClient: import("@supabase/supabase-js").SupabaseClient,
 *   appliedInventoryAdjustments: Array<Record<string, unknown>>,
 *   orderId: string,
 * }}
 * @returns {Promise<Response | null>}
 */
async function handleRollbackFailure({ adminClient, appliedInventoryAdjustments, orderId }) {
  const rollbackResult = await rollbackCheckoutState({
    appliedInventoryAdjustments,
    client: adminClient,
    orderId
  });

  if (rollbackResult.ok) {
    return null;
  }

  return errorResponse(CHECKOUT_ROLLBACK_ERROR_MESSAGE, 500);
}

/**
 * Creates a physical checkout order without Next.js.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleCheckoutRequest(request, env) {
  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse("بيانات الطلب غير صالحة", 400);
  }

  try {
    const adminClient = createAdminSupabaseClient(env);
    const payload = normalizeCheckoutPayload(body);
    const customerValidationError = validateCheckoutCustomer(payload);
    if (customerValidationError) {
      return errorResponse(customerValidationError, 400);
    }

    const aggregatedItems = normalizeCheckoutItems(body.items);
    if (aggregatedItems.length === 0) {
      return errorResponse("بيانات السلة غير صالحة", 400);
    }

    const userAccess = await getOptionalUserAccessState(request, env, adminClient);
    if (userAccess.isBanned) {
      return errorResponse(BANNED_ACCOUNT_MESSAGE, 403);
    }

    const productIds = aggregatedItems.map((item) => item.id);
    const productsResponse = await adminClient
      .from("products")
      .select("id,name,price,discount_price,quantity,sold,status,category_id,product_type,brand,images")
      .in("id", productIds)
      .eq("status", "active");

    if (productsResponse.error) {
      return errorResponse("تعذر تحميل بيانات المنتجات", 500);
    }

    const categoriesResult = await loadCheckoutCategories(
      (productsResponse.data || []).map((product) => product.category_id),
      adminClient
    );
    if (categoriesResult.error) {
      return errorResponse(categoriesResult.error, 500);
    }

    const orderLinesResult = buildValidatedOrderLines({
      aggregatedItems,
      categories: categoriesResult.categories,
      products: productsResponse.data || []
    });
    if (orderLinesResult.error) {
      return errorResponse(orderLinesResult.error, 400);
    }

    const deliveryMethods = await loadCheckoutDeliveryMethods(adminClient);
    if (!deliveryMethods.some((option) => option.value === payload.deliveryMethod)) {
      return errorResponse("طريقة التسليم غير صالحة", 400);
    }

    const { shippingFee, total } = resolveCheckoutTotals({
      deliveryMethod: payload.deliveryMethod,
      deliveryMethods,
      subtotal: orderLinesResult.subtotal
    });
    const inventoryAdjustments = buildInventoryAdjustments({
      aggregatedItems,
      products: productsResponse.data || []
    });
    const orderId = createCheckoutOrderId();

    const { error: orderError } = await adminClient.from("orders").insert([
      {
        customer_email: payload.customerEmail || null,
        customer_name: payload.customerName,
        customer_phone: payload.customerPhone,
        delivery_method: payload.deliveryMethod,
        id: orderId,
        metadata: { catalog_kind: orderLinesResult.catalogKind },
        notes: payload.notes || null,
        payment_method: payload.paymentMethod,
        shipping_fee: shippingFee,
        status: resolveInitialCheckoutStatus(),
        total,
        user_id: userAccess.userId
      }
    ]);

    if (orderError) {
      return errorResponse("تعذر إنشاء الطلب", 500);
    }

    const { error: itemsError } = await adminClient.from("order_items").insert(
      orderLinesResult.orderItems.map((item) => ({ order_id: orderId, ...item }))
    );

    if (itemsError) {
      const rollbackFailure = await handleRollbackFailure({
        adminClient,
        appliedInventoryAdjustments: [],
        orderId
      });
      return rollbackFailure || errorResponse("تعذر حفظ عناصر الطلب", 500);
    }

    try {
      await applyInventoryAdjustments({ adjustments: inventoryAdjustments, client: adminClient });
    } catch (error) {
      const rollbackFailure = await handleRollbackFailure({
        adminClient,
        appliedInventoryAdjustments: inventoryAdjustments,
        orderId
      });

      if (rollbackFailure) {
        return rollbackFailure;
      }

      if (error instanceof Error && error.message === INVENTORY_CONFLICT_ERROR_MESSAGE) {
        return errorResponse(error.message, 409);
      }

      return errorResponse("تعذر تحديث المخزون", 500);
    }

    return jsonResponse({
      success: true,
      data: {
        items_count: orderLinesResult.orderItems.length,
        order_id: orderId,
        total
      }
    });
  } catch {
    return errorResponse("حدث خطأ غير متوقع", 500);
  }
}
