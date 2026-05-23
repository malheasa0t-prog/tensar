/**
 * Cloudflare Pages Function — Serva-S Webhook Receiver.
 *
 * POST /api/webhooks/serva — receives order status updates pushed by
 * Serva-S and updates local service_orders accordingly.
 *
 * Authentication: x-webhook-secret header must match SERVA_WEBHOOK_SECRET env var.
 * Serva-S sends: { order: "ORD-100023", status: "completed", ... }
 */

import { createSupabaseAdmin, errorResponse, successResponse } from "../../_lib/supabase.js";

/* ─── Constants ─── */

const ALLOWED_METHODS = "POST, OPTIONS";
const PROVIDER_STATUS_MAP = Object.freeze({
  completed: "completed",
  partial: "partial",
  canceled: "cancelled",
  cancelled: "cancelled",
  refunded: "refunded",
  processing: "processing",
  in_progress: "in_progress",
  pending: "pending",
  failed: "failed",
});
const TERMINAL_STATUSES = new Set(["completed", "partial", "cancelled", "refunded", "failed"]);

/* ─── Notification Labels ─── */

const STATUS_LABELS = Object.freeze({
  completed: "تم إكمال طلبك بنجاح! ✅",
  partial: "تم تنفيذ طلبك جزئيًا ⚠️",
  failed: "فشل تنفيذ طلبك ❌",
  cancelled: "تم إلغاء طلبك 🚫",
  refunded: "تم استرجاع رصيدك 💰",
});

/* ─── Auth ─── */

/**
 * Validates the webhook secret from the request header.
 *
 * @param {Request} request - Incoming request.
 * @param {Record<string, string>} env - Environment bindings.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateWebhookAuth(request, env) {
  const expectedSecret = String(env.SERVA_WEBHOOK_SECRET || "").trim();
  if (!expectedSecret) {
    return { valid: false, error: "Webhook secret not configured." };
  }

  const provided = String(
    request.headers.get("x-webhook-secret") ||
    request.headers.get("x-api-key") ||
    ""
  ).trim();

  if (provided !== expectedSecret) {
    return { valid: false, error: "Invalid webhook secret." };
  }

  return { valid: true };
}

/* ─── Helpers ─── */

/**
 * Builds user notifications for status changes.
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

/**
 * Parses the webhook JSON body safely.
 *
 * @param {Request} request
 * @returns {Promise<{ data: Record<string, unknown> | null, error?: string }>}
 */
async function parseWebhookBody(request) {
  try {
    const text = await request.text();
    if (!text || !text.trim()) {
      return { data: null, error: "Empty request body." };
    }
    return { data: JSON.parse(text) };
  } catch (parseError) {
    return { data: null, error: "Invalid JSON payload." };
  }
}

/* ─── Main Handler ─── */

/**
 * POST /api/webhooks/serva — receives and processes Serva-S order webhooks.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  const auth = validateWebhookAuth(request, env);
  if (!auth.valid) {
    return errorResponse(auth.error, 401);
  }

  const { data: body, error: parseError } = await parseWebhookBody(request);
  if (parseError || !body) {
    return errorResponse(parseError || "Invalid payload.", 400);
  }

  const externalOrderId = String(body.order || "").trim();
  const rawStatus = String(body.status || "").trim().toLowerCase();
  const mappedStatus = PROVIDER_STATUS_MAP[rawStatus];

  if (!externalOrderId) {
    return errorResponse("Missing 'order' field in webhook payload.", 400);
  }
  if (!mappedStatus) {
    return errorResponse(`Unknown status: ${rawStatus}`, 400);
  }

  try {
    const admin = createSupabaseAdmin(env);

    const { data: order, error: fetchError } = await admin
      .from("service_orders")
      .select("id, user_id, service_name, status, price, total, external_order_id, start_count, remains")
      .eq("external_order_id", externalOrderId)
      .maybeSingle();

    if (fetchError) {
      console.error("[WEBHOOK] DB fetch error:", fetchError);
      return errorResponse("Database error.", 500);
    }

    if (!order) {
      return successResponse({ action: "ignored", reason: "Order not found locally.", order_id: externalOrderId });
    }

    if (TERMINAL_STATUSES.has(order.status)) {
      return successResponse({ action: "skipped", reason: "Order already in terminal status.", current_status: order.status });
    }

    if (order.status === mappedStatus) {
      return successResponse({ action: "unchanged", status: mappedStatus });
    }

    const startCount = Number.isFinite(Number(body.start_count)) ? Number(body.start_count) : null;
    const remains = Number.isFinite(Number(body.remains)) ? Number(body.remains) : null;
    const charge = String(body.charge || "0");

    if (TERMINAL_STATUSES.has(mappedStatus)) {
      const { data: syncResult, error: syncError } = await admin.rpc("sync_service_order_status_tx", {
        p_order_id: order.id,
        p_expected_status: order.status,
        p_new_status: mappedStatus,
        p_start_count: startCount,
        p_remains: remains,
      });

      if (syncError) {
        console.error("[WEBHOOK] RPC error:", syncError);
        return errorResponse("Sync RPC failed.", 500);
      }

      const result = Array.isArray(syncResult) ? syncResult[0] : syncResult;

      if (!result?.applied) {
        return successResponse({ action: "skipped", reason: "Status mismatch during RPC." });
      }

      const notifications = buildNotifications(order, result.final_status, Number(result.refund_amount || 0));
      if (notifications.length > 0) {
        await admin.from("notifications").insert(notifications);
      }

      await admin.from("audit_logs").insert({
        action: "webhook_order_sync",
        actor_email: "serva-webhook",
        details: {
          external_order_id: externalOrderId,
          old_status: order.status,
          new_status: result.final_status,
          refund_amount: result.refund_amount || 0,
          source: "serva-s-webhook",
        },
        target_table: "service_orders",
        target_id: order.id,
      });

      return successResponse({
        action: "synced",
        order_id: order.id,
        old_status: order.status,
        new_status: result.final_status,
        refund: result.refund_amount || 0,
      });
    }

    await admin
      .from("service_orders")
      .update({
        status: mappedStatus,
        start_count: startCount ?? order.start_count,
        remains: remains ?? order.remains,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return successResponse({
      action: "updated",
      order_id: order.id,
      old_status: order.status,
      new_status: mappedStatus,
    });
  } catch (err) {
    console.error("[WEBHOOK] Unexpected error:", err);
    return errorResponse("Internal webhook error.", 500);
  }
}

/**
 * OPTIONS /api/webhooks/serva — CORS preflight.
 *
 * @returns {Response}
 */
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret, x-api-key",
      "Access-Control-Max-Age": "86400",
    },
  });
}
