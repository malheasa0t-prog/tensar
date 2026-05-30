/**
 * Cloudflare Pages Function — Service Order Sync (Cron Job).
 *
 * GET /api/orders/sync — fetches pending/processing service orders,
 * checks their status at Serva-S, and updates the local database.
 * Protected by x-cron-secret header.
 */

import { createSupabaseAdmin, errorResponse, successResponse } from "../../_lib/supabase.js";
import { checkProviderOrderStatus } from "../../_lib/providerApi.js";
import { timingSafeEqualStrings } from "../../_lib/timingSafeEqual.js";

/* ─── Constants ─── */

const SYNCABLE_STATUSES = ["pending", "processing", "in_progress"];
const MAX_ORDERS_PER_SYNC = 50;
const PROVIDER_STATUS_MAP = Object.freeze({
  completed: "completed",
  partial: "partial",
  canceled: "cancelled",
  cancelled: "cancelled",
  refunded: "refunded",
  processing: "processing",
  in_progress: "in_progress",
  pending: "pending",
});
const TERMINAL_STATUSES = new Set(["completed", "partial", "cancelled", "refunded", "failed"]);
const REFUNDABLE_STATUSES = new Set(["failed", "cancelled"]);

/* ─── Notification Builders ─── */

const STATUS_LABELS = Object.freeze({
  completed: "تم إكمال طلبك بنجاح! ✅",
  partial: "تم تنفيذ طلبك جزئيًا ⚠️",
  failed: "فشل تنفيذ طلبك ❌",
  cancelled: "تم إلغاء طلبك 🚫",
  refunded: "تم استرجاع رصيدك 💰",
});

/**
 * Builds a user notification for a status change.
 *
 * @param {{ id: string, user_id: string, service_name: string }} order
 * @param {string} finalStatus
 * @param {number} refundAmount
 * @returns {Array<Record<string, unknown>>}
 */
function buildNotifications(order, finalStatus, refundAmount) {
  const notifications = [];
  const displayStatus = finalStatus === "refunded" ? "cancelled" : finalStatus;
  const title = STATUS_LABELS[displayStatus];

  if (title) {
    notifications.push({
      user_id: order.user_id,
      title,
      body: `الخدمة: ${order.service_name}`,
      type: finalStatus === "completed" ? "success" : finalStatus === "partial" ? "warning" : "error",
      reference_type: "order",
      reference_id: order.id,
    });
  }

  if (refundAmount > 0) {
    notifications.push({
      user_id: order.user_id,
      title: "تم استرجاع رصيدك 💰",
      body: `تم إعادة ${refundAmount.toFixed(2)} د.أ إلى محفظتك.`,
      type: "success",
      reference_type: "order",
      reference_id: order.id,
    });
  }

  return notifications;
}

/* ─── Auth Guard ─── */

/**
 * Validates the cron secret header.
 *
 * @param {Request} request
 * @param {Record<string, string>} env
 * @returns {{ authorized: boolean, error?: string }}
 */
function validateCronSecret(request, env) {
  const expectedSecret = String(env.CRON_SECRET || "").trim();
  if (!expectedSecret) {
    return { authorized: false, error: "Sync endpoint is not configured (CRON_SECRET missing)." };
  }

  const providedSecret = String(request.headers.get("x-cron-secret") || "").trim();
  if (!timingSafeEqualStrings(providedSecret, expectedSecret)) {
    return { authorized: false, error: "Unauthorized sync trigger." };
  }

  return { authorized: true };
}

/* ─── Sync Logic ─── */

/**
 * Processes a single service order against the provider.
 *
 * @param {{ admin: import("@supabase/supabase-js").SupabaseClient, env: Record<string, string>, order: Record<string, unknown> }} context
 * @returns {Promise<{ orderId: string, action: string, details?: string }>}
 */
async function syncSingleOrder({ admin, env, order }) {
  const externalId = String(order.external_order_id || "");
  if (!externalId) {
    return { orderId: order.id, action: "skipped", details: "no external_order_id" };
  }

  const providerResult = await checkProviderOrderStatus(env, externalId);
  if (!providerResult.success) {
    return { orderId: order.id, action: "error", details: providerResult.error };
  }

  const mappedStatus = PROVIDER_STATUS_MAP[providerResult.status] || providerResult.status;

  if (!TERMINAL_STATUSES.has(mappedStatus) && mappedStatus === order.status) {
    return { orderId: order.id, action: "unchanged", details: mappedStatus };
  }

  if (!TERMINAL_STATUSES.has(mappedStatus) && mappedStatus !== order.status) {
    await admin
      .from("service_orders")
      .update({
        status: mappedStatus,
        start_count: providerResult.startCount ?? order.start_count,
        remains: providerResult.remains ?? order.remains,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return { orderId: order.id, action: "updated", details: `${order.status} → ${mappedStatus}` };
  }

  const { data: syncResult, error: syncError } = await admin.rpc("sync_service_order_status_tx", {
    p_order_id: order.id,
    p_expected_status: order.status,
    p_new_status: mappedStatus,
    p_start_count: providerResult.startCount ?? null,
    p_remains: providerResult.remains ?? null,
  });

  if (syncError) {
    return { orderId: order.id, action: "rpc_error", details: syncError.message };
  }

  const result = Array.isArray(syncResult) ? syncResult[0] : syncResult;

  if (!result?.applied) {
    return { orderId: order.id, action: "skipped", details: "status mismatch" };
  }

  const notifications = buildNotifications(order, result.final_status, Number(result.refund_amount || 0));
  if (notifications.length > 0) {
    await admin.from("notifications").insert(notifications);
  }

  return {
    orderId: order.id,
    action: "synced",
    details: `${order.status} → ${result.final_status}` +
      (result.refund_amount > 0 ? ` (refund: ${result.refund_amount})` : ""),
  };
}

/* ─── Main Handler ─── */

/**
 * GET /api/orders/sync — syncs service order statuses with Serva-S.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const { env, request } = context;

  const auth = validateCronSecret(request, env);
  if (!auth.authorized) {
    return errorResponse(auth.error, auth.error.includes("not configured") ? 503 : 401);
  }

  try {
    const admin = createSupabaseAdmin(env);

    const { data: orders, error: fetchError } = await admin
      .from("service_orders")
      .select("id, user_id, service_name, status, external_order_id, price, total, start_count, remains, created_at")
      .in("status", SYNCABLE_STATUSES)
      .not("external_order_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(MAX_ORDERS_PER_SYNC);

    if (fetchError) {
      return errorResponse("تعذر جلب الطلبات المعلقة", 500);
    }

    if (!orders || orders.length === 0) {
      return successResponse({ synced: 0, results: [], message: "لا توجد طلبات تحتاج مزامنة" });
    }

    const results = [];
    for (const order of orders) {
      const result = await syncSingleOrder({ admin, env, order });
      results.push(result);
    }

    const synced = results.filter((r) => r.action === "synced" || r.action === "updated").length;
    const errors = results.filter((r) => r.action === "error" || r.action === "rpc_error").length;

    return successResponse({
      synced,
      errors,
      total: orders.length,
      results,
    });
  } catch (err) {
    console.error("Order sync error:", err);
    return errorResponse("حدث خطأ أثناء المزامنة", 500);
  }
}
